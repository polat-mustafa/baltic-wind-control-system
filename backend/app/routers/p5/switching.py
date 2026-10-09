"""P5 sub-router: switching programme, step execution, PiC decisions, emergency stop."""

from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationError as DomainValidationError
from app.db import get_session
from app.routers.farm_spec import FarmSpecDep
from app.schemas.commissioning import (
    AuditRecordSchema,
    BusReadingSchema,
    CreateProgrammeRequest,
    EmergencyEventSchema,
    EmergencyStopRequest,
    EmergencyStopResponse,
    EnergisationTraceSchema,
    EquipmentStateSchema,
    ExecuteStepRequest,
    ExecuteStepResponse,
    NetworkSnapshotSchema,
    PiCDecisionRequest,
    PiCDecisionResponse,
    ProgrammeDetailSchema,
    ProgrammeFarmSchema,
    ProgrammeSummarySchema,
    StepSchema,
    TraceFrameSchema,
)
from app.services.p2.network_model import EXPORT_CABLE_1000, FarmSpec
from app.services.p5.energisation import (
    NetworkSnapshot,
    circuit1_limit_mw,
    network_snapshot,
    onshore_tap,
)
from app.services.p5.energisation_trace import energisation_trace
from app.services.p5.equipment_state import EquipmentState, get_equipment_definition
from app.services.p5.programme_repository import ProgrammeRepository
from app.services.p5.switching_programme import (
    PiCDecisionRequiredError,
    ProgrammeStatus,
    StepExecutionError,
    StepStatus,
    SwitchingProgramme,
    approve_programme,
    create_oss_energisation_programme,
    emergency_trip,
    execute_step,
    phases,
    pic_go_decision,
    pic_nogo_decision,
    start_programme,
)

router = APIRouter()


def _summary(p: SwitchingProgramme) -> ProgrammeSummarySchema:
    return ProgrammeSummarySchema(
        programme_id=p.programme_id,
        title=p.title,
        pic_name=p.pic_name,
        status=p.status.value,
        total_steps=len(p.steps),
        completed_steps=sum(s.status == StepStatus.COMPLETED for s in p.steps),
        current_step_index=p.current_step_index,
        created_at=p.created_at,
    )


def _equipment(
    state: dict[str, EquipmentState], spec: FarmSpec, locked: frozenset[str] = frozenset()
) -> list[EquipmentStateSchema]:
    out = []
    for eq_id, eq_state in state.items():
        eq = get_equipment_definition(eq_id, spec)
        out.append(
            EquipmentStateSchema(
                equipment_id=eq_id,
                equipment_type=eq.equipment_type.value,
                voltage_kv=eq.voltage_kv,
                location=eq.location,
                state=eq_state.value,
                zones=list(eq.zones),
                locked=eq_id in locked,
            )
        )
    return out


def _farm(spec: FarmSpec) -> ProgrammeFarmSchema:
    return ProgrammeFarmSchema(
        name=spec.name,
        string_layout=list(spec.string_layout),
        section_a_strings=spec.section_a_strings,
        export_length_km=spec.export_length_km,
        oss_trafo_mva=spec.oss_trafo_mva,
        statcom_mvar=spec.statcom_mvar,
        reactor_unit_mvar=spec.reactor_unit_mvar if spec.num_reactors else None,
        output_limit_mw=circuit1_limit_mw(spec),
        onshore_tap=onshore_tap(spec),
    )


def _network(snap: NetworkSnapshot) -> NetworkSnapshotSchema:
    return NetworkSnapshotSchema(
        zones={z: s.value for z, s in snap.zones.items()},
        buses=[
            BusReadingSchema(name=b.name, zone=b.zone, vn_kv=b.vn_kv, vm_pu=b.vm_pu, kv=b.kv)
            for b in snap.buses
        ],
        **{
            k: v
            for k, v in asdict(snap).items()
            if k not in ("zones", "buses") and k in NetworkSnapshotSchema.model_fields
        },
    )


def _detail(p: SwitchingProgramme) -> ProgrammeDetailSchema:
    spec = p.spec
    return ProgrammeDetailSchema(
        **_summary(p).model_dump(),
        farm=_farm(spec),
        phases=phases(spec),
        steps=[
            StepSchema(
                **{k: v for k, v in asdict(s).items() if k in StepSchema.model_fields},
            )
            for s in p.steps
        ],
        equipment_states=_equipment(p.system_state, spec, p.locked()),
        network=_network(network_snapshot(p.system_state, spec)),
        audit_trail=[AuditRecordSchema(**asdict(r)) for r in p.audit_trail],
        emergency_log=[EmergencyEventSchema(**e) for e in p.emergency_log],
    )


@router.get("/energisation-trace", response_model=EnergisationTraceSchema)
def get_energisation_trace(spec: FarmSpecDep) -> EnergisationTraceSchema:
    """Circuit 1's first energisation for the farm in the X-Farm header, one load-flow
    frame per switching step of its programme (cached per farm; the first call solves
    about 25 load flows)."""
    frames = energisation_trace(spec)
    return EnergisationTraceSchema(
        farm=_farm(spec),
        equipment=_equipment(frames[0].state, spec),
        cable_rating_a=EXPORT_CABLE_1000.max_i_ka * 1000,
        frames=[
            TraceFrameSchema(
                step_id=f.step_id,
                step_number=f.step_number,
                phase=f.phase,
                action=f.action,
                equipment_id=f.equipment_id,
                states={k: v.value for k, v in f.state.items()},
                network=_network(f.snapshot),
            )
            for f in frames
        ],
    )


