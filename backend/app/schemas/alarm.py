"""
Pydantic schemas for the alarm rationalization API — M09 (EEMUA 191).

Request/response models for:
  - Alarm registry queries
  - EEMUA 191 KPI metrics
  - Alarm shelving with audit trail
  - Chattering detection
  - Flood event records
  - Rationalization matrix
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

# ── Alarm state ───────────────────────────────────────────────────


class AlarmResponse(BaseModel):
    """A single alarm entry from the registry."""

    id: uuid.UUID
    tag: str
    display_name: str
    priority: str = Field(description="CRITICAL / HIGH / MEDIUM / LOW / ADVISORY")
    source_device: str
    state: str = Field(description="NORMAL / ACTIVE / ACKNOWLEDGED / SUPPRESSED")
    shelved: bool
    shelved_until: datetime | None = None
    shelve_reason: str
    rationalization_status: str = Field(
        description="RATIONALIZED / PENDING / NEEDS_UPDATE / SUPPRESSED"
    )
    chattering_count: int = Field(description="ON/OFF transitions in last 10 minutes")
    flood_suppressed: bool
    ack_by: str | None = None
    ack_at: datetime | None = None
    activated_at: datetime | None = None
    cleared_at: datetime | None = None


class AlarmRationalizationDetail(BaseModel):
    """Full rationalization data for an alarm (EEMUA 191 §4.2)."""

    id: uuid.UUID
    tag: str
    display_name: str
    priority: str
    cause: str = Field(description="Documented cause of this alarm")
    consequence: str = Field(description="Consequence of non-response")
    operator_action: str = Field(description="Required operator response steps")
    rationalization_status: str


# ── Shelving ──────────────────────────────────────────────────────


class AlarmShelveRequest(BaseModel):
    """Request to shelve an alarm for a defined duration."""

    operator_id: str = Field(description="Operator performing the shelve action")
    reason: str = Field(
        description="Justification for shelving — required for audit trail",
        min_length=10,
    )
    duration_hours: float = Field(
        ge=0.5,
        le=72.0,
        description="Shelve duration in hours (0.5 h to 72 h). Auto-unshelves after expiry.",
    )


class AlarmUnshelveRequest(BaseModel):
    """Request to manually unshelve an alarm before its expiry."""

    operator_id: str = Field(description="Operator performing the unshelve action")


# ── EEMUA 191 KPIs ────────────────────────────────────────────────


class AlarmRateDataPoint(BaseModel):
    """Alarm rate for a single 10-minute interval."""

    interval_start_utc: datetime
    alarm_count: int
    rate_per_10_min: float = Field(description="Alarms per 10-minute period")
    above_benchmark: bool = Field(description="True if > 10 alarms/10-min (EEMUA benchmark)")


class AlarmKPIResponse(BaseModel):
    """EEMUA 191 real-time alarm management KPIs.

    EEMUA 191 benchmark targets:
    - Average alarm rate    : < 1 alarm/10 min (very manageable)
    - Peak alarm rate       : < 10 alarms/10 min (manageable)
    - Standing alarms       : < 10 (alarms that never clear)
    - % alarms actioned     : > 80% acknowledged within 10 min (robust),
                              > 90% (best practice)
    - Chattering alarms     : 0 (alarms that toggle > 3× in 10 min)
    - Flood events          : 0 per month
    """

    window_hours: float
    total_alarms_in_window: int
    average_rate_per_10_min: float = Field(
        description="Average alarm rate over the window [alarms/10 min]"
    )
    peak_rate_per_10_min: float = Field(description="Maximum alarm rate in any 10-minute interval")
    standing_alarms: int = Field(description="Alarms currently in ACTIVE state (not cleared)")
    shelved_alarms: int = Field(description="Alarms currently shelved")
    unacknowledged_alarms: int = Field(description="Alarms in ACTIVE state with no acknowledgement")
    pct_acknowledged_within_10min: float = Field(
        description="Percentage of alarms acknowledged within 10 minutes of activation"
    )
    chattering_alarm_count: int = Field(
        description="Number of alarm tags with > 3 ON/OFF transitions in any 10-min window"
    )
    flood_events_in_window: int = Field(
        description="Number of alarm flood events (> 10 alarms/10 min)"
    )
    rationalized_pct: float = Field(
        description="Percentage of alarm registry entries with RATIONALIZED status"
    )
    # EEMUA 191 benchmark evaluation
    rate_benchmark_met: bool = Field(
        description="True if average rate < 1 alarm/10 min (very manageable)"
    )
    peak_benchmark_met: bool = Field(description="True if peak rate < 10 alarms/10 min")
    ack_benchmark_met: bool = Field(description="True if >= 80% alarms acknowledged within 10 min")
    overall_grade: str = Field(
        description="GOOD (all benchmarks met), ACCEPTABLE, or POOR (< 2 benchmarks met)"
    )
    alarm_rate_history: list[AlarmRateDataPoint] = Field(
        default_factory=list,
        description="Alarm rate per 10-minute interval over the window",
    )


# ── Chattering detection ──────────────────────────────────────────


class ChatteringAlarm(BaseModel):
    """An alarm tag with excessive ON/OFF cycling."""

    tag: str
    display_name: str
    source_device: str
    priority: str
    transition_count: int = Field(description="ON/OFF transitions in the detection window")
    window_minutes: int = Field(description="Detection window length [min]")
    recommendation: str = Field(
        description="Suggested action: INVESTIGATE / RAISE_DEADBAND / SHELVE / DISABLE"
    )


class ChatteringResponse(BaseModel):
    """Chattering alarm detection results."""

    window_minutes: int
    chattering_alarms: list[ChatteringAlarm]
    total_chattering_tags: int = Field(
        description="Number of tags exceeding the chattering threshold"
    )
    threshold_transitions: int = Field(
        description="ON/OFF transition count threshold used for detection"
    )


# ── Flood events ──────────────────────────────────────────────────


class AlarmFloodEventResponse(BaseModel):
    """A historical alarm flood event."""

    id: uuid.UUID
    start_utc: datetime
    end_utc: datetime | None = None
    duration_minutes: float | None = Field(
        default=None, description="Flood duration [minutes]. None if still active."
    )
    alarm_count: int
    peak_rate_per_minute: float
    suppressed_alarms: int
    resolved: bool


# ── Rationalization matrix ────────────────────────────────────────


class RationalizationUpdateRequest(BaseModel):
    """Update the EEMUA 191 rationalization data for an alarm."""

    cause: str | None = None
    consequence: str | None = None
    operator_action: str | None = None
    priority: str | None = Field(
        default=None,
        description="CRITICAL / HIGH / MEDIUM / LOW / ADVISORY",
    )
    rationalization_status: str | None = Field(
        default=None,
        description="RATIONALIZED / PENDING / NEEDS_UPDATE / SUPPRESSED",
    )
