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
    ApproveCampaignRequest,
    AuditRecordSchema,
    AuditTrailResponse,
    ComplianceCampaignSchema,
    CreateFATCampaignRequest,
    CreateProgrammeRequest,
    CreateSATCampaignRequest,
    EmergencyEventSchema,
    EmergencyLogResponse,
    EmergencyProcedureSchema,
    EmergencyStopRequest,
    EmergencyStopResponse,
    EquipmentStateSchema,
    ExecuteStepRequest,
    ExecuteStepResponse,
    FATCampaignSchema,
    GradingPairSchema,
    GradingResultSchema,
    GridCodeTestSchema,
    LOTOActionRequest,
    LOTOActionResponse,
    LOTOPointSchema,
    LOTOSetSchema,
    NotificationApplicationSchema,
    PiCDecisionRequest,
    PiCDecisionResponse,
    ProgrammeDetailSchema,
    ProgrammeSummarySchema,
    ProtectionCoordinationSchema,
    RecordComplianceResultRequest,
    RecordTestResultRequest,
    RelaySettingSchema,
    SATCampaignSchema,
    StageSummarySchema,
    StepSchema,
    SubmitNotificationRequest,
    TestResultSchema,
    TestSpecificationSchema,
    TriggerEmergencyRequest,
)
from app.services.p5.emergency_response import (
    EmergencyType,
    get_all_procedures,
    get_emergency_log,
    get_procedure,
    trigger_emergency,
)
from app.services.p5.equipment_state import (
    get_equipment_definition,
)
from app.services.p5.fat import (
    FATCampaign,
    FATCampaignStateError,
    FATTestNotFoundError,
    all_fat_passed,
    approve_fat_campaign,
    create_fat_campaign,
    record_fat_result,
)
from app.services.p5.grid_code_testing import (
    ComplianceCampaign,
    ComplianceError,
    ComplianceGateError,
    ComplianceTestNotFoundError,
    ComplianceVerdict,
    NotificationStage,
    approve_notification,
    create_compliance_campaign,
    get_compliance_campaign,
    get_stage_summary,
    record_test_result,
    submit_notification,
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
from app.services.p5.protection_relay import (
    GRADING_PAIRS,
    GradingResult,
    SelectivityVerdict,
    get_relay_settings,
    verify_selectivity,
)
from app.services.p5.sat import (
    SATCampaign,
    SATCampaignStateError,
    SATFATGateError,
    SATTestNotFoundError,
    all_sat_passed,
    approve_sat_campaign,
    create_sat_campaign,
    record_sat_result,
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
_fat_campaigns: dict[str, FATCampaign] = {}
_protection_results: list[GradingResult] = []


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


@router.delete("/programmes/{programme_id}", status_code=204)
async def delete_programme(programme_id: str) -> None:
    """Delete a switching programme."""
    if programme_id not in _programmes:
        raise HTTPException(status_code=404, detail="Programme not found")
    del _programmes[programme_id]


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


# ── FAT Helper ──────────────────────────────────────────────────


def _build_fat_schema(campaign: FATCampaign) -> FATCampaignSchema:
    """Build a FAT campaign schema from domain object."""
    specs = [
        TestSpecificationSchema(
            test_id=s.test_id,
            name=s.name,
            standard=s.standard,
            description=s.description,
            unit=s.unit,
            min_value=s.min_value,
            max_value=s.max_value,
        )
        for s in campaign.specs.values()
    ]
    results = [
        TestResultSchema(
            test_id=r.test_id,
            measured_value=r.measured_value,
            verdict=r.verdict.value,
            recorded_by=r.recorded_by,
            recorded_at=r.recorded_at,
            notes=r.notes,
        )
        for r in campaign.results.values()
    ]
    return FATCampaignSchema(
        campaign_id=campaign.campaign_id,
        equipment_tag=campaign.equipment_tag,
        status=campaign.status.value,
        specs=specs,
        results=results,
        all_passed=all_fat_passed(campaign),
        created_at=campaign.created_at,
        approved_by=campaign.approved_by,
        approved_at=campaign.approved_at,
    )


# ── FAT Endpoints ──────────────────────────────────────────────


@router.post("/fat", response_model=FATCampaignSchema, status_code=201)
async def create_fat_campaign_endpoint(
    request: CreateFATCampaignRequest,
) -> FATCampaignSchema:
    """Create a new FAT campaign with 8 IEC-standard test specs."""
    campaign = create_fat_campaign(request.equipment_tag)
    _fat_campaigns[campaign.campaign_id] = campaign
    return _build_fat_schema(campaign)


@router.get("/fat", response_model=list[FATCampaignSchema])
async def list_fat_campaigns() -> list[FATCampaignSchema]:
    """List all FAT campaigns."""
    return [_build_fat_schema(c) for c in _fat_campaigns.values()]


@router.get("/fat/{campaign_id}", response_model=FATCampaignSchema)
async def get_fat_campaign(campaign_id: str) -> FATCampaignSchema:
    """Get FAT campaign detail."""
    if campaign_id not in _fat_campaigns:
        raise HTTPException(status_code=404, detail=f"FAT campaign '{campaign_id}' not found.")
    return _build_fat_schema(_fat_campaigns[campaign_id])


@router.post(
    "/fat/{campaign_id}/tests/{test_id}/record",
    response_model=TestResultSchema,
)
async def record_fat_result_endpoint(
    campaign_id: str,
    test_id: str,
    request: RecordTestResultRequest,
) -> TestResultSchema:
    """Record a FAT test result. Auto-evaluates pass/fail against spec."""
    if campaign_id not in _fat_campaigns:
        raise HTTPException(status_code=404, detail=f"FAT campaign '{campaign_id}' not found.")

    campaign = _fat_campaigns[campaign_id]
    try:
        result = record_fat_result(
            campaign, test_id, request.measured_value, request.recorded_by, request.notes
        )
    except FATCampaignStateError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    except FATTestNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    return TestResultSchema(
        test_id=result.test_id,
        measured_value=result.measured_value,
        verdict=result.verdict.value,
        recorded_by=result.recorded_by,
        recorded_at=result.recorded_at,
        notes=result.notes,
    )


@router.post("/fat/{campaign_id}/approve", response_model=FATCampaignSchema)
async def approve_fat_campaign_endpoint(
    campaign_id: str,
    request: ApproveCampaignRequest,
) -> FATCampaignSchema:
    """Approve a completed FAT campaign (all tests must pass)."""
    if campaign_id not in _fat_campaigns:
        raise HTTPException(status_code=404, detail=f"FAT campaign '{campaign_id}' not found.")

    campaign = _fat_campaigns[campaign_id]
    try:
        approve_fat_campaign(campaign, request.approved_by)
    except FATCampaignStateError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e

    return _build_fat_schema(campaign)


# ── SAT Helper ──────────────────────────────────────────────────


def _build_sat_schema(campaign: SATCampaign) -> SATCampaignSchema:
    """Build a SAT campaign schema from domain object."""
    specs = [
        TestSpecificationSchema(
            test_id=s.test_id,
            name=s.name,
            standard=s.standard,
            description=s.description,
            unit=s.unit,
            min_value=s.min_value,
            max_value=s.max_value,
        )
        for s in campaign.specs.values()
    ]
    results = [
        TestResultSchema(
            test_id=r.test_id,
            measured_value=r.measured_value,
            verdict=r.verdict.value,
            recorded_by=r.recorded_by,
            recorded_at=r.recorded_at,
            notes=r.notes,
        )
        for r in campaign.results.values()
    ]
    return SATCampaignSchema(
        campaign_id=campaign.campaign_id,
        programme_id=campaign.programme_id,
        status=campaign.status.value,
        fat_campaign_id=campaign.fat_campaign_id,
        specs=specs,
        results=results,
        all_passed=all_sat_passed(campaign),
        created_at=campaign.created_at,
        approved_by=campaign.approved_by,
        approved_at=campaign.approved_at,
    )


# ── SAT Endpoints (nested under programme) ─────────────────────


@router.post(
    "/programmes/{programme_id}/sat",
    response_model=SATCampaignSchema,
    status_code=201,
)
async def create_sat_campaign_endpoint(
    programme_id: str,
    request: CreateSATCampaignRequest,
) -> SATCampaignSchema:
    """Create a SAT campaign for a switching programme.

    If require_fat=true, the programme must have a linked FAT campaign
    that is approved.
    """
    programme = _get_programme(programme_id)

    if programme.sat_campaign is not None:
        raise HTTPException(
            status_code=409,
            detail=f"Programme '{programme_id}' already has a SAT campaign.",
        )

    fat_campaign = None
    if request.require_fat:
        if programme.fat_campaign_id is None:
            raise HTTPException(
                status_code=422,
                detail="require_fat=true but programme has no linked FAT campaign.",
            )
        fat_campaign = _fat_campaigns.get(programme.fat_campaign_id)
        if fat_campaign is None:
            raise HTTPException(
                status_code=404,
                detail=f"FAT campaign '{programme.fat_campaign_id}' not found.",
            )

    try:
        sat = create_sat_campaign(programme_id, fat_campaign)
    except SATFATGateError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e

    programme.sat_campaign = sat
    return _build_sat_schema(sat)


@router.get(
    "/programmes/{programme_id}/sat",
    response_model=SATCampaignSchema,
)
async def get_sat_campaign_endpoint(programme_id: str) -> SATCampaignSchema:
    """Get SAT campaign status for a programme."""
    programme = _get_programme(programme_id)
    if programme.sat_campaign is None:
        raise HTTPException(
            status_code=404,
            detail=f"No SAT campaign for programme '{programme_id}'.",
        )
    return _build_sat_schema(programme.sat_campaign)


@router.post(
    "/programmes/{programme_id}/sat/tests/{test_id}/record",
    response_model=TestResultSchema,
)
async def record_sat_result_endpoint(
    programme_id: str,
    test_id: str,
    request: RecordTestResultRequest,
) -> TestResultSchema:
    """Record a SAT test result. Auto-evaluates pass/fail against spec."""
    programme = _get_programme(programme_id)
    if programme.sat_campaign is None:
        raise HTTPException(
            status_code=404,
            detail=f"No SAT campaign for programme '{programme_id}'.",
        )

    try:
        result = record_sat_result(
            programme.sat_campaign,
            test_id,
            request.measured_value,
            request.recorded_by,
            request.notes,
        )
    except SATCampaignStateError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    except SATTestNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    return TestResultSchema(
        test_id=result.test_id,
        measured_value=result.measured_value,
        verdict=result.verdict.value,
        recorded_by=result.recorded_by,
        recorded_at=result.recorded_at,
        notes=result.notes,
    )


@router.post(
    "/programmes/{programme_id}/sat/approve",
    response_model=SATCampaignSchema,
)
async def approve_sat_campaign_endpoint(
    programme_id: str,
    request: ApproveCampaignRequest,
) -> SATCampaignSchema:
    """Approve a completed SAT campaign (all tests must pass)."""
    programme = _get_programme(programme_id)
    if programme.sat_campaign is None:
        raise HTTPException(
            status_code=404,
            detail=f"No SAT campaign for programme '{programme_id}'.",
        )

    try:
        approve_sat_campaign(programme.sat_campaign, request.approved_by)
    except SATCampaignStateError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e

    return _build_sat_schema(programme.sat_campaign)


# ── Protection Relay Endpoints ──────────────────────────────────


@router.get("/protection/settings", response_model=list[RelaySettingSchema])
async def get_protection_settings() -> list[RelaySettingSchema]:
    """List all OSS protection relay settings."""
    return [
        RelaySettingSchema(
            setting_id=s.setting_id,
            function=s.function.value,
            description=s.description,
            pickup_value=s.pickup_value,
            pickup_unit=s.pickup_unit,
            time_delay=s.time_delay,
            location=s.location,
            standard=s.standard,
        )
        for s in get_relay_settings()
    ]


@router.post(
    "/protection/verify-selectivity",
    response_model=ProtectionCoordinationSchema,
)
async def verify_selectivity_endpoint() -> ProtectionCoordinationSchema:
    """Run protection coordination check across all grading pairs."""
    settings = get_relay_settings()
    results = verify_selectivity()

    _protection_results.clear()
    _protection_results.extend(results)

    all_selective = all(r.verdict == SelectivityVerdict.SELECTIVE for r in results)

    return ProtectionCoordinationSchema(
        settings=[
            RelaySettingSchema(
                setting_id=s.setting_id,
                function=s.function.value,
                description=s.description,
                pickup_value=s.pickup_value,
                pickup_unit=s.pickup_unit,
                time_delay=s.time_delay,
                location=s.location,
                standard=s.standard,
            )
            for s in settings
        ],
        grading_pairs=[
            GradingPairSchema(
                pair_id=gp.pair_id,
                downstream_id=gp.downstream_id,
                upstream_id=gp.upstream_id,
                required_margin_ms=gp.required_margin_ms,
                description=gp.description,
            )
            for gp in GRADING_PAIRS
        ],
        results=[
            GradingResultSchema(
                pair_id=r.pair_id,
                downstream_id=r.downstream_id,
                upstream_id=r.upstream_id,
                downstream_delay_s=r.downstream_delay_s,
                upstream_delay_s=r.upstream_delay_s,
                actual_margin_ms=r.actual_margin_ms,
                required_margin_ms=r.required_margin_ms,
                verdict=r.verdict.value,
            )
            for r in results
        ],
        all_selective=all_selective,
    )


# ── Emergency Response Endpoints ────────────────────────────────


@router.get(
    "/emergency-procedures",
    response_model=list[EmergencyProcedureSchema],
    summary="List all emergency procedures",
)
async def list_emergency_procedures() -> list[EmergencyProcedureSchema]:
    """Return all 6 pre-defined emergency response procedures."""
    procedures = get_all_procedures()
    return [
        EmergencyProcedureSchema(
            emergency_type=p.emergency_type.value,
            severity=p.severity.value,
            immediate_actions=p.immediate_actions,
            responsible=p.responsible,
            reference_document=p.reference_document,
            automated_scada_actions=p.automated_scada_actions,
            communication_protocol=p.communication_protocol,
        )
        for p in procedures
    ]


@router.get(
    "/emergency-procedures/{emergency_type}",
    response_model=EmergencyProcedureSchema,
    summary="Get a specific emergency procedure",
)
async def get_emergency_procedure(emergency_type: str) -> EmergencyProcedureSchema:
    """Return the procedure for a specific emergency type."""
    try:
        etype = EmergencyType(emergency_type)
    except ValueError:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown emergency type: {emergency_type}",
        ) from None
    p = get_procedure(etype)
    return EmergencyProcedureSchema(
        emergency_type=p.emergency_type.value,
        severity=p.severity.value,
        immediate_actions=p.immediate_actions,
        responsible=p.responsible,
        reference_document=p.reference_document,
        automated_scada_actions=p.automated_scada_actions,
        communication_protocol=p.communication_protocol,
    )


@router.post(
    "/programmes/{programme_id}/emergency",
    response_model=EmergencyEventSchema,
    summary="Trigger an emergency event",
)
async def trigger_emergency_event(
    programme_id: str,
    body: TriggerEmergencyRequest,
) -> EmergencyEventSchema:
    """Trigger an emergency on a programme and record the event."""
    _get_programme(programme_id)  # Validate programme exists
    try:
        etype = EmergencyType(body.emergency_type)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown emergency type: {body.emergency_type}",
        ) from None

    event = trigger_emergency(etype, body.triggered_by, programme_id)
    return EmergencyEventSchema(
        event_id=event.event_id,
        programme_id=event.programme_id,
        emergency_type=event.emergency_type.value,
        severity=event.severity.value,
        triggered_by=event.triggered_by,
        triggered_at=event.triggered_at,
        actions_taken=event.actions_taken,
        scada_actions_executed=event.scada_actions_executed,
        resolved=event.resolved,
        resolved_at=event.resolved_at,
    )