@router.post("/programmes", response_model=ProgrammeSummarySchema, status_code=201)
async def create_programme(
    request: CreateProgrammeRequest, spec: FarmSpecDep, session: AsyncSession = Depends(get_session)
) -> ProgrammeSummarySchema:
    """Create the circuit 1 first-energisation programme (plant earthed and locked) for
    the farm in the X-Farm header (SB-510 without it); the programme keeps that farm."""
    programme = create_oss_energisation_programme(request.pic_name.strip(), spec)
    await ProgrammeRepository(session).save_programme(programme)
    await session.commit()
    return _summary(programme)


@router.get("/programmes", response_model=list[ProgrammeSummarySchema])
async def list_programmes(
    session: AsyncSession = Depends(get_session),
) -> list[ProgrammeSummarySchema]:
    return [_summary(p) for p in await ProgrammeRepository(session).list_programmes()]


@router.delete("/programmes/{programme_id}", status_code=204)
async def delete_programme(programme_id: str, session: AsyncSession = Depends(get_session)) -> None:
    await ProgrammeRepository(session).delete_programme(programme_id)
    await session.commit()


@router.get("/programmes/{programme_id}", response_model=ProgrammeDetailSchema)
async def get_programme_detail(
    programme_id: str, session: AsyncSession = Depends(get_session)
) -> ProgrammeDetailSchema:
    """Steps, equipment, live network (load flow), audit trail and emergencies."""
    return _detail(await ProgrammeRepository(session).get_programme(programme_id))


@router.post("/programmes/{programme_id}/start", response_model=ProgrammeSummarySchema)
async def start_programme_endpoint(
    programme_id: str, session: AsyncSession = Depends(get_session)
) -> ProgrammeSummarySchema:
    """Approve (by the PiC) and start: CREATED → APPROVED → IN_PROGRESS."""
    repo = ProgrammeRepository(session)
    programme = await repo.get_programme(programme_id)
    if programme.status == ProgrammeStatus.CREATED:
        approve_programme(programme, programme.pic_name)
    start_programme(programme)
    await repo.save_programme(programme)
    await session.commit()
    return _summary(programme)


@router.post(
    "/programmes/{programme_id}/steps/{step_id}/execute", response_model=ExecuteStepResponse
)
async def execute_step_endpoint(
    programme_id: str,
    step_id: str,
    request: ExecuteStepRequest,
    session: AsyncSession = Depends(get_session),
) -> ExecuteStepResponse:
    """Execute the current step. A refused step is logged in the audit trail (422)."""
    repo = ProgrammeRepository(session)
    programme = await repo.get_programme(programme_id)
    try:
        step = execute_step(programme, step_id, request.executed_by, request.pic_confirmed)
    except PiCDecisionRequiredError:
        await repo.save_programme(programme)
        await session.commit()
        return ExecuteStepResponse(
            success=False,
            step_id=step_id,
            status="hold_point",
            message=f"Hold point {step_id}: PiC GO / NO-GO required.",
            programme_status=programme.status.value,
        )
    except StepExecutionError:
        await repo.save_programme(programme)  # keep the audit record of the refusal
        await session.commit()
        raise
    await repo.save_programme(programme)
    await session.commit()
    return ExecuteStepResponse(
        success=True,
        step_id=step.step_id,
        status=step.status.value,
        message=f"{step.step_id} completed",
        programme_status=programme.status.value,
        reading=step.reading,
    )


@router.post("/programmes/{programme_id}/pic-decision", response_model=PiCDecisionResponse)
async def pic_decision_endpoint(
    programme_id: str, request: PiCDecisionRequest, session: AsyncSession = Depends(get_session)
) -> PiCDecisionResponse:
    """GO completes a hold point (or resumes a suspended programme); NO-GO aborts."""
    repo = ProgrammeRepository(session)
    programme = await repo.get_programme(programme_id)
    if request.decision == "go":
        pic_go_decision(programme, request.pic_name, request.reason)
        message = "PiC GO — programme continues."
    else:
        if not request.reason.strip():
            raise DomainValidationError("A NO-GO decision needs a reason.")
        pic_nogo_decision(programme, request.pic_name, request.reason)
        message = f"PiC NO-GO — programme aborted: {request.reason}"
    await repo.save_programme(programme)
    await session.commit()
    return PiCDecisionResponse(
        decision=request.decision, programme_status=programme.status.value, message=message
    )


@router.post("/programmes/{programme_id}/emergency-stop", response_model=EmergencyStopResponse)
async def emergency_stop_endpoint(
    programme_id: str, request: EmergencyStopRequest, session: AsyncSession = Depends(get_session)
) -> EmergencyStopResponse:
    """Emergency trip: every closed breaker and turbine group opens."""
    repo = ProgrammeRepository(session)
    programme = await repo.get_programme(programme_id)
    opened = emergency_trip(programme, request.initiated_by, request.reason)
    await repo.save_programme(programme)
    await session.commit()
    return EmergencyStopResponse(
        programme_status=programme.status.value,
        breakers_opened=opened,
        message=f"Emergency trip by {request.initiated_by}: {len(opened)} device(s) opened.",
    )
