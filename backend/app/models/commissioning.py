"""
Commissioning database models (P5).

Tables
------
switching_programme_record : Audit trail for 30-step switching programmes
commissioning_event : Timestamped event log for FAT/SAT/grid-code campaigns
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class SwitchingProgrammeRecord(Base):
    """Audit record for a switching programme execution.

    One row per programme. Tracks the 30-step switching sequence
    from initial isolation through energisation and synchronisation.
    Immutable after creation — follows the same append-only audit
    pattern as PTWTransitionLog (IEC 62443 compliance).
    """

    __tablename__ = "switching_programme_record"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    wind_farm_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("wind_farm.id", ondelete="CASCADE"),
        comment="Wind farm this programme belongs to",
    )
    programme_name: Mapped[str] = mapped_column(
        String(100),
        comment="Human-readable programme identifier",
    )
    status: Mapped[str] = mapped_column(
        String(25),
        default="created",
        comment="Programme status: created, in_progress, completed, aborted",
    )
    total_steps: Mapped[int] = mapped_column(
        Integer,
        default=30,
        comment="Total number of steps in the programme",
    )
    completed_steps: Mapped[int] = mapped_column(
        Integer,
        default=0,
        comment="Number of steps completed so far",
    )
    pic_name: Mapped[str] = mapped_column(
        String(100),
        comment="Person in Control (PiC) for this programme",
    )
    notes: Mapped[str] = mapped_column(
        Text,
        default="",
        comment="Operational notes and observations",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
        onupdate=datetime.now,
    )

    # Relationships
    events: Mapped[list[CommissioningEvent]] = relationship(
        back_populates="programme",
        cascade="all, delete-orphan",
        order_by="CommissioningEvent.created_at",
    )


class CommissioningEvent(Base):
    """Timestamped event for commissioning audit trail.

    Covers FAT, SAT, grid-code compliance, and emergency events.
    Each event is append-only — never modified or deleted.
    Required by IEC 62443-3-3 for traceability.
    """

    __tablename__ = "commissioning_event"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    programme_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("switching_programme_record.id", ondelete="CASCADE"),
    )
    event_type: Mapped[str] = mapped_column(
        String(30),
        comment="Event category: step_executed, pic_decision, loto, fat, sat, emergency",
    )
    step_number: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Switching programme step number (if applicable)",
    )
    performed_by: Mapped[str] = mapped_column(
        String(100),
        comment="User who performed the action",
    )
    description: Mapped[str] = mapped_column(
        Text,
        comment="Human-readable event description",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
    )

    # Relationships
    programme: Mapped[SwitchingProgrammeRecord] = relationship(
        back_populates="events",
    )