@router.get(
    "/programmes/{programme_id}/emergency-log",
    response_model=EmergencyLogResponse,
    summary="Get emergency event history",
)
async def get_programme_emergency_log(programme_id: str) -> EmergencyLogResponse:
    """Return the emergency event history for a programme."""
    _get_programme(programme_id)  # Validate programme exists
    events = get_emergency_log(programme_id)
    return EmergencyLogResponse(
        programme_id=programme_id,
        total_events=len(events),
        events=[
            EmergencyEventSchema(
                event_id=e.event_id,
                programme_id=e.programme_id,
                emergency_type=e.emergency_type.value,
                severity=e.severity.value,
                triggered_by=e.triggered_by,
                triggered_at=e.triggered_at,
                actions_taken=e.actions_taken,
                scada_actions_executed=e.scada_actions_executed,
                resolved=e.resolved,
                resolved_at=e.resolved_at,
            )
            for e in events
        ],
    )


# ── Grid Code Compliance Endpoints ──────────────────────────────


def _build_campaign_schema(campaign: ComplianceCampaign) -> ComplianceCampaignSchema:
    """Convert a ComplianceCampaign dataclass to its Pydantic schema."""
    stages = {}
    for stage_key, stage_app in campaign.stages.items():
        stages[stage_key.value] = NotificationApplicationSchema(
            stage=stage_app.stage.value,
            status=stage_app.status.value,
            tests=[
                GridCodeTestSchema(
                    test_id=t.test_id,
                    stage=t.stage.value,
                    name=t.name,
                    description=t.description,
                    standard=t.standard,
                    acceptance_criteria=t.acceptance_criteria,
                    verdict=t.verdict.value,
                    evidence=t.evidence,
                    tested_by=t.tested_by,
                    tested_at=t.tested_at,
                )
                for t in stage_app.tests
            ],
            submitted_to=stage_app.submitted_to,
            submitted_at=stage_app.submitted_at,
            approved_at=stage_app.approved_at,
        )
    return ComplianceCampaignSchema(
        campaign_id=campaign.campaign_id,
        programme_id=campaign.programme_id,
        stages=stages,
        created_at=campaign.created_at,
        cod_achieved=campaign.cod_achieved,
        cod_date=campaign.cod_date,
    )


