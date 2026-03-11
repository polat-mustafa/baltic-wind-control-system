"""P5 sub-router: Switching programme CRUD, step execution, PiC decisions."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationError as DomainValidationError
from app.db import get_session
from app.schemas.commissioning import (
    AuditRecordSchema,
    AuditTrailResponse,
    CreateProgrammeRequest,
    EmergencyStopRequest,
    EmergencyStopResponse,
    EquipmentStateSchema,
    ExecuteStepRequest,
    ExecuteStepResponse,
    PiCDecisionRequest,
    PiCDecisionResponse,
    ProgrammeDetailSchema,
    ProgrammeSummarySchema,
    StepSchema,
)
from app.services.p5.equipment_state import get_equipment_definition
from app.services.p5.programme_repository import ProgrammeRepository
from app.services.p5.switching_programme import (
    PiCDecisionRequiredError,
    ProgrammeStatus,
    SwitchingProgramme,
    SwitchingStep,
    approve_programme,
    create_oss_energisation_programme,
    emergency_stop,
    execute_step,
    pic_go_decision,
    pic_nogo_decision,
    start_programme,
)

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────


def _build_equipment_states(programme: SwitchingProgramme) -> list[EquipmentStateSchema]:
    """Build equipment state schemas from programme system state."""
    states = []
    for eq_id, eq_state in sorted(programme.system_state.items()):
        eq_def = get_equipment_definition(eq_id)
        states.append(
            EquipmentStateSchema(
                equipment_id=eq_id,
                equipment_type=eq_def.equipment_type.value,
                voltage_kv=eq_def.voltage_kv,
                location=eq_def.location,
                state=eq_state.value,
            )
        )
    return states


def _build_step_schema(step: SwitchingStep) -> StepSchema:
    """Build a step schema from a SwitchingStep."""
    return StepSchema(
        step_id=step.step_id,
        step_number=step.step_number,
        phase=step.phase,
        step_type=step.step_type.value,
        action=step.action,
        equipment_id=step.equipment_id,
        responsible=step.responsible,
        pic_confirmation=step.pic_confirmation,
        verification=step.verification,
        notes=step.notes,
        status=step.status.value,
        executed_at=step.executed_at,
        executed_by=step.executed_by,
    )


def _build_summary(programme: SwitchingProgramme) -> ProgrammeSummarySchema:
    """Build a programme summary schema."""
    completed = sum(1 for s in programme.steps if s.status.value == "completed")
    return ProgrammeSummarySchema(
        programme_id=programme.programme_id,
        title=programme.title,
        pic_name=programme.pic_name,
        status=programme.status.value,
        total_steps=len(programme.steps),
        completed_steps=completed,
        current_step_index=programme.current_step_index,
        created_at=programme.created_at,
    )


# ── Programme Endpoints ──────────────────────────────────────────


@router.post("/programmes", response_model=ProgrammeSummarySchema, status_code=201)
async def create_programme(
    request: CreateProgrammeRequest,
    session: AsyncSession = Depends(get_session),
) -> ProgrammeSummarySchema:
    """Create a new 30-step OSS first energisation switching programme.

    The programme is created in CREATED state with all equipment in
    their initial de-energised positions and LOTO set ready.
    """
    repo = ProgrammeRepository(session)
    programme = create_oss_energisation_programme(request.pic_name)
    await repo.save_programme(programme)
    await session.commit()
    return _build_summary(programme)


@router.get("/programmes", response_model=list[ProgrammeSummarySchema])
async def list_programmes(
    session: AsyncSession = Depends(get_session),
) -> list[ProgrammeSummarySchema]:
    """List all switching programmes."""
    repo = ProgrammeRepository(session)
    all_progs = await repo.list_programmes()
    return [_build_summary(p) for p in all_progs]


@router.delete("/programmes/{programme_id}", status_code=204)
async def delete_programme(
    programme_id: str,
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete a switching programme."""
    repo = ProgrammeRepository(session)
    await repo.delete_programme(programme_id)
    await session.commit()


@router.get("/programmes/{programme_id}", response_model=ProgrammeDetailSchema)
async def get_programme_detail(
    programme_id: str,
    session: AsyncSession = Depends(get_session),
) -> ProgrammeDetailSchema:
    """Get detailed programme view including all steps and equipment states."""
    repo = ProgrammeRepository(session)
    programme = await repo.get_programme(programme_id)
    return ProgrammeDetailSchema(
        programme_id=programme.programme_id,
        title=programme.title,
        pic_name=programme.pic_name,
        status=programme.status.value,
        steps=[_build_step_schema(s) for s in programme.steps],
        current_step_index=programme.current_step_index,
        equipment_states=_build_equipment_states(programme),
        created_at=programme.created_at,
    )


@router.post("/programmes/{programme_id}/start", response_model=ProgrammeSummarySchema)
async def start_programme_endpoint(
    programme_id: str,
    session: AsyncSession = Depends(get_session),
) -> ProgrammeSummarySchema:
    """Approve and start programme execution.

    Transitions: CREATED → APPROVED → IN_PROGRESS.
    """
    repo = ProgrammeRepository(session)
    programme = await repo.get_programme(programme_id)

    if programme.status == ProgrammeStatus.CREATED:
        approve_programme(programme, programme.pic_name)
    start_programme(programme)

    await repo.save_programme(programme)
    await session.commit()
    return _build_summary(programme)


