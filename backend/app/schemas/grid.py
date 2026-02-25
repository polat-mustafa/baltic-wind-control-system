"""
Pydantic schemas for HV grid integration (P2A steady-state + P2B dynamic).

Request and response models for load flow analysis, IEC 60909 short-circuit
calculations, STATCOM reactive power compensation sizing, fault ride-through,
frequency response, SSO screening, and converter comparison.

Voltage Levels
--------------
- 66 kV: Array cables (WTG → OSS)
- 220 kV: Export cable (OSS → onshore)
- 400 kV: PSE grid connection point

Standards
---------
- IEC 60909: Short-circuit current calculation
- PSE IRiESP: Polish grid code voltage limits (0.95–1.05 pu)
- ENTSO-E NC RfG: Type D generating unit requirements (FRT, frequency, SSO)
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


# ── P2B Dynamic Compliance Enums ─────────────────────────────────


class FRTType(StrEnum):
    """Fault ride-through event type."""

    LVRT = "lvrt"
    """Low-voltage ride-through: voltage dip to ≤0.15 pu."""

    HVRT = "hvrt"
    """High-voltage ride-through: voltage swell to 1.25 pu."""


class FrequencyMode(StrEnum):
    """NC RfG Type D frequency response mode."""

    LFSM_O = "lfsm_o"
    """Limited frequency sensitive mode — overfrequency (>50.2 Hz)."""

    LFSM_U = "lfsm_u"
    """Limited frequency sensitive mode — underfrequency (<49.8 Hz)."""

    FSM = "fsm"
    """Frequency sensitive mode — droop-based (R = 5% default)."""

    ROCOF = "rocof"
    """Rate of change of frequency withstand (2 Hz/s for 500 ms)."""


class SSOGRiskLevel(StrEnum):
    """Sub-synchronous oscillation risk classification."""

    LOW = "low"
    """Strong grid, high damping — no SSO concern."""

    MEDIUM = "medium"
    """Moderate damping — monitoring recommended."""

    HIGH = "high"
    """Weak grid, low damping — mitigation required."""


class ConverterType(StrEnum):
    """Converter control strategy."""

    GFL = "gfl"
    """Grid-following: PLL-based current source (REGCA1/REECA1)."""

    GFM = "gfm"
    """Grid-forming: virtual synchronous machine, voltage source."""


# ── P2B FRT Simulation Response ──────────────────────────────────


class FRTTimePoint(BaseModel):
    """Single time-series data point from FRT simulation."""

    time_s: float = Field(description="Simulation time [s]")
    voltage_pu: float = Field(description="PCC voltage magnitude [p.u.]")
    active_power_mw: float = Field(description="Active power at PCC [MW]")
    reactive_power_mvar: float = Field(description="Reactive power at PCC [MVAR]")
    reactive_current_pu: float = Field(description="Reactive current injection [p.u.]")


class FRTSimulationResponse(BaseModel):
    """Complete fault ride-through simulation result.

    Contains time-series data, compliance verdicts for reactive current
    injection and active power recovery, plus the PSE voltage envelope.
    """

    model_config = {"from_attributes": True}

    frt_type: FRTType = Field(description="LVRT or HVRT")
    fault_bus: str = Field(description="Bus where fault was applied")
    fault_duration_s: float = Field(description="Fault duration [s]")
    stayed_connected: bool = Field(description="WTGs remained connected")
    reactive_current_compliant: bool = Field(description="dIq >= 2% x dV per NC RfG")
    reactive_current_gain: float = Field(description="Achieved Kqv gain [%Iq / %ΔV]")
    recovery_time_s: float = Field(description="Time to recover ≥90% active power [s]")
    recovery_compliant: bool = Field(description="Recovery within 1s of fault clearance")
    statcom_peak_q_mvar: float = Field(
        description="Peak STATCOM reactive power during fault [MVAR]"
    )
    time_series: list[FRTTimePoint] = Field(
        default_factory=list,
        description="Time-domain simulation data",
    )


# ── P2B Frequency Response ──────────────────────────────────────


class FrequencyResponseResponse(BaseModel):
    """Frequency response simulation result for a single mode.

    Contains the measured power change, expected change from droop formula,
    and compliance verdict per NC RfG Type D.
    """

    model_config = {"from_attributes": True}

    mode: FrequencyMode = Field(description="Frequency response mode")
    frequency_step_hz: float = Field(description="Applied frequency deviation [Hz]")
    droop_percent: float = Field(description="Droop setting R [%]")
    initial_power_mw: float = Field(description="Pre-disturbance active power [MW]")
    final_power_mw: float = Field(description="Post-disturbance active power [MW]")
    power_change_mw: float = Field(description="Measured ΔP [MW]")
    expected_power_change_mw: float = Field(description="Expected ΔP from droop formula [MW]")
    compliant: bool = Field(description="Meets NC RfG Type D requirements")
    stable: bool = Field(description="System remained stable during event")


# ── P2B SSO Screening ───────────────────────────────────────────


class EigenvalueMode(BaseModel):
    """Single eigenvalue mode from ANDES eigenvalue analysis."""

    real: float = Field(description="Real part sigma [1/s]")
    imaginary: float = Field(description="Imaginary part omega [rad/s]")
    frequency_hz: float = Field(description="Oscillation frequency [Hz]")
    damping_ratio: float = Field(description="Damping ratio ζ [-]")
    is_subsynchronous: bool = Field(description="True if f < 50 Hz")


class SSOScreeningResponse(BaseModel):
    """Sub-synchronous oscillation screening result.

    Contains cable resonance analysis, impedance scan results,
    eigenvalue modes, and risk classification.
    """

    model_config = {"from_attributes": True}

    export_length_km: float = Field(description="Export cable length [km]")
    grid_ssc_mva: float = Field(description="Grid short-circuit power [MVA]")
    resonance_frequency_hz: float = Field(description="Cable LC resonance frequency [Hz]")
    phase_margin_deg: float = Field(description="Impedance phase margin at resonance [deg]")
    stable: bool = Field(description="Re{Z(jω)} > 0 for all sub-synchronous ω")
    risk_level: SSOGRiskLevel = Field(description="SSO risk classification")
    minimum_damping_ratio: float = Field(description="Min damping in sub-synchronous range")
    critical_modes: list[EigenvalueMode] = Field(
        default_factory=list,
        description="Eigenvalue modes with damping < 5% in sub-synchronous range",
    )


# ── P2B Converter Comparison ────────────────────────────────────


class ConverterResult(BaseModel):
    """Simulation result for a single converter type at given grid strength."""

    converter_type: ConverterType = Field(description="GFL or GFM")
    grid_ssc_mva: float = Field(description="Grid short-circuit power [MVA]")
    scr: float = Field(description="Short-circuit ratio at PCC")
    stable: bool = Field(description="System remained stable")
    voltage_deviation_pu: float = Field(description="Max voltage deviation from 1.0 [p.u.]")
    settling_time_s: float = Field(description="Time to settle within 2% band [s]")
    frequency_deviation_hz: float = Field(description="Max frequency deviation [Hz]")


class ConverterComparisonResponse(BaseModel):
    """Educational comparison of GFL vs GFM converters.

    Shows stability differences at strong and weak grid conditions,
    highlighting why GFM is needed for low-SCR connections.
    """

    model_config = {"from_attributes": True}

    scenario: str = Field(description="Test scenario description")
    gfl_result: ConverterResult = Field(description="Grid-following converter result")
    gfm_result: ConverterResult = Field(description="Grid-forming converter result")
    gfm_advantage: str = Field(description="Educational summary of GFM advantage")


# ── P2B Dynamic Compliance Report ───────────────────────────────


class DynamicComplianceResponse(BaseModel):
    """Complete NC RfG Type D dynamic compliance report.

    Aggregates all P2B simulation results into a single compliance verdict.
    """

    model_config = {"from_attributes": True}

    lvrt: FRTSimulationResponse = Field(description="LVRT simulation result")
    hvrt: FRTSimulationResponse = Field(description="HVRT simulation result")
    lfsm_o: FrequencyResponseResponse = Field(description="LFSM-O result")
    lfsm_u: FrequencyResponseResponse = Field(description="LFSM-U result")
    fsm: FrequencyResponseResponse = Field(description="FSM droop result")
    rocof: FrequencyResponseResponse = Field(description="RoCoF withstand result")
    sso: SSOScreeningResponse = Field(description="SSO screening result")
    converter_comparison: ConverterComparisonResponse = Field(description="GFL vs GFM comparison")
    overall_compliant: bool = Field(description="True if ALL checks pass")
