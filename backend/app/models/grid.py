"""
HV grid integration database models (P2A — steady-state).

Tables
------
grid_network : Network configuration (base MVA, strings, export length, grid Ssc)
load_flow_result : Persisted load flow scenario results
short_circuit_result : Persisted IEC 60909 short-circuit results
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class GridNetwork(Base):
    """Grid network configuration — one row per network variant."""

    __tablename__ = "grid_network"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(100), comment="Network configuration name")
    base_mva: Mapped[float] = mapped_column(
        Float,
        default=100.0,
        comment="System base power [MVA] — Rule 2: per-unit consistent",
    )
    num_strings: Mapped[int] = mapped_column(
        Integer,
        default=6,
        comment="Number of array cable strings",
    )
    export_length_km: Mapped[float] = mapped_column(
        Float,
        default=45.0,
        comment="Export cable length [km]",
    )
    grid_ssc_mva: Mapped[float] = mapped_column(
        Float,
        default=10_000.0,
        comment="Grid short-circuit power at PCC [MVA]",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
    )

    # Relationships
    load_flow_results: Mapped[list[LoadFlowResult]] = relationship(
        back_populates="grid_network",
        cascade="all, delete-orphan",
    )
    short_circuit_results: Mapped[list[ShortCircuitResult]] = relationship(
        back_populates="grid_network",
        cascade="all, delete-orphan",
    )


class LoadFlowResult(Base):
    """Persisted load flow analysis result for a specific scenario.

    Stores summary metrics (v_min, v_max, loss, compliance) — per-element
    details are computed on-the-fly from Pandapower and returned in the API
    response but not persisted.
    """

    __tablename__ = "load_flow_result"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    grid_network_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("grid_network.id", ondelete="CASCADE"),
    )
    scenario: Mapped[str] = mapped_column(
        String(20),
        comment="Load flow scenario: full_load, partial_load, no_load, n_minus_1",
    )
    converged: Mapped[bool] = mapped_column(comment="Newton-Raphson convergence status")
    v_min_pu: Mapped[float] = mapped_column(Float, comment="Minimum bus voltage [p.u.]")
    v_max_pu: Mapped[float] = mapped_column(Float, comment="Maximum bus voltage [p.u.]")
    total_loss_mw: Mapped[float] = mapped_column(
        Float,
        comment="Total network active power losses [MW]",
    )
    voltage_compliant: Mapped[bool] = mapped_column(
        comment="True if all buses within 0.95-1.05 pu",
    )
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
    )

    # Relationships
    grid_network: Mapped[GridNetwork] = relationship(back_populates="load_flow_results")


class ShortCircuitResult(Base):
    """Persisted IEC 60909 short-circuit analysis result.

    Stores the maximum Ik'' and breaker adequacy — per-bus results are
    computed on-the-fly from Pandapower.
    """

    __tablename__ = "short_circuit_result"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    grid_network_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("grid_network.id", ondelete="CASCADE"),
    )
    case: Mapped[str] = mapped_column(
        String(10),
        comment="'max' (c=1.1) or 'min' (c=0.95)",
    )
    voltage_factor_c: Mapped[float] = mapped_column(
        Float,
        comment="IEC 60909 voltage factor c",
    )
    max_ikss_ka: Mapped[float] = mapped_column(
        Float,
        comment="Highest Ik'' across all buses [kA]",
    )
    max_ikss_bus: Mapped[str] = mapped_column(
        String(50),
        comment="Bus name with highest Ik''",
    )
    breaker_adequate: Mapped[bool] = mapped_column(
        comment="True if Ik'' within breaker rated breaking capacity",
    )
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
    )

    # Relationships
    grid_network: Mapped[GridNetwork] = relationship(back_populates="short_circuit_results")
