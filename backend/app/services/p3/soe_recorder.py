"""
Sequence of Events (SOE) Recorder service — M02.

Records and queries all significant events in the substation automation
system with millisecond-precision timestamps. Events are persisted to the
soe_event TimescaleDB hypertable for fast time-range queries.

Physics — Why SOE Recording is Critical
-----------------------------------------
After an offshore fault, a protection engineer has at most 72 hours before
weather windows close and the investigation must begin. The SOE log is the
primary forensic tool. It must:

  1. Record every event in strict chronological order (no re-ordering)
  2. Timestamp to at least 1 ms resolution (IEC 61850-7-2 time quality)
  3. Capture value transitions (OPEN → CLOSED, not just "changed")
  4. Include who commanded what (operator audit trail)
  5. Be queryable by time range, device, and event type

EEMUA 191 (alarm management) requires the SOE to support the calculation
of alarm performance KPIs — which is why event types include ALARM_RAISED,
ALARM_CLEARED, and ALARM_ACKED.

Standard: IEC 61850-7-2 time-stamped data, IEEE 1588 (PTP) time sync.
"""

from __future__ import annotations

import csv
import io
from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scada import SOEEvent
from app.schemas.soe import (
    SOEEventResponse,
    SOEEventTypeCount,
    SOEQueryResponse,
    SOEStatsResponse,
)

# ── Valid event types ──────────────────────────────────────────────

VALID_EVENT_TYPES: frozenset[str] = frozenset(
    {
        "PROTECTION_TRIP",
        "CB_OPERATION",
        "ALARM_RAISED",
        "ALARM_CLEARED",
        "ALARM_ACKED",
        "OPERATOR_COMMAND",
        "INTERLOCK_BLOCK",
        "STATE_CHANGE",
        "COMMS_LOSS",
        "COMMS_RESTORE",
    }
)

VALID_SEVERITIES: frozenset[str] = frozenset(
    {
        "CRITICAL",
        "HIGH",
        "MEDIUM",
        "LOW",
        "INFO",
    }
)

# Severity → colour for CSV export formatting
SEVERITY_COLOUR: dict[str, str] = {
    "CRITICAL": "RED",
    "HIGH": "AMBER",
    "MEDIUM": "YELLOW",
    "LOW": "GREEN",
    "INFO": "BLUE",
}


# ── Model → schema conversion ──────────────────────────────────────


def _row_to_response(row: SOEEvent) -> SOEEventResponse:
    return SOEEventResponse(
        id=row.id,
        timestamp_utc=row.timestamp_utc,
        event_type=row.event_type,
        source_device=row.source_device,
        description=row.description,
        value_before=row.value_before,
        value_after=row.value_after,
        operator_id=row.operator_id,
        severity=row.severity,
        acknowledged=row.acknowledged,
        ack_by=row.ack_by,
        ack_at=row.ack_at,
    )


# ── Service functions ──────────────────────────────────────────────


