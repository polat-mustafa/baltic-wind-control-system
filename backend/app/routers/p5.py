"""
P5 HV Commissioning Simulation API endpoints.

Provides REST endpoints for:
- Switching programme creation and execution
- Person in Control (PiC) GO/NO-GO decisions
- Equipment state monitoring
- LOTO (Lock-Out / Tag-Out) tracking
- Audit trail queries
- Emergency stop

All endpoints follow the convention: /api/v1/commissioning/{resource}
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.commissioning import (
    AuditRecordSchema,
    AuditTrailResponse,
    CreateProgrammeRequest,
    EmergencyStopRequest,
    EmergencyStopResponse,
    EquipmentStateSchema,
    ExecuteStepRequest,
    ExecuteStepResponse,
    LOTOActionRequest,
    LOTOActionResponse,
    LOTOPointSchema,
    LOTOSetSchema,
    PiCDecisionRequest,
    PiCDecisionResponse,
    ProgrammeDetailSchema,
    ProgrammeSummarySchema,
    StepSchema,
)
from app.services.p5.equipment_state import (
    get_equipment_definition,
)
from app.services.p5.loto import (
    LOTOAlreadyAppliedError,
    LOTONotAppliedError,
    LOTOPointNotFoundError,
    all_loto_applied,
    all_loto_removed,
    apply_loto,
    remove_loto,
)
from app.services.p5.switching_programme import (
    PiCDecisionRequiredError,
    ProgrammeStateError,
    ProgrammeStatus,
    StepExecutionError,
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

router = APIRouter(prefix="/api/v1/commissioning", tags=["P5 HV Commissioning"])


# ── In-Memory Store ──────────────────────────────────────────────
#
# In-memory storage for switching programmes. Each programme owns its
# own equipment state and LOTO set (no shared mutable state).
# Persistence (SQLAlchemy) will be added after domain logic is proven.

_programmes: dict[str, SwitchingProgramme] = {}


def _get_programme(programme_id: str) -> SwitchingProgramme:
    """Retrieve a programme by ID or raise 404."""
    if programme_id not in _programmes:
        raise HTTPException(
            status_code=404,
            detail=f"Programme '{programme_id}' not found.",
        )
    return _programmes[programme_id]


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


# ── Programme Endpoints ──────────────────────────────────────────


@router.post("/programmes", response_model=ProgrammeSummarySchema, status_code=201)
async def create_programme(request: CreateProgrammeRequest) -> ProgrammeSummarySchema:
    """Create a new 30-step OSS first energisation switching programme.

    The programme is created in CREATED state with all equipment in
    their initial de-energised positions and LOTO set ready.
    """
    programme = create_oss_energisation_programme(request.pic_name)
    _programmes[programme.programme_id] = programme

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


@router.get("/programmes", response_model=list[ProgrammeSummarySchema])
async def list_programmes() -> list[ProgrammeSummarySchema]:
    """List all switching programmes."""
    result = []
    for prog in _programmes.values():
        completed = sum(1 for s in prog.steps if s.status.value == "completed")
        result.append(
            ProgrammeSummarySchema(
                programme_id=prog.programme_id,
                title=prog.title,
                pic_name=prog.pic_name,
                status=prog.status.value,
                total_steps=len(prog.steps),
                completed_steps=completed,
                current_step_index=prog.current_step_index,
                created_at=prog.created_at,
            )
        )
    return result


@router.get("/programmes/{programme_id}", response_model=ProgrammeDetailSchema)
async def get_programme_detail(programme_id: str) -> ProgrammeDetailSchema:
    """Get detailed programme view including all steps and equipment states."""
    programme = _get_programme(programme_id)
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
async def start_programme_endpoint(programme_id: str) -> ProgrammeSummarySchema:
    """Approve and start programme execution.

    Transitions: CREATED → APPROVED → IN_PROGRESS.
    """
    programme = _get_programme(programme_id)

    try:
        if programme.status == ProgrammeStatus.CREATED:
            approve_programme(programme, programme.pic_name)
        start_programme(programme)
    except ProgrammeStateError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e

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


# ── Step Execution ───────────────────────────────────────────────


@router.post(
    "/programmes/{programme_id}/steps/{step_id}/execute",
    response_model=ExecuteStepResponse,
)
async def execute_step_endpoint(
    programme_id: str,
    step_id: str,
    request: ExecuteStepRequest,
) -> ExecuteStepResponse:
    """Execute a single step in the switching programme.

    Steps must be executed in order. Hold points will transition the
    programme to HOLD state (use PiC decision endpoint to proceed).
    """
    programme = _get_programme(programme_id)

    try:
        step = execute_step(
            programme,
            step_id,
            request.executed_by,
            request.pic_confirmed,
        )
        return ExecuteStepResponse(
            success=True,
            step_id=step.step_id,
            status=step.status.value,
            message=f"Step {step.step_id} completed: {step.action}",
            programme_status=programme.status.value,
        )
    except PiCDecisionRequiredError:
        return ExecuteStepResponse(
            success=False,
            step_id=step_id,
            status="hold_point",
            message=f"Hold point at {step_id}. Programme on HOLD — PiC decision required.",
            programme_status=programme.status.value,
        )
    except ProgrammeStateError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    except StepExecutionError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


# ── PiC Decision ─────────────────────────────────────────────────


@router.post(
    "/programmes/{programme_id}/pic-decision",
    response_model=PiCDecisionResponse,
)
async def pic_decision_endpoint(
    programme_id: str,
    request: PiCDecisionRequest,
) -> PiCDecisionResponse:
    """PiC GO/NO-GO decision at a hold point.

    GO: Resumes programme execution.
    NO-GO: Aborts the programme (reason required).
    """
    programme = _get_programme(programme_id)

    try:
        if request.decision == "go":
            pic_go_decision(programme, request.pic_name, request.reason)
            return PiCDecisionResponse(
                decision="go",
                programme_status=programme.status.value,
                message="PiC GO — programme resumed.",
            )
        else:
            if not request.reason:
                raise HTTPException(
                    status_code=422,
                    detail="NO-GO decision requires a reason.",
                )
            pic_nogo_decision(programme, request.pic_name, request.reason)
            return PiCDecisionResponse(
                decision="nogo",
                programme_status=programme.status.value,
                message=f"PiC NO-GO — programme aborted. Reason: {request.reason}",
            )
    except ProgrammeStateError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    except StepExecutionError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e


# ── Emergency Stop ───────────────────────────────────────────────


@router.post(
    "/programmes/{programme_id}/emergency-stop",
    response_model=EmergencyStopResponse,
)
async def emergency_stop_endpoint(
    programme_id: str,
    request: EmergencyStopRequest,
) -> EmergencyStopResponse:
    """Emergency stop — immediately abort the programme.

    Can be called from any non-terminal state. All HV operations cease.
    """
    programme = _get_programme(programme_id)

    try:
        emergency_stop(programme, request.initiated_by, request.reason)
    except ProgrammeStateError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e

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
async def get_equipment_states(programme_id: str) -> list[EquipmentStateSchema]:
    """Get current equipment states for a programme."""
    programme = _get_programme(programme_id)
    return _build_equipment_states(programme)


# ── LOTO ─────────────────────────────────────────────────────────


@router.get("/programmes/{programme_id}/loto", response_model=LOTOSetSchema)
async def get_loto_status(programme_id: str) -> LOTOSetSchema:
    """Get LOTO status for all isolation points in a programme."""
    programme = _get_programme(programme_id)
    if programme.loto_set is None:
        raise HTTPException(status_code=404, detail="No LOTO set for this programme.")

    loto = programme.loto_set
    points = [
        LOTOPointSchema(
            point_id=p.point_id,
            equipment_id=p.equipment_id,
            status=p.status.value,
            locked_by=p.locked_by,
            tag_number=p.tag_number,
            applied_at=p.applied_at,
            removed_at=p.removed_at,
            removed_by=p.removed_by,
        )
        for p in loto.points.values()
    ]

    return LOTOSetSchema(
        programme_id=loto.programme_id,
        points=points,
        all_applied=all_loto_applied(loto),
        all_removed=all_loto_removed(loto),
    )


@router.post(
    "/programmes/{programme_id}/loto/{point_id}/apply",
    response_model=LOTOActionResponse,
)
async def apply_loto_endpoint(
    programme_id: str,
    point_id: str,
    request: LOTOActionRequest,
) -> LOTOActionResponse:
    """Apply LOTO (lock and danger tag) to an isolation point."""
    programme = _get_programme(programme_id)
    if programme.loto_set is None:
        raise HTTPException(status_code=404, detail="No LOTO set for this programme.")

    try:
        point = apply_loto(programme.loto_set, point_id, request.performed_by)
    except LOTOPointNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except LOTOAlreadyAppliedError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e

    return LOTOActionResponse(
        success=True,
        point_id=point.point_id,
        status=point.status.value,
        message=f"LOTO applied to {point_id} by {request.performed_by}.",
    )


@router.post(
    "/programmes/{programme_id}/loto/{point_id}/remove",
    response_model=LOTOActionResponse,
)
async def remove_loto_endpoint(
    programme_id: str,
    point_id: str,
    request: LOTOActionRequest,
) -> LOTOActionResponse:
    """Remove LOTO (lock and danger tag) from an isolation point."""
    programme = _get_programme(programme_id)
    if programme.loto_set is None:
        raise HTTPException(status_code=404, detail="No LOTO set for this programme.")

    try:
        point = remove_loto(programme.loto_set, point_id, request.performed_by)
    except LOTOPointNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except LOTONotAppliedError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e

    return LOTOActionResponse(
        success=True,
        point_id=point.point_id,
        status=point.status.value,
        message=f"LOTO removed from {point_id} by {request.performed_by}.",
    )


# ── Audit Trail ──────────────────────────────────────────────────


@router.get(
    "/programmes/{programme_id}/audit-trail",
    response_model=AuditTrailResponse,
)
async def get_audit_trail(programme_id: str) -> AuditTrailResponse:
    """Get the complete audit trail for a programme."""
    programme = _get_programme(programme_id)

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
