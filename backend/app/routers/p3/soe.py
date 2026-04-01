"""
Sequence of Events (SOE) recorder API endpoints — M02.

Endpoints
---------
GET  /api/v1/scada/soe               — Query SOE log (time range + filters)
GET  /api/v1/scada/soe/stats         — Event counts by type/severity
GET  /api/v1/scada/soe/export        — Export to CSV for incident reports
POST /api/v1/scada/soe/{id}/acknowledge — Operator acknowledges an event

The SOE log is the primary forensic tool after a fault.
All events are stored in the soe_event TimescaleDB hypertable with
microsecond-precision UTC timestamps.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.schemas.soe import (
    SOEAckRequest,
    SOEEventResponse,
    SOEQueryResponse,
    SOEStatsResponse,
)
from app.services.p3 import soe_recorder as svc

router = APIRouter(tags=["M02 SOE Recorder"])


@router.get("/soe", response_model=SOEQueryResponse, summary="Query SOE log")
async def query_soe(
    start_utc: datetime | None = Query(default=None, description="Start of time range (ISO 8601)"),
    end_utc: datetime | None = Query(default=None, description="End of time range (ISO 8601)"),
    event_type: list[str] | None = Query(default=None, description="Filter by event type(s)"),
    source_device: list[str] | None = Query(default=None, description="Filter by device(s)"),
    severity: list[str] | None = Query(default=None, description="Filter by severity level(s)"),
    unacknowledged_only: bool = Query(
        default=False, description="Return only unacknowledged events"
    ),
    limit: int = Query(default=500, ge=1, le=5000, description="Max events (most recent first)"),
    db: AsyncSession = Depends(get_session),
) -> SOEQueryResponse:
    """Query the Sequence of Events log with optional filters.

    Returns events in reverse chronological order (most recent first).
    For a 24-hour window with no filters, expect 100–500 events in a
    normally operating wind farm.

    Physics: Events are timestamped to microsecond precision using the
    station clock synchronised via IEEE 1588 PTP (Precision Time Protocol).
    All IEDs in the OSS share the same time reference to within 1 µs.
    This allows accurate determination of fault clearance times and
    protection selectivity verification.
    """
    return await svc.query_events(
        db,
        start_utc=start_utc,
        end_utc=end_utc,
        event_types=event_type,
        source_devices=source_device,
        severities=severity,
        unacknowledged_only=unacknowledged_only,
        limit=limit,
    )


@router.get("/soe/stats", response_model=SOEStatsResponse, summary="SOE statistics")
async def get_soe_stats(
    window_hours: float = Query(
        default=24.0,
        ge=1.0,
        le=168.0,
        description="Look-back window in hours (1-168 h)",
    ),
    db: AsyncSession = Depends(get_session),
) -> SOEStatsResponse:
    """Return SOE event statistics for the specified time window.

    Returns event counts by type and severity, events-per-hour rate,
    unacknowledged count, and the most active device.

    Used by:
      - SCADA KPI header badge counts
      - EEMUA 191 alarm performance dashboard (M09)
      - Chattering alarm detection

    EEMUA 191 benchmark: < 10 alarms per 10-minute period in normal
    operation. The events_per_hour metric helps identify alarm floods.
    """
    return await svc.get_stats(db, window_hours=window_hours)


@router.get("/soe/export", summary="Export SOE log to CSV")
async def export_soe_csv(
    start_utc: datetime = Query(description="Start of export range (ISO 8601)"),
    end_utc: datetime = Query(description="End of export range (ISO 8601)"),
    event_type: list[str] | None = Query(default=None),
    source_device: list[str] | None = Query(default=None),
    db: AsyncSession = Depends(get_session),
) -> Response:
    """Export SOE events as a CSV file for incident reports.

    The CSV can be imported into:
      - Protection engineering tools (CAPE, DIgSILENT)
      - Insurance claim documentation
      - IEC 61850 event analysis tools

    Format: timestamp_utc, event_type, source_device, description,
            value_before, value_after, severity, operator_id,
            acknowledged, ack_by, ack_at

    Returns
    -------
    CSV file download (Content-Type: text/csv)
    """
    csv_content = await svc.export_csv(
        db,
        start_utc=start_utc,
        end_utc=end_utc,
        event_types=event_type,
        source_devices=source_device,
    )

    filename = (
        f"soe_export_{start_utc.strftime('%Y%m%d_%H%M%S')}"
        f"_to_{end_utc.strftime('%Y%m%d_%H%M%S')}.csv"
    )

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post(
    "/soe/{event_id}/acknowledge",
    response_model=SOEEventResponse,
    summary="Acknowledge an SOE event",
)
async def acknowledge_event(
    event_id: int,
    body: SOEAckRequest,
    db: AsyncSession = Depends(get_session),
) -> SOEEventResponse:
    """Mark an SOE event as acknowledged by the operator.

    Acknowledgement records who saw the event and when. EEMUA 191
    tracks the percentage of events actioned by operators — the target
    is > 80% (robust) or > 90% (best practice).

    An acknowledged event is still visible in the SOE log but flagged
    as seen. It does NOT clear an associated alarm.

    Parameters
    ----------
    event_id : int
        SOE event ID from the log.
    body.operator_id : str
        Operator performing the acknowledgement.
    """
    return await svc.acknowledge_event(db, event_id=event_id, operator_id=body.operator_id)