async def record_event(
    db: AsyncSession,
    *,
    event_type: str,
    source_device: str,
    description: str,
    severity: str = "INFO",
    value_before: str | None = None,
    value_after: str | None = None,
    operator_id: str | None = None,
    timestamp_utc: datetime | None = None,
) -> SOEEvent:
    """Persist a single SOE event to the database.

    Parameters
    ----------
    db : AsyncSession
        Active database session (injected by FastAPI dependency).
    event_type : str
        One of VALID_EVENT_TYPES.
    source_device : str
        Originating device or bay identifier.
    description : str
        Human-readable event description.
    severity : str
        CRITICAL / HIGH / MEDIUM / LOW / INFO.
    value_before : str | None
        Equipment state or measurement value before the event.
    value_after : str | None
        Equipment state or measurement value after the event.
    operator_id : str | None
        Operator identifier (None for automatic events).
    timestamp_utc : datetime | None
        Explicit timestamp — defaults to now(UTC) if not provided.

    Returns
    -------
    SOEEvent
        The persisted event row (with auto-generated id).
    """
    if event_type not in VALID_EVENT_TYPES:
        # Accept unknown types but normalise to STATE_CHANGE with a note
        description = f"[unknown type: {event_type}] {description}"
        event_type = "STATE_CHANGE"

    if severity not in VALID_SEVERITIES:
        severity = "INFO"

    event = SOEEvent(
        timestamp_utc=timestamp_utc or datetime.now(UTC),
        event_type=event_type,
        source_device=source_device,
        description=description,
        value_before=value_before,
        value_after=value_after,
        operator_id=operator_id,
        severity=severity,
        acknowledged=False,
        ack_by=None,
        ack_at=None,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


async def query_events(
    db: AsyncSession,
    *,
    start_utc: datetime | None = None,
    end_utc: datetime | None = None,
    event_types: list[str] | None = None,
    source_devices: list[str] | None = None,
    severities: list[str] | None = None,
    unacknowledged_only: bool = False,
    limit: int = 500,
) -> SOEQueryResponse:
    """Query SOE events with optional time and attribute filters.

    The TimescaleDB hypertable makes time-range queries very fast (uses
    chunk exclusion — only scans the relevant time partitions).

    Parameters
    ----------
    start_utc : datetime | None
        Start of time range. Defaults to 24 hours ago.
    end_utc : datetime | None
        End of time range. Defaults to now.
    event_types : list[str] | None
        Filter to specific event types.
    source_devices : list[str] | None
        Filter to specific devices.
    severities : list[str] | None
        Filter to specific severities.
    unacknowledged_only : bool
        If True, return only unacknowledged events.
    limit : int
        Max events to return (most recent first).
    """
    now = datetime.now(UTC)
    start = start_utc or (now - timedelta(hours=24))
    end = end_utc or now

    conditions = [
        SOEEvent.timestamp_utc >= start,
        SOEEvent.timestamp_utc <= end,
    ]

    if event_types:
        conditions.append(SOEEvent.event_type.in_(event_types))
    if source_devices:
        conditions.append(SOEEvent.source_device.in_(source_devices))
    if severities:
        conditions.append(SOEEvent.severity.in_(severities))
    if unacknowledged_only:
        conditions.append(SOEEvent.acknowledged == False)  # noqa: E712

    # Fetch up to limit + 1 to detect has_more
    q = (
        select(SOEEvent)
        .where(and_(*conditions))
        .order_by(desc(SOEEvent.timestamp_utc))
        .limit(limit + 1)
    )
    rows = list((await db.execute(q)).scalars())

    has_more = len(rows) > limit
    rows = rows[:limit]

    responses = [_row_to_response(r) for r in rows]
    return SOEQueryResponse(
        events=responses,
        total_returned=len(responses),
        has_more=has_more,
        oldest_timestamp=responses[-1].timestamp_utc if responses else None,
        newest_timestamp=responses[0].timestamp_utc if responses else None,
    )


async def acknowledge_event(
    db: AsyncSession,
    event_id: int,
    operator_id: str,
) -> SOEEventResponse:
    """Mark an SOE event as acknowledged by an operator.

    In a real substation, acknowledging an event signals to the SCADA
    system that the operator has seen it and is taking appropriate action.
    Unacknowledged events above a certain threshold trigger EEMUA 191
    alarm performance violations.

    Parameters
    ----------
    event_id : int
        SOE event ID.
    operator_id : str
        Operator performing the acknowledgement.

    Returns
    -------
    SOEEventResponse
        Updated event record.

    Raises
    ------
    ValueError
        If event not found.
    """
    row = await db.get(SOEEvent, event_id)
    if row is None:
        raise ValueError(f"SOE event {event_id} not found.")

    row.acknowledged = True
    row.ack_by = operator_id
    row.ack_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(row)
    return _row_to_response(row)


async def get_stats(
    db: AsyncSession,
    window_hours: float = 24.0,
) -> SOEStatsResponse:
    """Compute event statistics for the SOE log over a time window.

    Used by the SCADA KPI header to show:
      - Events per hour (EEMUA 191: < 10/10min in normal ops)
      - Count by event type (for trending)
      - Count by severity (for alarm management)
      - Most active device (for chattering detection)

    Parameters
    ----------
    window_hours : float
        Look-back period in hours. Default 24.
    """
    start = datetime.now(UTC) - timedelta(hours=window_hours)

    # Total count
    total_q = select(func.count()).select_from(SOEEvent).where(SOEEvent.timestamp_utc >= start)
    total = (await db.execute(total_q)).scalar_one()

    # By event type
    type_q = (
        select(SOEEvent.event_type, func.count().label("cnt"))
        .where(SOEEvent.timestamp_utc >= start)
        .group_by(SOEEvent.event_type)
        .order_by(desc("cnt"))
    )
    type_rows = list((await db.execute(type_q)).all())
    by_type = [SOEEventTypeCount(label=r[0], count=r[1]) for r in type_rows]

    # By severity
    sev_q = (
        select(SOEEvent.severity, func.count().label("cnt"))
        .where(SOEEvent.timestamp_utc >= start)
        .group_by(SOEEvent.severity)
        .order_by(desc("cnt"))
    )
    sev_rows = list((await db.execute(sev_q)).all())
    by_severity = [SOEEventTypeCount(label=r[0], count=r[1]) for r in sev_rows]

    # Unacknowledged
    unack_q = (
        select(func.count())
        .select_from(SOEEvent)
        .where(
            and_(SOEEvent.timestamp_utc >= start, SOEEvent.acknowledged == False)  # noqa: E712
        )
    )
    unack = (await db.execute(unack_q)).scalar_one()

    # Most active device
    device_q = (
        select(SOEEvent.source_device, func.count().label("cnt"))
        .where(SOEEvent.timestamp_utc >= start)
        .group_by(SOEEvent.source_device)
        .order_by(desc("cnt"))
        .limit(1)
    )
    device_row = (await db.execute(device_q)).first()
    most_active = device_row[0] if device_row else None

    return SOEStatsResponse(
        window_hours=window_hours,
        total_events=total,
        by_type=by_type,
        by_severity=by_severity,
        unacknowledged_count=unack,
        events_per_hour=total / window_hours if window_hours > 0 else 0.0,
        most_active_device=most_active,
    )


async def export_csv(
    db: AsyncSession,
    start_utc: datetime,
    end_utc: datetime,
    event_types: list[str] | None = None,
    source_devices: list[str] | None = None,
) -> str:
    """Generate a CSV export of SOE events for incident reports.

    Format: timestamp_utc, event_type, source_device, description,
            value_before, value_after, severity, operator_id,
            acknowledged, ack_by, ack_at

    The CSV is formatted for import into standard protection engineering
    tools and for inclusion in insurance/incident reports.

    Returns
    -------
    str
        CSV content as a string (UTF-8, comma-separated).
    """
    result = await query_events(
        db,
        start_utc=start_utc,
        end_utc=end_utc,
        event_types=event_types,
        source_devices=source_devices,
        limit=5000,
    )

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow(
        [
            "timestamp_utc",
            "event_type",
            "source_device",
            "description",
            "value_before",
            "value_after",
            "severity",
            "operator_id",
            "acknowledged",
            "ack_by",
            "ack_at",
        ]
    )

    for ev in result.events:
        writer.writerow(
            [
                ev.timestamp_utc.isoformat(),
                ev.event_type,
                ev.source_device,
                ev.description,
                ev.value_before or "",
                ev.value_after or "",
                ev.severity,
                ev.operator_id or "",
                str(ev.acknowledged),
                ev.ack_by or "",
                ev.ack_at.isoformat() if ev.ack_at else "",
            ]
        )

    return output.getvalue()
