"""
HV grid integration database models (P2A steady-state + P2B dynamic).

Tables
------
grid_network : Network configuration (base MVA, strings, export length, grid Ssc)
load_flow_result : Persisted load flow scenario results
short_circuit_result : Persisted IEC 60909 short-circuit results
frt_simulation_result : Fault ride-through simulation results (P2B)
frequency_response_result : Frequency response simulation results (P2B)
sso_screening_result : Sub-synchronous oscillation screening results (P2B)
dynamic_compliance_result : Overall NC RfG Type D dynamic compliance (P2B)
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
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
    frt_simulation_results: Mapped[list[FRTSimulationResult]] = relationship(
        back_populates="grid_network",
        cascade="all, delete-orphan",
    )
    frequency_response_results: Mapped[list[FrequencyResponseResult]] = relationship(
        back_populates="grid_network",
        cascade="all, delete-orphan",
    )
    sso_screening_results: Mapped[list[SSOScreeningResult]] = relationship(
        back_populates="grid_network",
        cascade="all, delete-orphan",
    )
    dynamic_compliance_results: Mapped[list[DynamicComplianceResult]] = relationship(
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


# ── P2B Dynamic Compliance Tables ────────────────────────────────


class FRTSimulationResult(Base):
    """Persisted fault ride-through simulation result.

    Records whether the wind farm stayed connected during LVRT/HVRT events,
    reactive current injection compliance (ΔIq ≥ 2% × ΔV), and active power
    recovery time per PSE IRiESP / NC RfG Type D.
    """

    __tablename__ = "frt_simulation_result"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    grid_network_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("grid_network.id", ondelete="CASCADE"),
    )
    frt_type: Mapped[str] = mapped_column(
        String(10),
        comment="'lvrt' or 'hvrt'",
    )
    stayed_connected: Mapped[bool] = mapped_column(
        comment="True if WTGs remained connected throughout fault",
    )
    reactive_current_compliant: Mapped[bool] = mapped_column(
        comment="True if dIq >= 2% x dV per NC RfG",
    )
    reactive_current_gain: Mapped[float] = mapped_column(
        Float,
        comment="Achieved Kqv gain [%Iq / %ΔV]",
    )
    recovery_time_s: Mapped[float] = mapped_column(
        Float,
        comment="Time to recover ≥90% active power after fault clearance [s]",
    )
    statcom_peak_q_mvar: Mapped[float] = mapped_column(
        Float,
        comment="Peak STATCOM reactive power during fault [MVAR]",
    )
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
    )

    # Relationships
    grid_network: Mapped[GridNetwork] = relationship(
        back_populates="frt_simulation_results",
    )


class FrequencyResponseResult(Base):
    """Persisted frequency response simulation result.

    Records compliance with NC RfG Type D frequency modes: LFSM-O, LFSM-U,
    FSM (droop), and RoCoF withstand capability.
    """

    __tablename__ = "frequency_response_result"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    grid_network_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("grid_network.id", ondelete="CASCADE"),
    )
    mode: Mapped[str] = mapped_column(
        String(20),
        comment="Frequency response mode: lfsm_o, lfsm_u, fsm, rocof",
    )
    frequency_step_hz: Mapped[float] = mapped_column(
        Float,
        comment="Applied frequency deviation [Hz]",
    )
    droop_percent: Mapped[float] = mapped_column(
        Float,
        comment="Droop setting [%] (R = 5% default)",
    )
    power_change_mw: Mapped[float] = mapped_column(
        Float,
        comment="Measured active power change [MW]",
    )
    compliant: Mapped[bool] = mapped_column(
        comment="True if response meets NC RfG Type D requirements",
    )
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
    )

    # Relationships
    grid_network: Mapped[GridNetwork] = relationship(
        back_populates="frequency_response_results",
    )


class SSOScreeningResult(Base):
    """Persisted sub-synchronous oscillation screening result.

    Records cable LC resonance frequency, impedance phase margin,
    eigenvalue damping, and overall SSO risk classification.
    """

    __tablename__ = "sso_screening_result"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    grid_network_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("grid_network.id", ondelete="CASCADE"),
    )
    resonance_frequency_hz: Mapped[float] = mapped_column(
        Float,
        comment="Cable LC resonance frequency [Hz]",
    )
    phase_margin_deg: Mapped[float] = mapped_column(
        Float,
        comment="Impedance phase margin at resonance [deg]",
    )
    stable: Mapped[bool] = mapped_column(
        comment="True if Re{Z(jω)} > 0 for all sub-synchronous frequencies",
    )
    risk_level: Mapped[str] = mapped_column(
        String(10),
        comment="SSO risk: 'low', 'medium', or 'high'",
    )
    minimum_damping_ratio: Mapped[float] = mapped_column(
        Float,
        comment="Minimum damping ratio of sub-synchronous eigenvalue modes",
    )
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
    )

    # Relationships
    grid_network: Mapped[GridNetwork] = relationship(
        back_populates="sso_screening_results",
    )


class DynamicComplianceResult(Base):
    """Persisted overall NC RfG Type D dynamic compliance assessment.

    Aggregates pass/fail for each compliance category (FRT, frequency,
    SSO) into a single overall_compliant verdict.
    """

    __tablename__ = "dynamic_compliance_result"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    grid_network_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("grid_network.id", ondelete="CASCADE"),
    )
    lvrt_compliant: Mapped[bool] = mapped_column(
        Boolean,
        comment="LVRT stayed connected + reactive current + recovery",
    )
    hvrt_compliant: Mapped[bool] = mapped_column(
        Boolean,
        comment="HVRT stayed connected at 1.25 pu for 100 ms",
    )
    lfsm_o_compliant: Mapped[bool] = mapped_column(
        Boolean,
        comment="LFSM-O: power reduction above 50.2 Hz",
    )
    lfsm_u_compliant: Mapped[bool] = mapped_column(
        Boolean,
        comment="LFSM-U: power increase below 49.8 Hz",
    )
    fsm_compliant: Mapped[bool] = mapped_column(
        Boolean,
        comment="FSM: droop response within tolerance",
    )
    rocof_compliant: Mapped[bool] = mapped_column(
        Boolean,
        comment="RoCoF: withstand 2 Hz/s for 500 ms",
    )
    sso_stable: Mapped[bool] = mapped_column(
        Boolean,
        comment="SSO: no unstable sub-synchronous modes",
    )
    overall_compliant: Mapped[bool] = mapped_column(
        Boolean,
        comment="True only if ALL individual checks pass",
    )
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
    )

    # Relationships
    grid_network: Mapped[GridNetwork] = relationship(
        back_populates="dynamic_compliance_results",
    )