@router.post(
    "/programmes/{programme_id}/compliance",
    response_model=ComplianceCampaignSchema,
    summary="Create a grid code compliance campaign",
)
async def create_programme_compliance(programme_id: str) -> ComplianceCampaignSchema:
    """Create a new EON/ION/FON compliance campaign for a programme."""
    _get_programme(programme_id)
    existing = get_compliance_campaign(programme_id)
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail="Compliance campaign already exists for this programme",
        )
    campaign = create_compliance_campaign(programme_id)
    return _build_campaign_schema(campaign)


@router.get(
    "/programmes/{programme_id}/compliance",
    response_model=ComplianceCampaignSchema,
    summary="Get compliance campaign with all stages",
)
async def get_programme_compliance(programme_id: str) -> ComplianceCampaignSchema:
    """Return the compliance campaign for a programme."""
    _get_programme(programme_id)
    campaign = get_compliance_campaign(programme_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="No compliance campaign found")
    return _build_campaign_schema(campaign)


@router.post(
    "/programmes/{programme_id}/compliance/tests/{test_id}",
    response_model=GridCodeTestSchema,
    summary="Record a compliance test result",
)
async def record_compliance_test(
    programme_id: str,
    test_id: str,
    body: RecordComplianceResultRequest,
) -> GridCodeTestSchema:
    """Record the result of a grid code compliance test."""
    _get_programme(programme_id)
    try:
        verdict = ComplianceVerdict(body.verdict)
        test = record_test_result(programme_id, test_id, verdict, body.evidence, body.tested_by)
    except ComplianceTestNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ComplianceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return GridCodeTestSchema(
        test_id=test.test_id,
        stage=test.stage.value,
        name=test.name,
        description=test.description,
        standard=test.standard,
        acceptance_criteria=test.acceptance_criteria,
        verdict=test.verdict.value,
        evidence=test.evidence,
        tested_by=test.tested_by,
        tested_at=test.tested_at,
    )