# ── Step Execution ───────────────────────────────────────────────


@router.post(
    "/programmes/{programme_id}/steps/{step_id}/execute",
    response_model=ExecuteStepResponse,
)
async def execute_step_endpoint(
    programme_id: str,
    step_id: str,
    request: ExecuteStepRequest,
    session: AsyncSession = Depends(get_session),
) -> ExecuteStepResponse:
    """Execute a single step in the switching programme.

    Steps must be executed in order. Hold points will transition the
    programme to HOLD state (use PiC decision endpoint to proceed).
    """
    repo = ProgrammeRepository(session)
    programme = await repo.get_programme(programme_id)

    try:
        step = execute_step(
            programme,
            step_id,
            request.executed_by,
            request.pic_confirmed,
        )
        await repo.save_programme(programme)
        await session.commit()
        return ExecuteStepResponse(
            success=True,
            step_id=step.step_id,
            status=step.status.value,
            message=f"Step {step.step_id} completed: {step.action}",
            programme_status=programme.status.value,
        )
    except PiCDecisionRequiredError:
        await repo.save_programme(programme)
        await session.commit()
        return ExecuteStepResponse(
            success=False,
            step_id=step_id,
            status="hold_point",
            message=f"Hold point at {step_id}. Programme on HOLD — PiC decision required.",
            programme_status=programme.status.value,
        )


# ── PiC Decision ─────────────────────────────────────────────────


@router.post(
    "/programmes/{programme_id}/pic-decision",
    response_model=PiCDecisionResponse,
)
async def pic_decision_endpoint(
    programme_id: str,
    request: PiCDecisionRequest,
    session: AsyncSession = Depends(get_session),
) -> PiCDecisionResponse:
    """PiC GO/NO-GO decision at a hold point.

    GO: Resumes programme execution.
    NO-GO: Aborts the programme (reason required).
    """
    repo = ProgrammeRepository(session)
    programme = await repo.get_programme(programme_id)

    if request.decision == "go":
        pic_go_decision(programme, request.pic_name, request.reason)
        await repo.save_programme(programme)
        await session.commit()
        return PiCDecisionResponse(
            decision="go",
            programme_status=programme.status.value,
            message="PiC GO — programme resumed.",
        )
    else:
        if not request.reason:
            raise DomainValidationError("NO-GO decision requires a reason.")
        pic_nogo_decision(programme, request.pic_name, request.reason)
        await repo.save_programme(programme)
        await session.commit()
        return PiCDecisionResponse(
            decision="nogo",
            programme_status=programme.status.value,
            message=f"PiC NO-GO — programme aborted. Reason: {request.reason}",
        )


# ── Emergency Stop ───────────────────────────────────────────────


@router.post(
    "/programmes/{programme_id}/emergency-stop",
    response_model=EmergencyStopResponse,
)
async def emergency_stop_endpoint(
    programme_id: str,
    request: EmergencyStopRequest,
    session: AsyncSession = Depends(get_session),
) -> EmergencyStopResponse:
    """Emergency stop — immediately abort the programme.

    Can be called from any non-terminal state. All HV operations cease.
    """
    repo = ProgrammeRepository(session)
    programme = await repo.get_programme(programme_id)
    emergency_stop(programme, request.initiated_by, request.reason)

    await repo.save_programme(programme)
    await session.commit()
    return EmergencyStopResponse(
        success=True,
        programme_status=programme.status.value,
        message=f"EMERGENCY STOP by {request.initiated_by}: {request.reason}",
    )


# ── Equipment State ──────────────────────────────────────────────


@router.get(
    "/programmes/{programme_id}/equipment",
    response_model=list[EquipmentStateSchema],
)
async def get_equipment_states(
    programme_id: str,
    session: AsyncSession = Depends(get_session),
) -> list[EquipmentStateSchema]:
    """Get current equipment states for a programme."""
    repo = ProgrammeRepository(session)
    programme = await repo.get_programme(programme_id)
    return _build_equipment_states(programme)


# ── Audit Trail ──────────────────────────────────────────────────


@router.get(
    "/programmes/{programme_id}/audit-trail",
    response_model=AuditTrailResponse,
)
async def get_audit_trail(
    programme_id: str,
    session: AsyncSession = Depends(get_session),
) -> AuditTrailResponse:
    """Get the complete audit trail for a programme."""
    repo = ProgrammeRepository(session)
    programme = await repo.get_programme(programme_id)

    records = [
        AuditRecordSchema(
            record_id=r.record_id,
            timestamp=r.timestamp,
            action=r.action,
            performed_by=r.performed_by,
            step_id=r.step_id,
            details=r.details,
        )
        for r in programme.audit_trail
    ]

    return AuditTrailResponse(
        programme_id=programme.programme_id,
        total_records=len(records),
        records=records,
    )
