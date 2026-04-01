"""
Bay controller database models (M01 — Interlock Engine).

Tables
------
bay              : OSS bay registry (one row per switchboard bay)
bay_state_snapshot : Point-in-time snapshots of bay equipment states

Physics — Why Persist Bay State?
----------------------------------
The primary bay state is held in Redis for sub-millisecond SCADA reads.
However, the DB snapshot provides:
  1. Audit trail — every state change is traceable to an operator command
  2. Post-fault analysis — reconstruct equipment positions at fault time
  3. Startup recovery — restore last known state if SCADA server restarts

The bay state includes positions for: CB, two disconnectors, earth switch,
and the protection relay arming state. Together they define whether the
bay is energised, isolated, earthed, or in a partial switching sequence.

Standard: IEC 61850-7-4 XCBR (CB), XSWI (disconnector), CILO (interlock)
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Bay(Base):
    """OSS bay registry — one row per switchboard bay.

    Baltic Wind Alpha OSS has 8 bays on the 66 kV switchboard:
      BAY-OSS-66-01 to 06: String feeders (each feeding 5–6 WTGs)
      BAY-OSS-66-07: Transformer LV side (66/220 kV step-up)
      BAY-OSS-66-08: Bus coupler (tie CB for parallel busbar operation)

    State is stored in Redis for real-time access and snapshotted here
    for audit trail and fault analysis.
    """

    __tablename__ = "bay"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
        comment="Bay UUID — stable identifier used in API and Redis key",
    )
    name: Mapped[str] = mapped_column(
        String(30),
        unique=True,
        comment="Bay identifier, e.g. 'BAY-OSS-66-01'",
    )
    display_name: Mapped[str] = mapped_column(
        String(100),
        comment="Human-readable label, e.g. 'String 1 Feeder'",
    )
    voltage_kv: Mapped[float] = mapped_column(
        Float,
        comment="Nominal bay voltage [kV]",
    )
    bay_type: Mapped[str] = mapped_column(
        String(20),
        comment="Bay type: FEEDER / TRANSFORMER / BUS_COUPLER / GENERATOR",
    )
    is_tie_cb: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        comment="True if CB is a bus coupler/tie requiring synchrocheck (ILK-007)",
    )
    description: Mapped[str] = mapped_column(
        Text,
        default="",
        comment="Engineering description of connected equipment",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
    )


class BayStateSnapshot(Base):
    """Point-in-time snapshot of a bay's equipment positions.

    Written after every successful switching command. Provides full
    audit trail: who commanded what, when, and what state resulted.

    The combination of bay_id + timestamp_utc uniquely identifies a
    bay state at a specific moment — used for fault reconstruction.
    """

    __tablename__ = "bay_state_snapshot"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    bay_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        comment="Bay this snapshot belongs to (FK to bay.id — enforced in app layer)",
    )
    timestamp_utc: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        comment="UTC time of this state snapshot",
    )
    cb_state: Mapped[str] = mapped_column(
        String(15),
        comment="CB position: open/closed/tripped/failed/intermediate",
    )
    disconnector_bus: Mapped[str] = mapped_column(
        String(15),
        comment="Busbar disconnector position: open/closed/intermediate",
    )
    disconnector_line: Mapped[str] = mapped_column(
        String(15),
        comment="Line disconnector position: open/closed/intermediate",
    )
    earth_switch: Mapped[str] = mapped_column(
        String(15),
        comment="Earth switch position: open/closed",
    )
    relay_state: Mapped[str] = mapped_column(
        String(10),
        comment="Protection relay state: armed/tripped/blocked/test",
    )
    bay_mode: Mapped[str] = mapped_column(
        String(15),
        comment="Bay operational mode: local/remote/maintenance",
    )
    manual_isolation_active: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        comment="True if PTW or tag-out is in place for this bay",
    )
    operator_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Operator who triggered this state change (None for system events)",
    )
    trigger_command: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Command that caused this snapshot, e.g. 'close_cb'",
    )
