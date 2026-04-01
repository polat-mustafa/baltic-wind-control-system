"""
Alarm management database models — M09 (EEMUA 191).

Tables
------
alarm         : Alarm registry with state, priority, and rationalization data
alarm_event   : TimescaleDB hypertable — every state transition with timestamp
alarm_flood   : Periods where alarm rate exceeded EEMUA 191 flood threshold
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Alarm(Base):
    """Alarm registry entry.

    One row per alarm tag. State transitions (ACTIVE/CLEARED/ACK) are
    recorded in alarm_event for time-series analysis.

    EEMUA 191 Alarm Priority Classification
    -----------------------------------------
    CRITICAL  : Action within 1 minute — equipment damage or personnel risk
    HIGH      : Action within 10 minutes
    MEDIUM    : Action within 1 hour
    LOW       : Action within 24 hours
    ADVISORY  : Informational — no action required

    EEMUA 191 Rationalization Requirements
    ----------------------------------------
    Every alarm must have documented:
    - Cause: what condition triggers the alarm
    - Consequence: what happens if the operator does not respond
    - Operator action: what the operator should do
    - Setpoint/priority: technically justified, not defaulted

    rationalization_status values:
    - RATIONALIZED : reviewed, justified, documented
    - PENDING      : needs review
    - NEEDS_UPDATE : setpoint or priority changed — needs re-review
    - SUPPRESSED   : disabled by management decision (with justification)
    """

    __tablename__ = "alarm"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    tag: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        comment="Alarm tag name, e.g. 'BAY01_CB_OPEN_UNEXPECTED'",
    )
    display_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="Human-readable alarm name shown in SCADA",
    )
    priority: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="MEDIUM",
        comment="EEMUA 191 priority: CRITICAL / HIGH / MEDIUM / LOW / ADVISORY",
    )
    source_device: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Originating device, e.g. 'BAY-OSS-66-01'",
    )
    state: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="NORMAL",
        comment="Current alarm state: NORMAL / ACTIVE / ACKNOWLEDGED / SUPPRESSED",
    )
    cause: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
        comment="EEMUA 191 §4.2: documented cause of this alarm",
    )
    consequence: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
        comment="EEMUA 191 §4.2: consequence of non-response",
    )
    operator_action: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
        comment="EEMUA 191 §4.2: required operator response",
    )
    shelved: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="True if alarm is temporarily shelved by operator",
    )
    shelved_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="UTC time when shelve expires (auto-unshelves after this)",
    )
    shelve_reason: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
        comment="Operator reason for shelving",
    )
    shelved_by: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Operator who shelved the alarm",
    )
    rationalization_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="PENDING",
        comment="RATIONALIZED / PENDING / NEEDS_UPDATE / SUPPRESSED",
    )
    chattering_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="ON/OFF transitions in last 10 minutes — chattering if > 3",
    )
    flood_suppressed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="True if suppressed during an alarm flood event",
    )
    ack_by: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Last operator to acknowledge",
    )
    ack_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="UTC time of last acknowledgement",
    )
    activated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="UTC time the alarm entered ACTIVE state",
    )
    cleared_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="UTC time the alarm returned to NORMAL",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
    )


class AlarmEvent(Base):
    """Alarm state-change event log — TimescaleDB hypertable.

    Every alarm transition (NORMAL→ACTIVE, ACTIVE→ACK, ACTIVE→NORMAL,
    NORMAL→SUPPRESSED) is recorded here for EEMUA 191 KPI calculation.

    KPIs calculated from this table:
    - Alarms per 10 minutes (EEMUA 191 benchmark: < 10 in normal ops)
    - Standing alarm count (persistent alarms that never clear)
    - % alarms acknowledged within 10 minutes of activation
    - Chattering alarm rate (per-tag ON/OFF count in rolling window)
    - Alarm flood frequency and duration

    In production this table is a TimescaleDB hypertable.
    Alembic migration must include:
        SELECT create_hypertable('alarm_event', 'timestamp_utc');
    """

    __tablename__ = "alarm_event"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Sequential event ID",
    )
    timestamp_utc: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="UTC event timestamp (TimescaleDB partition key)",
    )
    alarm_tag: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
        comment="Alarm tag this event belongs to",
    )
    transition: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        comment=(
            "State transition: NORMAL_TO_ACTIVE / ACTIVE_TO_ACK / "
            "ACTIVE_TO_NORMAL / ACK_TO_NORMAL / SHELVED / UNSHELVED"
        ),
    )
    operator_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Operator who performed the action (None for automatic transitions)",
    )
    priority: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        comment="Alarm priority at time of event",
    )
    source_device: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )


class AlarmFloodEvent(Base):
    """A period of alarm flooding.

    EEMUA 191 defines a flood as > 10 alarms per 10-minute period.
    When a flood is detected, low-priority alarms may be automatically
    suppressed to reduce operator workload (flood management strategy).
    """

    __tablename__ = "alarm_flood_event"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    start_utc: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="UTC time the flood began",
    )
    end_utc: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="UTC time the flood ended (None if still active)",
    )
    alarm_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Total alarms activated during the flood",
    )
    peak_rate_per_minute: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        comment="Maximum observed alarm rate [alarms/minute] during flood",
    )
    suppressed_alarms: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Number of low-priority alarms auto-suppressed during flood",
    )
    resolved: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="True if alarm rate has returned below flood threshold",
    )
