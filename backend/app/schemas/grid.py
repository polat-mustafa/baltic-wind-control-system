"""
Pydantic schemas for HV grid integration (P2A — steady-state).

Request and response models for load flow analysis, IEC 60909 short-circuit
calculations, and STATCOM reactive power compensation sizing.

Voltage Levels
--------------
- 66 kV: Array cables (WTG → OSS)
- 220 kV: Export cable (OSS → onshore)
- 400 kV: PSE grid connection point

Standards
---------
- IEC 60909: Short-circuit current calculation
- PSE IRiESP: Polish grid code voltage limits (0.95–1.05 pu)
- ENTSO-E NC RfG: Type D generating unit requirements
"""

import uuid
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field

# ── Enums ─────────────────────────────────────────────────────────


class LoadFlowScenario(StrEnum):
    """Load flow analysis scenarios per PSE IRiESP grid code requirements.

    Each scenario tests a different operating condition to ensure voltage
    compliance across the full operating envelope.
    """

    FULL_LOAD = "full_load"
    """All 34 WTGs at rated power (510 MW). Maximum active power export."""

    PARTIAL_LOAD = "partial_load"
    """50% generation (255 MW). Typical average operating condition."""

    NO_LOAD = "no_load"
    """0 MW generation. Tests Ferranti voltage rise on export cable."""

    N_MINUS_1 = "n_minus_1"
    """One feeder string out of service. Tests redundancy margins."""


# ── Load Flow Results ─────────────────────────────────────────────


class BusResult(BaseModel):
    """Per-bus voltage result from Newton-Raphson load flow."""

    name: str = Field(description="Bus name, e.g. 'OSS_66kV', 'WTG_01'")
    vn_kv: float = Field(description="Nominal voltage [kV]")
    vm_pu: float = Field(description="Voltage magnitude [p.u.]")
    va_deg: float = Field(description="Voltage angle [deg]")
    p_mw: float = Field(description="Net active power injection [MW]")
    q_mvar: float = Field(description="Net reactive power injection [MVAR]")


class LineResult(BaseModel):
    """Per-line/cable result from load flow."""

    name: str = Field(description="Cable/line name")
    from_bus: str = Field(description="From bus name")
    to_bus: str = Field(description="To bus name")
    loading_percent: float = Field(description="Thermal loading [%]")
    p_from_mw: float = Field(description="Active power at from-bus [MW]")
    q_from_mvar: float = Field(description="Reactive power at from-bus [MVAR]")
    pl_mw: float = Field(description="Active power losses [MW]")
    ql_mvar: float = Field(description="Reactive power losses [MVAR]")


class TransformerResult(BaseModel):
    """Per-transformer result from load flow."""

    name: str = Field(description="Transformer name")
    loading_percent: float = Field(description="Thermal loading [%]")
    p_hv_mw: float = Field(description="Active power at HV side [MW]")
    q_hv_mvar: float = Field(description="Reactive power at HV side [MVAR]")
    pl_mw: float = Field(description="Active power losses [MW]")
    ql_mvar: float = Field(description="Reactive power losses [MVAR]")


class LoadFlowResponse(BaseModel):
    """Complete load flow analysis result for a single scenario.

    Includes per-element results plus summary metrics for voltage compliance
    assessment per PSE IRiESP (0.95–1.05 pu).
    """

    model_config = {"from_attributes": True}

    scenario: LoadFlowScenario = Field(description="Operating scenario analysed")
    converged: bool = Field(description="Newton-Raphson convergence status")
    v_min_pu: float = Field(description="Minimum bus voltage [p.u.]")
    v_max_pu: float = Field(description="Maximum bus voltage [p.u.]")
    total_loss_mw: float = Field(description="Total network active power losses [MW]")
    total_generation_mw: float = Field(description="Total active power generation [MW]")
    voltage_compliant: bool = Field(
        description="True if all buses within 0.95-1.05 pu per PSE IRiESP"
    )
    buses: list[BusResult] = Field(default_factory=list, description="Per-bus results")
    lines: list[LineResult] = Field(default_factory=list, description="Per-line/cable results")
    transformers: list[TransformerResult] = Field(
        default_factory=list, description="Per-transformer results"
    )


