"""
Alarm rationalization and management service — M09 (EEMUA 191).

Manages the alarm lifecycle, calculates EEMUA 191 performance KPIs,
and detects alarm system pathologies (chattering, flooding).

Physics — EEMUA 191 Alarm Management
--------------------------------------
EEMUA 191 'Alarm Systems: A Guide to Design, Management and Procurement'
(3rd edition, 2013) is the de-facto standard for alarm system design in
process industries, including offshore wind.

The standard defines three performance categories based on alarm rate:

  Very manageable : < 1 alarm / 10 min  — operator can respond to all
  Manageable      : 1–10 alarms / 10 min — some alarms may be missed
  Overloaded      : > 10 alarms / 10 min — alarm flood condition

An alarm flood occurs when:
  1. One large fault triggers a cascade of symptomatic alarms
  2. A single chattering tag generates rapid ON/OFF cycling
  3. A weather event simultaneously affects many devices

Flood Management Strategies
-----------------------------
  1. Flood suppression: automatically hide low-priority alarms during flood
  2. Shelving: operator hides a known-bad alarm for up to 72 h
  3. Chattering suppression: auto-shelve alarms with > 3 transitions/10 min
  4. State-based annunciation: only show alarms relevant to current plant state

Chattering Definition (per EEMUA 191 §4.5)
--------------------------------------------
An alarm is chattering if it has > 3 ON/OFF transitions in any 10-minute
rolling window. Chattering alarms consume operator attention without
providing actionable information and must be investigated immediately.

Standard: EEMUA 191 (3rd edition, 2013), ISA-18.2-2016 Alarm Management.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alarm import Alarm, AlarmEvent, AlarmFloodEvent
from app.schemas.alarm import (
    AlarmFloodEventResponse,
    AlarmKPIResponse,
    AlarmRateDataPoint,
    AlarmRationalizationDetail,
    AlarmResponse,
    ChatteringAlarm,
    ChatteringResponse,
    RationalizationUpdateRequest,
)

# EEMUA 191 thresholds
FLOOD_THRESHOLD_PER_10_MIN: int = 10
CHATTERING_TRANSITIONS_THRESHOLD: int = 3
CHATTERING_WINDOW_MINUTES: int = 10

# Alarm priority ordering for flood suppression (lowest priority suppressed first)
PRIORITY_ORDER: dict[str, int] = {
    "CRITICAL": 5,
    "HIGH": 4,
    "MEDIUM": 3,
    "LOW": 2,
    "ADVISORY": 1,
}


# ── Model → schema conversion ────────────────────────────────────


def _row_to_response(row: Alarm) -> AlarmResponse:
    return AlarmResponse(
        id=row.id,
        tag=row.tag,
        display_name=row.display_name,
        priority=row.priority,
        source_device=row.source_device,
        state=row.state,
        shelved=row.shelved,
        shelved_until=row.shelved_until,
        shelve_reason=row.shelve_reason,
        rationalization_status=row.rationalization_status,
        chattering_count=row.chattering_count,
        flood_suppressed=row.flood_suppressed,
        ack_by=row.ack_by,
        ack_at=row.ack_at,
        activated_at=row.activated_at,
        cleared_at=row.cleared_at,
    )


# ── Alarm registry queries ────────────────────────────────────────


async def list_alarms(
    db: AsyncSession,
    *,
    state: str | None = None,
    priority: str | None = None,
    source_device: str | None = None,
    shelved_only: bool = False,
    active_only: bool = False,
) -> list[AlarmResponse]:
    """Return alarms from the registry with optional filters."""
    conditions = []
    if state:
        conditions.append(Alarm.state == state)
    if priority:
        conditions.append(Alarm.priority == priority)
    if source_device:
        conditions.append(Alarm.source_device == source_device)
    if shelved_only:
        conditions.append(Alarm.shelved == True)  # noqa: E712
    if active_only:
        conditions.append(Alarm.state.in_(["ACTIVE", "ACKNOWLEDGED"]))

    q = select(Alarm)
    if conditions:
        q = q.where(and_(*conditions))
    q = q.order_by(
        # Sort by priority (critical first), then by activation time
        Alarm.state.desc(),
        Alarm.activated_at.desc().nulls_last(),
    )
    rows = list((await db.execute(q)).scalars())
    return [_row_to_response(r) for r in rows]


async def get_alarm(db: AsyncSession, alarm_id: uuid.UUID) -> AlarmResponse:
    """Get a single alarm by ID."""
    row = await db.get(Alarm, alarm_id)
    if row is None:
        raise ValueError(f"Alarm {alarm_id} not found")
    return _row_to_response(row)


# ── Shelving ──────────────────────────────────────────────────────


async def shelve_alarm(
    db: AsyncSession,
    alarm_id: uuid.UUID,
    operator_id: str,
    reason: str,
    duration_hours: float,
) -> AlarmResponse:
    """Shelve an alarm for a defined duration.

    Shelving temporarily hides an alarm from the active alarm list.
    The shelve expires automatically after duration_hours.

    EEMUA 191 §4.4: Shelving requires documented justification and
    is limited to 72 hours before mandatory review.

    An alarm_event record is written with transition=SHELVED for the
    audit trail.
    """
    row = await db.get(Alarm, alarm_id)
    if row is None:
        raise ValueError(f"Alarm {alarm_id} not found")

    now = datetime.now(UTC)
    row.shelved = True
    row.shelved_until = now + timedelta(hours=duration_hours)
    row.shelve_reason = reason
    row.shelved_by = operator_id

    event = AlarmEvent(
        timestamp_utc=now,
        alarm_tag=row.tag,
        transition="SHELVED",
        operator_id=operator_id,
        priority=row.priority,
        source_device=row.source_device,
    )
    db.add(event)
    await db.commit()
    await db.refresh(row)
    return _row_to_response(row)


async def unshelve_alarm(
    db: AsyncSession,
    alarm_id: uuid.UUID,
    operator_id: str,
) -> AlarmResponse:
    """Manually unshelve an alarm before its scheduled expiry."""
    row = await db.get(Alarm, alarm_id)
    if row is None:
        raise ValueError(f"Alarm {alarm_id} not found")

    row.shelved = False
    row.shelved_until = None
    row.shelve_reason = ""

    event = AlarmEvent(
        timestamp_utc=datetime.now(UTC),
        alarm_tag=row.tag,
        transition="UNSHELVED",
        operator_id=operator_id,
        priority=row.priority,
        source_device=row.source_device,
    )
    db.add(event)
    await db.commit()
    await db.refresh(row)
    return _row_to_response(row)


# ── EEMUA 191 KPIs ───────────────────────────────────────────────


async def get_kpis(
    db: AsyncSession,
    window_hours: float = 24.0,
) -> AlarmKPIResponse:
    """Compute EEMUA 191 alarm management KPIs over a time window.

    Calculates:
    - Average and peak alarm rate per 10-minute interval
    - Standing alarm count
    - Acknowledgement response rate
    - Chattering alarm count
    - Flood event count

    Parameters
    ----------
    window_hours : float
        Look-back window in hours (1-168 h). Default 24.
    """
    now = datetime.now(UTC)
    window_start = now - timedelta(hours=window_hours)

    # ── Total events in window ────────────────────────────────────
    total_q = (
        select(func.count())
        .select_from(AlarmEvent)
        .where(
            and_(
                AlarmEvent.timestamp_utc >= window_start,
                AlarmEvent.transition == "NORMAL_TO_ACTIVE",
            )
        )
    )
    total_activations = (await db.execute(total_q)).scalar_one() or 0

    # ── Standing (currently active) alarms ────────────────────────
    standing_q = (
        select(func.count()).select_from(Alarm).where(Alarm.state.in_(["ACTIVE", "ACKNOWLEDGED"]))
    )
    standing = (await db.execute(standing_q)).scalar_one() or 0

    # ── Shelved alarms ────────────────────────────────────────────
    shelved_q = (
        select(func.count())
        .select_from(Alarm)
        .where(
            Alarm.shelved == True  # noqa: E712
        )
    )
    shelved = (await db.execute(shelved_q)).scalar_one() or 0

    # ── Unacknowledged active alarms ──────────────────────────────
    unack_q = (
        select(func.count())
        .select_from(Alarm)
        .where(
            and_(Alarm.state == "ACTIVE", Alarm.ack_at == None)  # noqa: E711
        )
    )
    unack = (await db.execute(unack_q)).scalar_one() or 0

    # ── Flood events in window ────────────────────────────────────
    flood_q = (
        select(func.count())
        .select_from(AlarmFloodEvent)
        .where(AlarmFloodEvent.start_utc >= window_start)
    )
    flood_count = (await db.execute(flood_q)).scalar_one() or 0

    # ── Chattering alarms ─────────────────────────────────────────
    chattering_q = (
        select(func.count())
        .select_from(Alarm)
        .where(Alarm.chattering_count > CHATTERING_TRANSITIONS_THRESHOLD)
    )
    chattering = (await db.execute(chattering_q)).scalar_one() or 0

    # ── Rationalization progress ──────────────────────────────────
    total_alarms_q = select(func.count()).select_from(Alarm)
    total_alarms = (await db.execute(total_alarms_q)).scalar_one() or 1

    rationalized_q = (
        select(func.count())
        .select_from(Alarm)
        .where(Alarm.rationalization_status == "RATIONALIZED")
    )
    rationalized = (await db.execute(rationalized_q)).scalar_one() or 0
    rationalized_pct = round(100.0 * rationalized / max(total_alarms, 1), 1)

    # ── Alarm rate history (10-min buckets) ───────────────────────
    window_minutes = window_hours * 60.0
    n_buckets = min(int(window_minutes / 10), 144)  # max 144 buckets (24h)

    rate_history: list[AlarmRateDataPoint] = []
    peak_rate = 0.0
    for i in range(n_buckets):
        bucket_start = window_start + timedelta(minutes=i * 10)
        bucket_end = bucket_start + timedelta(minutes=10)
        bucket_q = (
            select(func.count())
            .select_from(AlarmEvent)
            .where(
                and_(
                    AlarmEvent.timestamp_utc >= bucket_start,
                    AlarmEvent.timestamp_utc < bucket_end,
                    AlarmEvent.transition == "NORMAL_TO_ACTIVE",
                )
            )
        )
        count = (await db.execute(bucket_q)).scalar_one() or 0
        rate = float(count)
        peak_rate = max(peak_rate, rate)
        rate_history.append(
            AlarmRateDataPoint(
                interval_start_utc=bucket_start,
                alarm_count=count,
                rate_per_10_min=rate,
                above_benchmark=rate > FLOOD_THRESHOLD_PER_10_MIN,
            )
        )

    # ── Acknowledgement rate ──────────────────────────────────────
    # Approximate: fraction of alarms in window that have ack_at set
    acked_in_window_q = (
        select(func.count())
        .select_from(AlarmEvent)
        .where(
            and_(
                AlarmEvent.timestamp_utc >= window_start,
                AlarmEvent.transition == "ACTIVE_TO_ACK",
            )
        )
    )
    acked = (await db.execute(acked_in_window_q)).scalar_one() or 0
    pct_acked = round(100.0 * acked / max(total_activations, 1), 1)

    # ── Average rate ──────────────────────────────────────────────
    n_periods = max(window_hours * 6.0, 1.0)  # number of 10-min periods
    avg_rate = round(total_activations / n_periods, 2)

    # ── EEMUA 191 benchmark evaluation ───────────────────────────
    rate_ok = avg_rate < 1.0
    peak_ok = peak_rate < float(FLOOD_THRESHOLD_PER_10_MIN)
    ack_ok = pct_acked >= 80.0

    benchmarks_met = sum([rate_ok, peak_ok, ack_ok])
    if benchmarks_met == 3:
        overall_grade = "GOOD"
    elif benchmarks_met >= 2:
        overall_grade = "ACCEPTABLE"
    else:
        overall_grade = "POOR"

    return AlarmKPIResponse(
        window_hours=window_hours,
        total_alarms_in_window=total_activations,
        average_rate_per_10_min=avg_rate,
        peak_rate_per_10_min=round(peak_rate, 2),
        standing_alarms=standing,
        shelved_alarms=shelved,
        unacknowledged_alarms=unack,
        pct_acknowledged_within_10min=pct_acked,
        chattering_alarm_count=chattering,
        flood_events_in_window=flood_count,
        rationalized_pct=rationalized_pct,
        rate_benchmark_met=rate_ok,
        peak_benchmark_met=peak_ok,
        ack_benchmark_met=ack_ok,
        overall_grade=overall_grade,
        alarm_rate_history=rate_history,
    )


# ── Chattering detection ──────────────────────────────────────────


async def detect_chatterers(
    db: AsyncSession,
    window_minutes: int = CHATTERING_WINDOW_MINUTES,
    threshold: int = CHATTERING_TRANSITIONS_THRESHOLD,
) -> ChatteringResponse:
    """Identify alarm tags with excessive ON/OFF cycling.

    Counts NORMAL_TO_ACTIVE and ACTIVE_TO_NORMAL transitions per tag
    in the rolling window. Tags exceeding threshold are flagged.

    EEMUA 191 §4.5: Chattering alarms must be investigated and either:
    - Deadband raised (if noise is causing spurious trips)
    - Setpoint adjusted (if process variation is too close to threshold)
    - Suppressed (if alarm is no longer fit for purpose)
    """
    cutoff = datetime.now(UTC) - timedelta(minutes=window_minutes)

    # Count ON/OFF transitions per tag
    transition_q = (
        select(AlarmEvent.alarm_tag, func.count().label("cnt"))
        .where(
            and_(
                AlarmEvent.timestamp_utc >= cutoff,
                AlarmEvent.transition.in_(["NORMAL_TO_ACTIVE", "ACTIVE_TO_NORMAL"]),
            )
        )
        .group_by(AlarmEvent.alarm_tag)
        .having(func.count() > threshold)
        .order_by(desc("cnt"))
    )
    rows = list((await db.execute(transition_q)).all())

    chattering: list[ChatteringAlarm] = []
    for alarm_tag, count in rows:
        # Look up alarm details
        alarm_q = select(Alarm).where(Alarm.tag == alarm_tag)
        alarm_row = (await db.execute(alarm_q)).scalar_one_or_none()
        if alarm_row is None:
            continue

        transitions = int(count)
        if transitions > 10:
            recommendation = "DISABLE"
        elif transitions > 6:
            recommendation = "SHELVE"
        elif transitions > 4:
            recommendation = "RAISE_DEADBAND"
        else:
            recommendation = "INVESTIGATE"

        chattering.append(
            ChatteringAlarm(
                tag=alarm_tag,
                display_name=alarm_row.display_name,
                source_device=alarm_row.source_device,
                priority=alarm_row.priority,
                transition_count=transitions,
                window_minutes=window_minutes,
                recommendation=recommendation,
            )
        )

    return ChatteringResponse(
        window_minutes=window_minutes,
        chattering_alarms=chattering,
        total_chattering_tags=len(chattering),
        threshold_transitions=threshold,
    )


# ── Flood events ──────────────────────────────────────────────────


async def get_flood_events(
    db: AsyncSession,
    limit: int = 50,
) -> list[AlarmFloodEventResponse]:
    """Return historical alarm flood events (most recent first)."""
    q = select(AlarmFloodEvent).order_by(desc(AlarmFloodEvent.start_utc)).limit(limit)
    rows = list((await db.execute(q)).scalars())

    results = []
    for r in rows:
        duration = None
        if r.end_utc is not None:
            duration = round((r.end_utc - r.start_utc).total_seconds() / 60.0, 1)
        results.append(
            AlarmFloodEventResponse(
                id=r.id,
                start_utc=r.start_utc,
                end_utc=r.end_utc,
                duration_minutes=duration,
                alarm_count=r.alarm_count,
                peak_rate_per_minute=r.peak_rate_per_minute,
                suppressed_alarms=r.suppressed_alarms,
                resolved=r.resolved,
            )
        )
    return results


# ── Rationalization matrix ────────────────────────────────────────


async def get_rationalization_matrix(
    db: AsyncSession,
    status_filter: str | None = None,
) -> list[AlarmRationalizationDetail]:
    """Return the full alarm rationalization matrix.

    Each row shows the EEMUA 191 §4.2 documentation status for one alarm:
    cause, consequence, operator action, priority justification.

    Parameters
    ----------
    status_filter : str | None
        Filter by rationalization_status: RATIONALIZED / PENDING / NEEDS_UPDATE
    """
    q = select(Alarm)
    if status_filter:
        q = q.where(Alarm.rationalization_status == status_filter)
    q = q.order_by(Alarm.rationalization_status, Alarm.tag)
    rows = list((await db.execute(q)).scalars())

    return [
        AlarmRationalizationDetail(
            id=r.id,
            tag=r.tag,
            display_name=r.display_name,
            priority=r.priority,
            cause=r.cause,
            consequence=r.consequence,
            operator_action=r.operator_action,
            rationalization_status=r.rationalization_status,
        )
        for r in rows
    ]


async def update_rationalization(
    db: AsyncSession,
    alarm_id: uuid.UUID,
    updates: RationalizationUpdateRequest,
) -> AlarmRationalizationDetail:
    """Update EEMUA 191 rationalization data for an alarm."""
    row = await db.get(Alarm, alarm_id)
    if row is None:
        raise ValueError(f"Alarm {alarm_id} not found")

    if updates.cause is not None:
        row.cause = updates.cause
    if updates.consequence is not None:
        row.consequence = updates.consequence
    if updates.operator_action is not None:
        row.operator_action = updates.operator_action
    if updates.priority is not None:
        row.priority = updates.priority
    if updates.rationalization_status is not None:
        row.rationalization_status = updates.rationalization_status

    await db.commit()
    await db.refresh(row)

    return AlarmRationalizationDetail(
        id=row.id,
        tag=row.tag,
        display_name=row.display_name,
        priority=row.priority,
        cause=row.cause,
        consequence=row.consequence,
        operator_action=row.operator_action,
        rationalization_status=row.rationalization_status,
    )


# ── Detect flood ──────────────────────────────────────────────────


async def detect_flood(
    db: AsyncSession,
    window_seconds: int = 600,
) -> bool:
    """Check if current alarm rate exceeds the flood threshold.

    Returns True if more than FLOOD_THRESHOLD_PER_10_MIN alarms have
    activated in the last window_seconds. Caller should create an
    AlarmFloodEvent record if True and no current flood is active.

    Parameters
    ----------
    window_seconds : int
        Detection window in seconds (default 600 = 10 minutes).
    """
    cutoff = datetime.now(UTC) - timedelta(seconds=window_seconds)
    q = (
        select(func.count())
        .select_from(AlarmEvent)
        .where(
            and_(
                AlarmEvent.timestamp_utc >= cutoff,
                AlarmEvent.transition == "NORMAL_TO_ACTIVE",
            )
        )
    )
    count = (await db.execute(q)).scalar_one() or 0
    return int(count) > FLOOD_THRESHOLD_PER_10_MIN


async def expire_shelved_alarms(db: AsyncSession) -> int:
    """Auto-unshelve alarms whose shelve duration has expired.

    Called periodically (e.g. every 5 minutes) from a background task.

    Returns
    -------
    int
        Number of alarms unshelved.
    """
    now = datetime.now(UTC)
    stmt = (
        update(Alarm)
        .where(
            and_(
                Alarm.shelved == True,  # noqa: E712
                Alarm.shelved_until != None,  # noqa: E711
                Alarm.shelved_until <= now,
            )
        )
        .values(shelved=False, shelved_until=None, shelve_reason="")
    )
    result = await db.execute(stmt)
    await db.commit()
    return int(result.rowcount)  # type: ignore[attr-defined]
