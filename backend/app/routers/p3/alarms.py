"""
Alarm rationalization and management API endpoints — M09 (EEMUA 191).

Endpoints
---------
GET  /api/v1/scada/alarms/kpi               — EEMUA 191 real-time KPIs
GET  /api/v1/scada/alarms                   — List alarms (with filters)
POST /api/v1/scada/alarms/{id}/shelve       — Shelve alarm with audit trail
POST /api/v1/scada/alarms/{id}/unshelve     — Unshelve alarm
GET  /api/v1/scada/alarms/rationalization   — Full rationalization matrix
PUT  /api/v1/scada/alarms/{id}/rationalize  — Update rationalization data
GET  /api/v1/scada/alarms/flood-events      — Historical flood events
GET  /api/v1/scada/alarms/chatterers        — Chattering alarm detection

The alarm system is the primary human-machine interface in the substation.
EEMUA 191 defines performance benchmarks to avoid alarm flooding, which
degrades operator situational awareness and leads to missed critical alarms.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.schemas.alarm import (
    AlarmFloodEventResponse,
    AlarmKPIResponse,
    AlarmRationalizationDetail,
    AlarmResponse,
    AlarmShelveRequest,
    AlarmUnshelveRequest,
    ChatteringResponse,
    RationalizationUpdateRequest,
)
from app.services.p3 import alarm_manager as svc

router = APIRouter(tags=["M09 Alarm Rationalization"])


@router.get(
    "/alarms/kpi",
    response_model=AlarmKPIResponse,
    summary="EEMUA 191 alarm management KPIs",
)
async def get_alarm_kpi(
    window_hours: float = Query(
        default=24.0,
        ge=1.0,
        le=168.0,
        description="Look-back window in hours (1-168 h)",
    ),
    db: AsyncSession = Depends(get_session),
) -> AlarmKPIResponse:
    """Return EEMUA 191 alarm management KPIs.

    Benchmarks from EEMUA 191 (3rd edition, 2013):
    - Average alarm rate   : < 1 alarm/10 min (very manageable)
    - Peak alarm rate      : < 10 alarms/10 min
    - Acknowledgement rate : > 80% within 10 minutes
    - Chattering alarms    : 0
    - Standing alarms      : < 10

    Overall grade:
    - GOOD       : all three main benchmarks met
    - ACCEPTABLE : 2 of 3 benchmarks met
    - POOR       : < 2 benchmarks met — requires urgent investigation

    EEMUA 191 is the de-facto standard for process industry alarm systems.
    ISA-18.2 (ANSI standard) adopts equivalent requirements.
    """
    return await svc.get_kpis(db, window_hours=window_hours)


@router.get(
    "/alarms",
    response_model=list[AlarmResponse],
    summary="List alarms",
)
async def list_alarms(
    state: str | None = Query(
        default=None,
        description="Filter by state: NORMAL / ACTIVE / ACKNOWLEDGED / SUPPRESSED",
    ),
    priority: str | None = Query(
        default=None,
        description="Filter by priority: CRITICAL / HIGH / MEDIUM / LOW / ADVISORY",
    ),
    source_device: str | None = Query(
        default=None,
        description="Filter by source device tag",
    ),
    active_only: bool = Query(
        default=False,
        description="If True, return only active and acknowledged alarms",
    ),
    shelved_only: bool = Query(
        default=False,
        description="If True, return only shelved alarms",
    ),
    db: AsyncSession = Depends(get_session),
) -> list[AlarmResponse]:
    """Return alarms from the registry with optional filters.

    An alarm can be in one of four states:
    - NORMAL       : Process condition within limits — alarm is quiet
    - ACTIVE       : Process condition exceeded limit — requires operator attention
    - ACKNOWLEDGED : Operator has seen the alarm and is taking action
    - SUPPRESSED   : Alarm has been disabled (shelved or flood-suppressed)

    EEMUA 191 §3.1: An alarm is defined as 'an audible and/or visible means
    of indicating to the operator an equipment malfunction, process deviation,
    or abnormal condition requiring a response.'
    """
    return await svc.list_alarms(
        db,
        state=state,
        priority=priority,
        source_device=source_device,
        shelved_only=shelved_only,
        active_only=active_only,
    )


@router.post(
    "/alarms/{alarm_id}/shelve",
    response_model=AlarmResponse,
    summary="Shelve an alarm",
)
async def shelve_alarm(
    alarm_id: uuid.UUID,
    body: AlarmShelveRequest,
    db: AsyncSession = Depends(get_session),
) -> AlarmResponse:
    """Shelve an alarm for a defined duration.

    Shelving temporarily removes an alarm from the active alarm list.
    It auto-unshelves after the specified duration (0.5 h to 72 h).

    Use cases:
    - Known maintenance condition (e.g. one bay intentionally de-energised)
    - Faulty sensor being repaired — alarm would otherwise be permanently active
    - Known nuisance alarm awaiting setpoint review

    EEMUA 191 §4.4 requirements:
    - Duration must be justified (reason field required)
    - Maximum 72 h before mandatory review
    - Shelving must be auditable — every shelve is recorded with operator ID

    The alarm is NOT silenced — it will reactivate and page the operator
    when the shelve expires. Shelving does not affect the underlying process.
    """
    try:
        return await svc.shelve_alarm(
            db,
            alarm_id=alarm_id,
            operator_id=body.operator_id,
            reason=body.reason,
            duration_hours=body.duration_hours,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.post(
    "/alarms/{alarm_id}/unshelve",
    response_model=AlarmResponse,
    summary="Unshelve an alarm",
)
async def unshelve_alarm(
    alarm_id: uuid.UUID,
    body: AlarmUnshelveRequest,
    db: AsyncSession = Depends(get_session),
) -> AlarmResponse:
    """Manually unshelve an alarm before its scheduled expiry.

    Use this when the maintenance condition has been resolved and the
    alarm should be reinstated immediately rather than waiting for
    the scheduled expiry.
    """
    try:
        return await svc.unshelve_alarm(db, alarm_id=alarm_id, operator_id=body.operator_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get(
    "/alarms/rationalization",
    response_model=list[AlarmRationalizationDetail],
    summary="Alarm rationalization matrix",
)
async def get_rationalization_matrix(
    status: str | None = Query(
        default=None,
        description="Filter by status: RATIONALIZED / PENDING / NEEDS_UPDATE",
    ),
    db: AsyncSession = Depends(get_session),
) -> list[AlarmRationalizationDetail]:
    """Return the EEMUA 191 alarm rationalization matrix.

    Each alarm must have documented cause, consequence, and operator action
    (EEMUA 191 §4.2, ISA-18.2 §5.4). This matrix shows the review status
    for every alarm in the system.

    Rationalization status values:
    - RATIONALIZED : reviewed, justified, and documented by a competent person
    - PENDING      : scheduled for review — alarm exists but is not yet documented
    - NEEDS_UPDATE : previously rationalized but a setpoint or equipment change
                     means the documentation needs updating
    - SUPPRESSED   : disabled by management decision with documented justification

    Target: 100% RATIONALIZED. A non-rationalized alarm is an undocumented alarm.
    """
    return await svc.get_rationalization_matrix(db, status_filter=status)


@router.put(
    "/alarms/{alarm_id}/rationalize",
    response_model=AlarmRationalizationDetail,
    summary="Update alarm rationalization data",
)
async def update_rationalization(
    alarm_id: uuid.UUID,
    body: RationalizationUpdateRequest,
    db: AsyncSession = Depends(get_session),
) -> AlarmRationalizationDetail:
    """Update EEMUA 191 rationalization data for an alarm.

    Allows updating cause, consequence, operator action, priority, and
    rationalization status. Only supplied fields are updated.

    After updating, set rationalization_status to 'RATIONALIZED' to mark
    the alarm as fully documented.
    """
    try:
        return await svc.update_rationalization(db, alarm_id=alarm_id, updates=body)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get(
    "/alarms/flood-events",
    response_model=list[AlarmFloodEventResponse],
    summary="Historical alarm flood events",
)
async def get_flood_events(
    limit: int = Query(default=50, ge=1, le=500, description="Max flood events to return"),
    db: AsyncSession = Depends(get_session),
) -> list[AlarmFloodEventResponse]:
    """Return historical alarm flood events (most recent first).

    A flood event is triggered when > 10 alarms activate in any 10-minute
    window (EEMUA 191 benchmark). Flood events indicate:

    1. A major plant upset (multiple symptomatic alarms from one root cause)
    2. A chattering alarm generating rapid ON/OFF cycling
    3. Poor alarm design (too many alarms set at default priority/setpoint)

    EEMUA 191 target: zero flood events per month.
    When floods occur, a root cause analysis must be conducted within 5 days.
    """
    return await svc.get_flood_events(db, limit=limit)


@router.get(
    "/alarms/chatterers",
    response_model=ChatteringResponse,
    summary="Detect chattering alarms",
)
async def get_chatterers(
    window_minutes: int = Query(
        default=10,
        ge=5,
        le=60,
        description="Detection window in minutes (5-60 min)",
    ),
    threshold: int = Query(
        default=3,
        ge=2,
        le=20,
        description="Minimum ON/OFF transitions to classify as chattering",
    ),
    db: AsyncSession = Depends(get_session),
) -> ChatteringResponse:
    """Identify alarm tags with excessive ON/OFF cycling.

    Chattering alarms:
    - Distract operators from real alarms
    - Inflate alarm rate KPIs (masking real performance)
    - Can trigger false flood suppression

    EEMUA 191 §4.5: An alarm that transitions more than 3 times in any
    10-minute window is classified as chattering. Chattering alarms must
    be investigated and resolved — not simply shelved indefinitely.

    Recommended remedies (in order of preference):
    1. INVESTIGATE  : Verify process condition first — might be a real fault
    2. RAISE_DEADBAND : Increase hysteresis to reduce spurious trips
    3. SHELVE       : Temporary suppression while fix is implemented
    4. DISABLE      : Last resort — if alarm is permanently unfit for purpose
    """
    return await svc.detect_chatterers(
        db,
        window_minutes=window_minutes,
        threshold=threshold,
    )
