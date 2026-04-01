"""
Protection relay database models — M05.

Tables
------
protection_relay : Physical relay registry with settings
coordination_study_result : TCC study outcomes
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class ProtectionRelay(Base):
    """Physical protection relay record.

    One row per relay IED or functional element in the OSS or WTG array.
    Settings are stored as individual columns (not JSONB) for easy querying
    and validation against IEC 60255 limits.

    Relay Types (IEC 61850-7-4 LN classes)
    ----------------------------------------
    PTOC : Time overcurrent — detects cable/transformer faults
    PDIS : Distance — primary protection for the 45 km export cable
    PTOV : Overvoltage — disconnects WTGs above 1.15 pu
    PTUV : Undervoltage — FRT initiation trigger at 0.80 pu
    PTOF : Overfrequency — disconnects at 51.5 Hz
    PTUF : Underfrequency — disconnects at 47.5 Hz
    PDIF : Differential — 87T transformer protection (biased)
    """

    __tablename__ = "protection_relay"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    setting_id: Mapped[str] = mapped_column(
        String(30),
        unique=True,
        nullable=False,
        comment="Relay setting ID matching protection_relay.py registry, e.g. 'PTOC-01'",
    )
    relay_type: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        comment="IEC 61850-7-4 LN class: PTOC / PDIS / PTOV / PTUV / PTOF / PTUF / PDIF",
    )
    location: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Physical location, e.g. 'String feeder bay', 'Export cable OSS end'",
    )
    manufacturer: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="ABB",
        comment="Relay manufacturer, e.g. 'ABB', 'Siemens', 'SEL'",
    )
    model: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="REL670",
        comment="Relay model number, e.g. 'REL670', '7SL87'",
    )
    pickup_value: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        comment="Relay pickup threshold in pickup_unit",
    )
    pickup_unit: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Unit of pickup value: xIn / pu / Hz / %_reach",
    )
    time_delay_s: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        comment="Operating time delay in seconds (for DT relays, this is the definite time)",
    )
    tms: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.1,
        comment="Time Multiplier Setting (IEC 60255-151 IDMT curve scaling)",
    )
    curve_type: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="DT",
        comment="IEC 60255-151 curve: SI (Standard Inverse) / VI / EI / DT (Definite Time)",
    )
    enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        comment="False if relay is disabled for maintenance",
    )
    standard_ref: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="IEC 60255-151",
        comment="Applicable IEC standard",
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
        comment="Human-readable relay description",
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


class CoordinationStudyResult(Base):
    """TCC coordination study result.

    Records the output of a protection coordination study — which relay
    trips first for a given fault location and magnitude, and whether
    all downstream relays have adequate grading margins above upstream.

    A study is considered fully graded if every grading pair has an
    actual margin >= required margin (300 ms for PTOC, 400 ms for PDIS).
    """

    __tablename__ = "coordination_study_result"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    fault_location: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment=(
            "Fault location description, e.g. 'String feeder cable, 80% from OSS' "
            "or 'Export cable, 15 km from OSS'"
        ),
    )
    fault_current_ka: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        comment="Symmetrical 3-phase fault current at the fault location [kA]",
    )
    first_relay_id: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        comment="Setting ID of the first relay to trip",
    )
    first_relay_time_ms: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        comment="Operating time of the first relay [ms]",
    )
    fully_graded: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        comment="True if all grading pairs have adequate margin",
    )
    relay_sequence: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="JSON: list of {relay_id, trip_time_ms} in trip order",
    )
    grading_violations: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Number of grading pairs with insufficient margin",
    )
    study_notes: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
    )