@router.post(
    "/programmes/{programme_id}/compliance/{stage}/submit",
    response_model=NotificationApplicationSchema,
    summary="Submit a notification stage to PSE",
)
async def submit_compliance_notification(
    programme_id: str,
    stage: str,
    body: SubmitNotificationRequest,
) -> NotificationApplicationSchema:
    """Submit a notification stage (EON/ION/FON) to PSE for approval."""
    _get_programme(programme_id)
    try:
        ns = NotificationStage(stage)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid stage: {stage}") from None
    try:
        stage_app = submit_notification(programme_id, ns, body.submitted_by)
    except ComplianceGateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ComplianceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return NotificationApplicationSchema(
        stage=stage_app.stage.value,
        status=stage_app.status.value,
        tests=[
            GridCodeTestSchema(
                test_id=t.test_id,
                stage=t.stage.value,
                name=t.name,
                description=t.description,
                standard=t.standard,
                acceptance_criteria=t.acceptance_criteria,
                verdict=t.verdict.value,
                evidence=t.evidence,
                tested_by=t.tested_by,
                tested_at=t.tested_at,
            )
            for t in stage_app.tests
        ],
        submitted_to=stage_app.submitted_to,
        submitted_at=stage_app.submitted_at,
        approved_at=stage_app.approved_at,
    )