# ── Short-Circuit Results (IEC 60909) ────────────────────────────


class ShortCircuitBusResult(BaseModel):
    """IEC 60909 short-circuit result at a single bus.

    Ik'' = initial symmetrical short-circuit current [kA]
    ip   = peak short-circuit current [kA]
    Ith  = thermal equivalent short-circuit current [kA]
    """

    bus_name: str = Field(description="Bus name")
    vn_kv: float = Field(description="Nominal voltage [kV]")
    ikss_ka: float = Field(description="Initial symmetrical short-circuit current Ik'' [kA]")
    ip_ka: float = Field(description="Peak short-circuit current ip [kA]")
    skss_mw: float = Field(description="Short-circuit power Sk'' [MVA]")


class ShortCircuitResponse(BaseModel):
    """Complete IEC 60909 short-circuit analysis result.

    Contains max (c=1.1) and min (c=0.95) cases for breaker sizing
    and protection coordination.
    """

    model_config = {"from_attributes": True}

    case: str = Field(description="'max' (c=1.1) or 'min' (c=0.95)")
    voltage_factor_c: float = Field(description="IEC 60909 voltage factor c")
    bus_results: list[ShortCircuitBusResult] = Field(
        default_factory=list, description="Per-bus short-circuit results"
    )
    max_ikss_ka: float = Field(description="Highest Ik'' across all buses [kA]")
    max_ikss_bus: str = Field(description="Bus with highest Ik''")
    breaker_adequate: bool = Field(
        description="True if all Ik'' values within breaker rated breaking capacity"
    )


# ── STATCOM Sizing Results ────────────────────────────────────────


class STATCOMSizingResult(BaseModel):
    """STATCOM and reactive power compensation sizing result.

    Calculates cable capacitive reactive power generation (Q = ωCV²L),
    Ferranti voltage rise, and required STATCOM rating with margins.
    """

    model_config = {"from_attributes": True}

    cable_q_mvar: float = Field(
        description="Export cable capacitive reactive power generation [MVAR]"
    )
    reactor_q_mvar: float = Field(description="Shunt reactor absorption capacity [MVAR]")
    ferranti_rise_pu: float = Field(
        description="Ferranti voltage rise at OSS without compensation [p.u.]"
    )
    statcom_rating_mvar: float = Field(description="Required STATCOM rating (±) [MVAR]")
    statcom_q_range_min_mvar: float = Field(
        description="STATCOM minimum Q (absorbing, negative) [MVAR]"
    )
    statcom_q_range_max_mvar: float = Field(
        description="STATCOM maximum Q (generating, positive) [MVAR]"
    )
    compensation_adequate: bool = Field(
        description="True if voltage compliant with compensation enabled"
    )
    without_compensation_v_max_pu: float = Field(
        description="Max voltage without any compensation [p.u.] — validates necessity"
    )


# ── Persistence Response (for API) ───────────────────────────────


class GridNetworkResponse(BaseModel):
    """Response schema for a persisted grid network configuration."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    base_mva: float
    num_strings: int
    export_length_km: float
    grid_ssc_mva: float
    created_at: datetime


class LoadFlowResultResponse(BaseModel):
    """Response schema for a persisted load flow result."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    grid_network_id: uuid.UUID
    scenario: str
    converged: bool
    v_min_pu: float
    v_max_pu: float
    total_loss_mw: float
    voltage_compliant: bool
    calculated_at: datetime


class ShortCircuitResultResponse(BaseModel):
    """Response schema for a persisted short-circuit result."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    grid_network_id: uuid.UUID
    case: str
    voltage_factor_c: float
    max_ikss_ka: float
    max_ikss_bus: str
    breaker_adequate: bool
    calculated_at: datetime
