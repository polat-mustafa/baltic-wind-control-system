"""
P3 SCADA & IEC 61850 API endpoints.

Provides REST endpoints for:
- GOOSE fault simulation: run protection scenarios, view timelines
- Device registry: list IEC 61850 IEDs with logical node details
- SCL file generation: produce IEC 61850-6 XML configuration files
- GOOSE retransmission: calculate IEC 61850-8-1 retransmission schedules
- RBAC: IEC 62443 role-based access control queries
- Permit-to-Work: 9-state PtW lifecycle management

All endpoints follow the convention: /api/v1/scada/{resource}
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_session
from app.models.ptw import PermitToWork, PTWTransitionLog
from app.schemas.ptw import (
    CreatePermitRequest,
    ExtendPermitRequest,
    IEC62443ZoneSchema,
    NextTransitionSchema,
    PermissionCheckRequest,
    PermissionCheckResponse,
    PermitDetailResponse,
    PermitListResponse,
    PermitSummarySchema,
    RoleDefinitionResponse,
    TransitionLogSchema,
    TransitionPermitRequest,
    TransitionResponse,
)
from app.schemas.scada import (
    ComplianceCheckSchema,
    FaultScenarioRequest,
    FaultScenarioSummary,
    FaultSimulationResponse,
    GOOSEMessageSchema,
    PhysicalDeviceSchema,
    ProtectionEventSchema,
    RetransmissionRequest,
    RetransmissionResponse,
    SCLFileResponse,
    SCLFileType,
    SCLGenerateRequest,
    SubstationSummaryResponse,
)
from app.services.p3.goose_simulation import (
    FAULT_CLEARANCE_MAX_MS,
    GOOSE_MAX_LATENCY_MS,
    FaultType,
    calculate_retransmission_schedule,
    create_scenario,
    get_available_scenarios,
    simulate_fault,
)
from app.services.p3.iec61850_model import (
    build_substation_configuration,
    get_device_by_name,
    get_total_logical_node_count,
)
from app.services.p3.permit_to_work import (
    PermitStatus,
    generate_ptw_number,
    get_next_transitions,
    get_step_number,
)
from app.services.p3.rbac import (
    Permission,
    RoleLevel,
    check_permission,
    get_all_roles,
    get_zone_definitions,
)
from app.services.p3.scl_generator import (
    generate_icd,
    generate_scd,
    generate_ssd,
    scl_to_string,
    validate_scl_structure,
)

router = APIRouter(prefix="/api/v1/scada", tags=["P3 SCADA & IEC 61850"])


# ── GOOSE Fault Simulation ────────────────────────────────────────


@router.get("/goose/scenarios", response_model=list[FaultScenarioSummary])
async def list_fault_scenarios() -> list[FaultScenarioSummary]:
    """List all available fault scenarios for GOOSE simulation.

    Returns the fault type and description for each available scenario.
    Use the fault_type value in the simulation request.
    """
    scenarios = get_available_scenarios()
    return [
        FaultScenarioSummary(
            fault_type=s["fault_type"],
            description=s["description"],
        )
        for s in scenarios
    ]


@router.post("/goose/simulate", response_model=FaultSimulationResponse)
async def run_fault_simulation(request: FaultScenarioRequest) -> FaultSimulationResponse:
    """Run a GOOSE protection fault simulation.

    Simulates a complete protection sequence from fault inception through
    SCADA alarm, including GOOSE message publication and IEC compliance
    verification.

    The timeline is deterministic — identical inputs always produce
    identical outputs. This enables reproducible testing and education.
    """
    try:
        fault_type = FaultType(request.fault_type)
    except ValueError as err:
        valid_types = [ft.value for ft in FaultType]
        raise HTTPException(
            status_code=422,
            detail=f"Invalid fault_type: '{request.fault_type}'. Valid types: {valid_types}",
        ) from err

    scenario = create_scenario(fault_type)
    result = simulate_fault(scenario)

    events = [
        ProtectionEventSchema(
            event_type=e.event_type.value,
            timestamp_ms=e.timestamp_ms,
            description=e.description,
            ied_name=e.ied_name,
        )
        for e in result.events
    ]

    goose_messages = [
        GOOSEMessageSchema(
            gocb_ref=m.gocb_ref,
            dat_set=m.dat_set,
            go_id=m.go_id,
            st_num=m.st_num,
            sq_num=m.sq_num,
            all_data=m.all_data,
            timestamp=m.timestamp,
            app_id=m.app_id,
            mac_address=m.mac_address,
            vlan_id=m.vlan_id,
        )
        for m in result.goose_messages
    ]

    compliance = ComplianceCheckSchema(
        goose_latency_ms=result.goose_latency_ms,
        goose_max_allowed_ms=GOOSE_MAX_LATENCY_MS,
        goose_compliant=result.goose_compliant,
        total_clearance_ms=result.total_clearance_ms,
        clearance_max_allowed_ms=FAULT_CLEARANCE_MAX_MS,
        clearance_compliant=result.clearance_compliant,
    )

    return FaultSimulationResponse(
        fault_type=scenario.fault_type.value,
        location=scenario.location.value,
        fault_current_pu=scenario.fault_current_pu,
        protection_function=scenario.protection_function.value,
        description=scenario.description,
        events=events,
        goose_messages=goose_messages,
        compliance=compliance,
        retransmission_schedule_ms=list(result.retransmission_schedule_ms),
    )


@router.post("/goose/retransmission", response_model=RetransmissionResponse)
async def calculate_goose_retransmission(
    request: RetransmissionRequest,
) -> RetransmissionResponse:
    """Calculate a GOOSE retransmission schedule per IEC 61850-8-1 §15.2.2.

    Returns both cumulative timestamps and individual interval durations
    for the exponential backoff retransmission scheme.
    """
    schedule = calculate_retransmission_schedule(
        min_time_ms=request.min_time_ms,
        max_time_ms=request.max_time_ms,
        num_retransmissions=request.num_retransmissions,
    )

    # Calculate individual intervals from cumulative schedule
    intervals = [schedule[0]]
    for i in range(1, len(schedule)):
        intervals.append(schedule[i] - schedule[i - 1])

    return RetransmissionResponse(
        min_time_ms=request.min_time_ms,
        max_time_ms=request.max_time_ms,
        num_retransmissions=request.num_retransmissions,
        schedule_ms=list(schedule),
        intervals_ms=intervals,
    )


# ── Device Registry ───────────────────────────────────────────────


@router.get("/devices", response_model=SubstationSummaryResponse)
async def get_substation_summary() -> SubstationSummaryResponse:
    """Get the complete IEC 61850 substation configuration summary.

    Returns all 37 IEDs (3 OSS + 34 WTG) with their logical nodes,
    data objects, and GOOSE control blocks.
    """
    devices = build_substation_configuration()
    total_lns = get_total_logical_node_count(devices)

    device_schemas = []
    protection_count = 0
    measurement_count = 0
    bay_count = 0
    wtg_count = 0

    for d in devices:
        ld_schemas = []
        for ld in d.logical_devices:
            ln_schemas = []
            for ln in ld.logical_nodes:
                do_schemas = []
                for do in ln.data_objects:
                    da_schemas = [
                        {
                            "name": da.name,
                            "data_type": da.data_type,
                            "fc": da.fc,
                            "description": da.description,
                            "unit": da.unit,
                        }
                        for da in do.attributes
                    ]
                    do_schemas.append(
                        {
                            "name": do.name,
                            "cdc": do.cdc,
                            "attributes": da_schemas,
                            "description": do.description,
                        }
                    )
                ln_schemas.append(
                    {
                        "class_name": ln.class_name,
                        "instance": ln.instance,
                        "full_name": ln.name,
                        "category": ln.category.value,
                        "data_objects": do_schemas,
                        "description": ln.description,
                    }
                )
            ld_schemas.append(
                {
                    "inst": ld.inst,
                    "logical_nodes": ln_schemas,
                    "description": ld.description,
                }
            )

        device_schemas.append(
            PhysicalDeviceSchema(
                name=d.name,
                equipment_type=d.equipment_type.value,
                manufacturer=d.manufacturer,
                model=d.model,
                logical_devices=ld_schemas,
                ip_address=d.ip_address,
                description=d.description,
            )
        )

        if d.equipment_type.value == "protection_ied":
            protection_count += 1
        elif d.equipment_type.value == "measurement_ied":
            measurement_count += 1
        elif d.equipment_type.value == "bay_controller":
            bay_count += 1
        elif d.equipment_type.value == "wtg_controller":
            wtg_count += 1

    return SubstationSummaryResponse(
        total_devices=len(devices),
        total_logical_nodes=total_lns,
        protection_ieds=protection_count,
        measurement_ieds=measurement_count,
        bay_controllers=bay_count,
        wtg_controllers=wtg_count,
        goose_control_blocks=1,  # One GoCB on OSS protection IED
        devices=device_schemas,
    )


@router.get("/devices/{device_name}", response_model=PhysicalDeviceSchema)
async def get_device_detail(device_name: str) -> PhysicalDeviceSchema:
    """Get detailed IEC 61850 configuration for a specific device.

    Returns the full logical device → logical node → data object hierarchy.

    Parameters
    ----------
    device_name : str
        IED instance name (e.g., 'OSS_PROT_IED01', 'WTG_01').
    """
    devices = build_substation_configuration()
    device = get_device_by_name(devices, device_name)

    if device is None:
        valid_names = [d.name for d in devices[:5]]
        raise HTTPException(
            status_code=404,
            detail=(f"Device '{device_name}' not found. Examples: {valid_names}"),
        )

    ld_schemas = []
    for ld in device.logical_devices:
        ln_schemas = []
        for ln in ld.logical_nodes:
            do_schemas = []
            for do in ln.data_objects:
                da_schemas = [
                    {
                        "name": da.name,
                        "data_type": da.data_type,
                        "fc": da.fc,
                        "description": da.description,
                        "unit": da.unit,
                    }
                    for da in do.attributes
                ]
                do_schemas.append(
                    {
                        "name": do.name,
                        "cdc": do.cdc,
                        "attributes": da_schemas,
                        "description": do.description,
                    }
                )
            ln_schemas.append(
                {
                    "class_name": ln.class_name,
                    "instance": ln.instance,
                    "full_name": ln.name,
                    "category": ln.category.value,
                    "data_objects": do_schemas,
                    "description": ln.description,
                }
            )
        ld_schemas.append(
            {
                "inst": ld.inst,
                "logical_nodes": ln_schemas,
                "description": ld.description,
            }
        )

    return PhysicalDeviceSchema(
        name=device.name,
        equipment_type=device.equipment_type.value,
        manufacturer=device.manufacturer,
        model=device.model,
        logical_devices=ld_schemas,
        ip_address=device.ip_address,
        description=device.description,
    )


# ── SCL File Generation ──────────────────────────────────────────


@router.post("/scl-generate", response_model=SCLFileResponse, status_code=201)
async def generate_scl_file(request: SCLGenerateRequest) -> SCLFileResponse:
    """Generate an IEC 61850-6 SCL configuration file.

    Supported file types:
    - SSD: Substation Specification Description (voltage levels + bays)
    - ICD: IED Capability Description (single IED logical nodes)
    - SCD: Substation Configuration Description (all IEDs combined)
    """
    devices = build_substation_configuration()

    if request.file_type == SCLFileType.SSD:
        root = generate_ssd()
    elif request.file_type == SCLFileType.ICD:
        if request.device_name is None:
            raise HTTPException(
                status_code=422,
                detail="device_name is required for ICD file generation.",
            )
        device = get_device_by_name(devices, request.device_name)
        if device is None:
            valid = [d.name for d in devices[:5]]
            raise HTTPException(
                status_code=404,
                detail=f"Device '{request.device_name}' not found. Examples: {valid}",
            )
        root = generate_icd(device)
    elif request.file_type == SCLFileType.SCD:
        root = generate_scd("Baltic_Wind_Alpha_OSS", devices)
    else:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid file_type: '{request.file_type}'.",
        )

    # Validate SCL structure
    errors = validate_scl_structure(root)
    if errors:
        raise HTTPException(
            status_code=500,
            detail=f"SCL validation errors: {errors}",
        )

    xml_content = scl_to_string(root)
    name = f"Baltic_Wind_Alpha_{request.file_type.value}"
    if request.device_name:
        name += f"_{request.device_name}"

    return SCLFileResponse(
        id=uuid.uuid4(),
        file_type=request.file_type.value,
        name=name,
        xml_content=xml_content,
        device_name=request.device_name,
        created_at=datetime.now(UTC),
    )


# ── RBAC — IEC 62443 Role-Based Access Control ──────────────────


@router.get("/rbac/roles", response_model=list[RoleDefinitionResponse])
async def list_roles() -> list[RoleDefinitionResponse]:
    """List all 5 IEC 62443 role definitions with permissions.

    Returns the complete RBAC matrix: role name, level, permissions
    (own + inherited), MFA requirement, and IEC 62443 Security Level.
    """
    roles = get_all_roles()
    return [
        RoleDefinitionResponse(
            level=r.level,
            name=r.name,
            description=r.description,
            permissions=sorted(p.value for p in r.permissions),
            mfa_required=r.mfa_required,
            security_level=r.security_level,
        )
        for r in roles
    ]


@router.post("/rbac/check", response_model=PermissionCheckResponse)
async def check_role_permission(request: PermissionCheckRequest) -> PermissionCheckResponse:
    """Check whether a role level has a specific permission.

    Validates the role level and permission, then looks up the RBAC
    matrix to determine access.
    """
    try:
        role_level = RoleLevel(request.role_level)
    except ValueError as err:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid role_level: {request.role_level}. Valid: 1-5.",
        ) from err

    try:
        permission = Permission(request.permission)
    except ValueError as err:
        valid_perms = [p.value for p in Permission]
        raise HTTPException(
            status_code=422,
            detail=f"Invalid permission: '{request.permission}'. Valid: {valid_perms}",
        ) from err

    result = check_permission(role_level, permission)
    return PermissionCheckResponse(
        granted=result.granted,
        role_level=result.role_level,
        permission=result.permission.value,
        reason=result.reason,
        mfa_required=result.mfa_required,
    )


@router.get("/rbac/zones", response_model=list[IEC62443ZoneSchema])
async def list_zones() -> list[IEC62443ZoneSchema]:
    """List all IEC 62443-3-3 security zone definitions.

    Returns zone name, minimum access level, and engineering description.
    """
    zones = get_zone_definitions()
    return [
        IEC62443ZoneSchema(
            zone=z.zone.value,
            min_access_level=z.min_access_level,
            description=z.description,
        )
        for z in zones
    ]


# ── Permit-to-Work Lifecycle ─────────────────────────────────────


@router.post("/permits/", response_model=PermitDetailResponse, status_code=201)
async def create_permit_endpoint(
    request: CreatePermitRequest,
    session: AsyncSession = Depends(get_session),
) -> PermitDetailResponse:
    """Create a new Permit-to-Work in REQUESTED state.

    The permit is persisted to the database and assigned a unique
    BWA-PTW-{YEAR}-{SEQ} number.
    """
    # Count existing permits to generate sequence number
    count_result = await session.execute(select(PermitToWork.id))
    sequence = len(count_result.all()) + 1
    ptw_number = generate_ptw_number(sequence)

    permit = PermitToWork(
        ptw_number=ptw_number,
        status=PermitStatus.REQUESTED.value,
        work_description=request.work_description,
        equipment_id=request.equipment_id,
        requested_by=request.requested_by,
        person_in_charge=request.person_in_charge,
    )
    session.add(permit)
    await session.commit()
    await session.refresh(permit)

    next_trans = _build_next_transitions(PermitStatus(permit.status))

    return PermitDetailResponse(
        id=permit.id,
        ptw_number=permit.ptw_number,
        status=permit.status,
        work_description=permit.work_description,
        equipment_id=permit.equipment_id,
        requested_by=permit.requested_by,
        person_in_charge=permit.person_in_charge,
        risk_level=permit.risk_level,
        risk_categories=permit.risk_categories,
        control_measures=permit.control_measures,
        approved_by=permit.approved_by,
        valid_from=permit.valid_from,
        valid_until=permit.valid_until,
        created_at=permit.created_at,
        updated_at=permit.updated_at,
        current_step_number=get_step_number(PermitStatus(permit.status)),
        next_allowed_transitions=next_trans,
        transition_log=[],
    )


@router.get("/permits/", response_model=PermitListResponse)
async def list_permits(
    status: str | None = Query(default=None, description="Filter by status"),
    equipment_id: str | None = Query(default=None, description="Filter by equipment"),
    session: AsyncSession = Depends(get_session),
) -> PermitListResponse:
    """List permits with optional status and equipment filters."""
    stmt = select(PermitToWork).order_by(PermitToWork.created_at.desc())

    if status is not None:
        stmt = stmt.where(PermitToWork.status == status)
    if equipment_id is not None:
        stmt = stmt.where(PermitToWork.equipment_id == equipment_id)

    result = await session.execute(stmt)
    permits = result.scalars().all()

    return PermitListResponse(
        total=len(permits),
        permits=[
            PermitSummarySchema(
                id=p.id,
                ptw_number=p.ptw_number,
                status=p.status,
                work_description=p.work_description,
                equipment_id=p.equipment_id,
                requested_by=p.requested_by,
                created_at=p.created_at,
            )
            for p in permits
        ],
    )


@router.get("/permits/{ptw_number}", response_model=PermitDetailResponse)
async def get_permit_detail(
    ptw_number: str,
    session: AsyncSession = Depends(get_session),
) -> PermitDetailResponse:
    """Get permit detail including full audit trail."""
    stmt = (
        select(PermitToWork)
        .where(PermitToWork.ptw_number == ptw_number)
        .options(selectinload(PermitToWork.transition_log))
    )
    result = await session.execute(stmt)
    permit = result.scalar_one_or_none()

    if permit is None:
        raise HTTPException(
            status_code=404,
            detail=f"Permit '{ptw_number}' not found.",
        )

    next_trans = _build_next_transitions(PermitStatus(permit.status))

    return PermitDetailResponse(
        id=permit.id,
        ptw_number=permit.ptw_number,
        status=permit.status,
        work_description=permit.work_description,
        equipment_id=permit.equipment_id,
        requested_by=permit.requested_by,
        person_in_charge=permit.person_in_charge,
        risk_level=permit.risk_level,
        risk_categories=permit.risk_categories,
        control_measures=permit.control_measures,
        approved_by=permit.approved_by,
        valid_from=permit.valid_from,
        valid_until=permit.valid_until,
        created_at=permit.created_at,
        updated_at=permit.updated_at,
        current_step_number=get_step_number(PermitStatus(permit.status)),
        next_allowed_transitions=next_trans,
        transition_log=[
            TransitionLogSchema(
                id=t.id,
                from_status=t.from_status,
                to_status=t.to_status,
                performed_by=t.performed_by,
                user_level=t.user_level,
                notes=t.notes,
                created_at=t.created_at,
            )
            for t in permit.transition_log
        ],
    )


@router.post("/permits/{ptw_number}/transition", response_model=TransitionResponse)
async def transition_permit(
    ptw_number: str,
    request: TransitionPermitRequest,
    session: AsyncSession = Depends(get_session),
) -> TransitionResponse:
    """Advance a permit to the next state in its lifecycle.

    Validates the transition against the state machine and RBAC matrix.
    Records the transition in the append-only audit log.
    """
    stmt = select(PermitToWork).where(PermitToWork.ptw_number == ptw_number)
    result = await session.execute(stmt)
    permit = result.scalar_one_or_none()

    if permit is None:
        raise HTTPException(
            status_code=404,
            detail=f"Permit '{ptw_number}' not found.",
        )

    # Validate target status
    try:
        target = PermitStatus(request.target_status)
    except ValueError as err:
        valid = [s.value for s in PermitStatus]
        raise HTTPException(
            status_code=422,
            detail=f"Invalid target_status: '{request.target_status}'. Valid: {valid}",
        ) from err

    # Validate role level
    try:
        user_level = RoleLevel(request.user_level)
    except ValueError as err:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid user_level: {request.user_level}. Valid: 1-5.",
        ) from err

    # Use service-layer validation (re-implemented for DB model)
    current_status = PermitStatus(permit.status)
    from app.services.p3.permit_to_work import PermitRecord, validate_transition

    # Build a lightweight PermitRecord for validation
    temp_record = PermitRecord(
        id=permit.id,
        ptw_number=permit.ptw_number,
        status=current_status,
        work_description=permit.work_description,
        equipment_id=permit.equipment_id,
        requested_by=permit.requested_by,
        valid_from=permit.valid_from,
        valid_until=permit.valid_until,
    )
    is_valid, reason = validate_transition(temp_record, target, user_level)

    if not is_valid:
        raise HTTPException(status_code=409, detail=reason)

    # Apply transition
    old_status = permit.status
    permit.status = target.value

    # Set validity on ACTIVE
    if target == PermitStatus.ACTIVE:
        now = datetime.now(UTC)
        permit.valid_from = now
        permit.valid_until = now + timedelta(hours=12)

    # Record audit log
    log_entry = PTWTransitionLog(
        permit_id=permit.id,
        from_status=old_status,
        to_status=target.value,
        performed_by=request.performed_by,
        user_level=request.user_level,
        notes=request.notes,
    )
    session.add(log_entry)
    await session.commit()

    return TransitionResponse(
        success=True,
        ptw_number=ptw_number,
        from_status=old_status,
        to_status=target.value,
        message=reason,
        step_number=get_step_number(target),
    )


@router.post("/permits/{ptw_number}/extend", response_model=TransitionResponse)
async def extend_permit(
    ptw_number: str,
    request: ExtendPermitRequest,
    session: AsyncSession = Depends(get_session),
) -> TransitionResponse:
    """Extend a permit's validity period.

    Only applies to ACTIVE permits. Adds extension_hours to the
    current valid_until timestamp.
    """
    stmt = select(PermitToWork).where(PermitToWork.ptw_number == ptw_number)
    result = await session.execute(stmt)
    permit = result.scalar_one_or_none()

    if permit is None:
        raise HTTPException(status_code=404, detail=f"Permit '{ptw_number}' not found.")

    if permit.status != PermitStatus.ACTIVE.value:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot extend permit in '{permit.status}' state. Must be 'active'.",
        )

    # Validate role level (Level 3+ can extend)
    try:
        user_level = RoleLevel(request.user_level)
    except ValueError as err:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid user_level: {request.user_level}. Valid: 1-5.",
        ) from err

    perm_result = check_permission(user_level, Permission.PTW_APPROVE)
    if not perm_result.granted:
        raise HTTPException(status_code=403, detail=perm_result.reason)

    # Extend validity
    if permit.valid_until is not None:
        permit.valid_until = permit.valid_until + timedelta(hours=request.extension_hours)
    else:
        now = datetime.now(UTC)
        permit.valid_until = now + timedelta(hours=request.extension_hours)

    # Audit log
    log_entry = PTWTransitionLog(
        permit_id=permit.id,
        from_status=permit.status,
        to_status=permit.status,  # status unchanged
        performed_by=request.performed_by,
        user_level=request.user_level,
        notes=f"Extended by {request.extension_hours}h. {request.notes}".strip(),
    )
    session.add(log_entry)
    await session.commit()

    return TransitionResponse(
        success=True,
        ptw_number=ptw_number,
        from_status=permit.status,
        to_status=permit.status,
        message=f"Permit extended by {request.extension_hours} hours.",
        step_number=get_step_number(PermitStatus(permit.status)),
    )


# ── Helpers ──────────────────────────────────────────────────────


def _build_next_transitions(status: PermitStatus) -> list[NextTransitionSchema]:
    """Build the list of allowed next transitions for a permit status."""
    from app.services.p3.permit_to_work import PermitRecord

    # Use a temporary record to get transitions
    temp = PermitRecord(
        id=__import__("uuid").uuid4(),
        ptw_number="temp",
        status=status,
        work_description="",
        equipment_id="",
        requested_by="",
    )
    nexts = get_next_transitions(temp)
    return [
        NextTransitionSchema(
            target_status=target.value,
            required_permission=perm.value,
        )
        for target, perm in nexts
    ]
