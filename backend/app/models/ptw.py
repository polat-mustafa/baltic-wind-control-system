"""
Permit-to-Work and audit trail database models (P3).

Tables
------
permit_to_work : PtW lifecycle records with status, risk, validity
ptw_transition_log : Append-only audit trail for every state transition
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

# Valid status values for CheckConstraint (matches PermitStatus enum)
_VALID_STATUSES = (
    "requested",
    "risk_assessed",
    "approved",
    "isolation_confirmed",
    "loto_applied",
    "active",
    "work_complete",
    "loto_removed",
    "closed",
    "cancelled",
)

_STATUS_CHECK = "status IN ({})".format(", ".join(f"'{s}'" for s in _VALID_STATUSES))


class PermitToWork(Base):
    """Permit-to-Work record for offshore HV operations.

    One row per permit. Tracks the 9-state lifecycle from REQUESTED
    through CLOSED (or CANCELLED). Validity period starts when the
    permit enters ACTIVE state (12-hour offshore shift standard).

    User fields are stored as strings — no foreign key to a users table
    because user management is outside the scope of P3 simulation.
    """

    __tablename__ = "permit_to_work"
    __table_args__ = (CheckConstraint(_STATUS_CHECK, name="ck_ptw_valid_status"),)

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    ptw_number: Mapped[str] = mapped_column(
        String(30),
        unique=True,
        comment="Human-readable permit number: BWA-PTW-{YEAR}-{SEQ:05d}",
    )
    status: Mapped[str] = mapped_column(
        String(25),
        default="requested",
        comment="Current lifecycle state (see PermitStatus enum)",
    )
    work_description: Mapped[str] = mapped_column(
        Text,
        comment="Description of the work to be performed",
    )
    equipment_id: Mapped[str] = mapped_column(
        String(50),
        comment="Equipment identifier (IED name, bay, cable section)",
    )

    # Risk assessment fields
    risk_level: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
        comment="Risk severity: low, medium, high, critical",
    )
    risk_categories: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Comma-separated risk categories",
    )
    control_measures: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Hazard control measures description",
    )

    # User fields (strings — no FK to users table)
    requested_by: Mapped[str] = mapped_column(
        String(100),
        comment="User who created the permit request",
    )
    person_in_charge: Mapped[str] = mapped_column(
        String(100),
        default="",
        comment="Person in Charge (PiC) responsible for work party",
    )
    approved_by: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Senior operator who approved the permit",
    )

    # Validity period (set when entering ACTIVE state)
    valid_from: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Start of 12-hour validity window (set at ACTIVE)",
    )
    valid_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="End of 12-hour validity window",
    )

    # Timestamps
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
    transition_log: Mapped[list[PTWTransitionLog]] = relationship(
        back_populates="permit",
        cascade="all, delete-orphan",
        order_by="PTWTransitionLog.created_at",
    )


class PTWTransitionLog(Base):
    """Append-only audit trail for PtW state transitions.

    Every state transition is recorded with the user, their RBAC level,
    timestamp, and optional notes. This log is immutable — entries are
    never modified or deleted.

    Required by IEC 62443-3-3 for traceability of all control actions
    and EN 50110-1 for LOTO procedure documentation.
    """

    __tablename__ = "ptw_transition_log"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    permit_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("permit_to_work.id", ondelete="CASCADE"),
    )
    from_status: Mapped[str] = mapped_column(
        String(25),
        comment="State before the transition",
    )
    to_status: Mapped[str] = mapped_column(
        String(25),
        comment="State after the transition",
    )
    performed_by: Mapped[str] = mapped_column(
        String(100),
        comment="User who performed the transition",
    )
    user_level: Mapped[int] = mapped_column(
        Integer,
        comment="RBAC level of the user (1-5)",
    )
    notes: Mapped[str] = mapped_column(
        Text,
        default="",
        comment="Optional notes or justification",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
    )

    # Relationships
    permit: Mapped[PermitToWork] = relationship(
        back_populates="transition_log",
    )
