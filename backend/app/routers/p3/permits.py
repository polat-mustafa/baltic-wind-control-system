"""P3 sub-router: Permit-to-Work lifecycle management endpoints."""

from __future__ import annotations

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
    NextTransitionSchema,
    PermitDetailResponse,
    PermitListResponse,
    PermitSummarySchema,
    TransitionLogSchema,
    TransitionPermitRequest,
    TransitionResponse,
)
from app.services.p3.permit_to_work import (
    PermitRecord,
    PermitStatus,
    generate_ptw_number,
    get_next_transitions,
    get_step_number,
    validate_transition,
)
from app.services.p3.rbac import (
    Permission,
    RoleLevel,
    check_permission,
)

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────


def _build_next_transitions(status: PermitStatus) -> list[NextTransitionSchema]:
    """Build the list of allowed next transitions for a permit status."""
    import uuid as _uuid

    temp = PermitRecord(
        id=_uuid.uuid4(),
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


# ── Endpoints ────────────────────────────────────────────────────


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

    # Use service-layer validation
    current_status = PermitStatus(permit.status)

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
