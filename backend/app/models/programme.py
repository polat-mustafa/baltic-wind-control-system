"""
Persistence models for P5 commissioning domain objects.

Tables
------
switching_programme : Full programme state with JSONB for nested structures
fat_campaign : Factory Acceptance Test campaign with JSONB results
protection_grading_result : Protection relay selectivity results

Design Decision — JSONB vs Relational
--------------------------------------
The P5 domain objects (SwitchingProgramme, FATCampaign) contain deeply nested
state: 30 SwitchingStep dataclasses, LOTO sets with isolation points, audit
trails, and test results. Normalising these into 10+ relational tables would
add complexity with no query benefit — we always load and save the entire
object as a unit (the "aggregate" pattern from DDD).

JSONB columns let us store the full nested state in PostgreSQL while still
allowing indexed queries on the scalar columns (status, pic_name, etc.).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class SwitchingProgrammeModel(Base):
    """Persistent storage for SwitchingProgramme domain objects.

    Scalar columns enable filtering and ordering without parsing JSON.
    JSONB columns store the rich nested state (steps, equipment, LOTO, audit).
    """

    __tablename__ = "switching_programme"

    programme_id: Mapped[str] = mapped_column(
        String(100),
        primary_key=True,
        comment="Domain-generated ID (e.g. PROG-20260310-A1B2C3)",
    )
    title: Mapped[str] = mapped_column(
        String(200),
        comment="Programme title",
    )
    pic_name: Mapped[str] = mapped_column(
        String(100),
        comment="Person in Control (PiC)",
    )
    status: Mapped[str] = mapped_column(
        String(25),
        comment="Lifecycle: created, approved, in_progress, hold, completed, aborted",
    )
    current_step_index: Mapped[int] = mapped_column(
        Integer,
        default=0,
        comment="Index of next step to execute (0-based)",
    )
    fat_campaign_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Linked FAT campaign ID (if any)",
    )
    steps: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB,
        comment="Serialised list of SwitchingStep dataclasses",
    )
    system_state: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        comment="Equipment ID → EquipmentState mapping",
    )
    loto_set: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Serialised LOTOSet with isolation points",
    )
    audit_trail: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB,
        comment="Serialised list of AuditRecord dataclasses",
    )
    sat_campaign: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Serialised SATCampaign (if created)",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        comment="UTC creation timestamp",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        comment="UTC last-modified timestamp",
    )


class FATCampaignModel(Base):
    """Persistent storage for FATCampaign domain objects.

    Specs are immutable (loaded from FAT_SPECS constant), so we store them
    alongside results in JSONB for self-contained snapshots.
    """

    __tablename__ = "fat_campaign"

    campaign_id: Mapped[str] = mapped_column(
        String(100),
        primary_key=True,
        comment="Domain-generated ID (e.g. FAT-20260310-A1B2C3)",
    )
    equipment_tag: Mapped[str] = mapped_column(
        String(100),
        comment="Equipment under test (e.g. TX-OSS-01)",
    )
    status: Mapped[str] = mapped_column(
        String(25),
        comment="Lifecycle: created, in_progress, completed, approved",
    )
    specs: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        comment="Serialised dict of TestSpecification dataclasses",
    )
    results: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        comment="Serialised dict of TestResult dataclasses",
    )
    approved_by: Mapped[str] = mapped_column(
        String(100),
        default="",
        comment="Approver name (empty until approved)",
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="UTC approval timestamp",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        comment="UTC creation timestamp",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        comment="UTC last-modified timestamp",
    )


class ProtectionGradingModel(Base):
    """Persistent storage for protection relay grading results.

    Each row stores a complete grading run (all relay pairs checked).
    Results are immutable — a new row is created for each verification run.
    """

    __tablename__ = "protection_grading_result"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    results: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB,
        comment="Serialised list of GradingResult dataclasses",
    )
    notes: Mapped[str] = mapped_column(
        Text,
        default="",
        comment="Optional notes for this grading run",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        comment="UTC timestamp of grading run",
    )