@router.post(
    "/programmes/{programme_id}/compliance/{stage}/approve",
    response_model=NotificationApplicationSchema,
    summary="Approve a notification stage",
)
async def approve_compliance_notification(
    programme_id: str,
    stage: str,
) -> NotificationApplicationSchema:
    """Approve a notification stage (simulates PSE approval)."""
    _get_programme(programme_id)
    try:
        ns = NotificationStage(stage)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid stage: {stage}") from None
    try:
        stage_app = approve_notification(programme_id, ns)
    except ComplianceGateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ComplianceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return NotificationApplicationSchema(
        stage=stage_app.stage.value,
        status=stage_app.status.value,
        tests=[
            GridCodeTestSchema(
                test_id=t.test_id,
                stage=t.stage.value,
                name=t.name,
                description=t.description,
                standard=t.standard,
                acceptance_criteria=t.acceptance_criteria,
                verdict=t.verdict.value,
                evidence=t.evidence,
                tested_by=t.tested_by,
                tested_at=t.tested_at,
            )
            for t in stage_app.tests
        ],
        submitted_to=stage_app.submitted_to,
        submitted_at=stage_app.submitted_at,
        approved_at=stage_app.approved_at,
    )


@router.get(
    "/programmes/{programme_id}/compliance/{stage}/summary",
    response_model=StageSummarySchema,
    summary="Get stage compliance summary",
)
async def get_compliance_stage_summary(
    programme_id: str,
    stage: str,
) -> StageSummarySchema:
    """Return a summary of a stage's compliance status with test counts."""
    _get_programme(programme_id)
    try:
        ns = NotificationStage(stage)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid stage: {stage}") from None
    try:
        summary = get_stage_summary(programme_id, ns)
    except ComplianceError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return StageSummarySchema(**summary)
