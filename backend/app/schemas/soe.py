"""
Pydantic schemas for the Sequence of Events (SOE) recorder API — M02.

Request/response models for:
  - SOE log queries (time range + device/type filters)
  - Event acknowledgement
  - CSV export
  - Statistics by event type and severity
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

# ── Event response ────────────────────────────────────────────────


class SOEEventResponse(BaseModel):
    """A single SOE log entry.

    Returned by GET /api/v1/scada/soe and POST .../acknowledge
    """

    id: int = Field(description="Sequential event ID — strict chronological ordering")
    timestamp_utc: datetime = Field(description="UTC event timestamp (microsecond precision)")
    event_type: str = Field(
        description=(
            "PROTECTION_TRIP / CB_OPERATION / ALARM_RAISED / ALARM_CLEARED / "
            "ALARM_ACKED / OPERATOR_COMMAND / INTERLOCK_BLOCK / STATE_CHANGE / "
            "COMMS_LOSS / COMMS_RESTORE"
        )
    )
    source_device: str = Field(description="Originating device, e.g. 'OSS_66kV_Bay01_CB'")
    description: str = Field(description="Human-readable event description")
    value_before: str | None = Field(default=None, description="State/value before event")
    value_after: str | None = Field(default=None, description="State/value after event")
    operator_id: str | None = Field(default=None, description="Operator ID for commanded events")
    severity: str = Field(description="CRITICAL / HIGH / MEDIUM / LOW / INFO")
    acknowledged: bool
    ack_by: str | None = None
    ack_at: datetime | None = None


# ── Query parameters ──────────────────────────────────────────────


class SOEQueryResponse(BaseModel):
    """Response for SOE log queries."""

    events: list[SOEEventResponse]
    total_returned: int
    has_more: bool = Field(
        description="True if there are more events matching the filter beyond the limit"
    )
    oldest_timestamp: datetime | None = None
    newest_timestamp: datetime | None = None


# ── Acknowledgement ───────────────────────────────────────────────


class SOEAckRequest(BaseModel):
    """Request body for POST /api/v1/scada/soe/{id}/acknowledge."""

    operator_id: str = Field(
        description="Operator acknowledging the event",
        examples=["operator_kaan"],
    )


# ── Statistics ────────────────────────────────────────────────────


class SOEEventTypeCount(BaseModel):
    """Count of events for a single type/severity."""

    label: str
    count: int


class SOEStatsResponse(BaseModel):
    """Event statistics for the SOE log.

    Returned by GET /api/v1/scada/soe/stats
    Used to populate the SCADA KPI header and alarm rate dashboards.
    """

    window_hours: float = Field(description="Time window these stats cover")
    total_events: int
    by_type: list[SOEEventTypeCount]
    by_severity: list[SOEEventTypeCount]
    unacknowledged_count: int
    events_per_hour: float = Field(description="Average event rate over the window")
    most_active_device: str | None = Field(
        default=None,
        description="Device with the highest event count in the window",
    )


# ── CSV export ────────────────────────────────────────────────────
