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

from pydantic import BaseModel, Field, field_validator

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
    p_mw: float = Field(description="Net active power injection [MW], generating positive")
    q_mvar: float = Field(
        description="Net reactive power injection [MVAR], generating positive (Rule 4)"
    )


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
    poc_p_mw: float = Field(0.0, description="Active power delivered to PSE 400 kV [MW]")
    poc_q_mvar: float = Field(
        0.0, description="Reactive power delivered to PSE 400 kV [MVAR], generating positive"
    )
    statcom_q_mvar: float = Field(0.0, description="STATCOM set-point after auto-dispatch [MVAR]")
    voltage_compliant: bool = Field(
        description="True if all buses within 0.95-1.05 pu per PSE IRiESP"
    )
    buses: list[BusResult] = Field(default_factory=list, description="Per-bus results")
    lines: list[LineResult] = Field(default_factory=list, description="Per-line/cable results")
    transformers: list[TransformerResult] = Field(
        default_factory=list, description="Per-transformer results"
    )


class LiveLoadFlowRequest(BaseModel):
    """Live operating point from the landing simulation: P of every WTG."""

    wtg_p_mw: list[float] = Field(
        min_length=34,
        max_length=34,
        description="Active power of WTG_01 … WTG_34 [MW], 0 ≤ P ≤ 15 (V236 rating)",
    )

    @field_validator("wtg_p_mw")
    @classmethod
    def _within_rating(cls, v: list[float]) -> list[float]:
        # Domain rule 1: 0 ≤ P ≤ P_rated for every turbine
        if any(p < 0 or p > 15.0 for p in v):
            msg = "each WTG power must be within 0 … 15 MW"
            raise ValueError(msg)
        return v


class LiveLoadFlowResponse(BaseModel):
    """Grid state for the live operating point (pandapower Newton-Raphson).

    Q is positive when generated (domain rule 4); voltages in p.u. of the
    bus nominal voltage (rule 2).
    """

    converged: bool
    total_generation_mw: float = Field(description="Sum of WTG output [MW]")
    poc_p_mw: float = Field(description="Active power delivered to PSE 400 kV [MW]")
    poc_q_mvar: float = Field(description="Reactive power delivered to PSE 400 kV [MVAR]")
    total_loss_mw: float = Field(description="Cable + transformer losses [MW]")
    statcom_q_mvar: float = Field(description="STATCOM set-point after auto-dispatch [MVAR]")
    v_poc_pu: float
    v_onshore_220_pu: float
    v_oss_220_pu: float
    v_oss_66_pu: float
    export_cable_loading_pct: float
    max_array_cable_loading_pct: float
    oss_trafo_loading_pct: float
    onshore_trafo_loading_pct: float
    voltage_compliant: bool = Field(description="All buses within 0.95–1.05 p.u. (PSE IRiESP)")


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
    skss_mw: float = Field(description="Short-circuit power Sk'' [MVA] (name kept for API)")
    breaker_ka: float = Field(0.0, description="Rated short-circuit breaking current [kA]")
    making_ka: float = Field(
        0.0, description="Rated making current = 2.5 × breaking (IEC 62271-100, 50 Hz) [kA]"
    )


class ShortCircuitResponse(BaseModel):
    """Complete IEC 60909 short-circuit analysis result.

    Contains max (c=1.1) and min (c=0.95) cases for breaker sizing
    and protection coordination.
    """

    model_config = {"from_attributes": True}

    case: str = Field(description="'max' (c = 1.10) or 'min' (c = 1.00), IEC 60909 HV")
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
        description="Ferranti rise along the open-ended export cable, 1/cos(βL) − 1 [p.u.]"
    )
    uncompensated_rise_pu: float = Field(
        0.0,
        description="Voltage rise with no reactors/STATCOM at no load (charging current "
        "through transformers and grid) [p.u.]",
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
    reactor_n1_statcom_q_mvar: float = Field(
        description="Worst STATCOM Q with one shunt reactor out [MVAR], negative=absorbing"
    )
    reactor_n1_secure: bool = Field(
        description="True if one reactor out keeps voltage compliant without STATCOM saturation"
    )
    poc_q_max_mvar: float = Field(
        0.0, description="Producing Q deliverable at the POC at P_max [MVAR]"
    )
    poc_q_min_mvar: float = Field(
        0.0, description="Absorbing Q deliverable at the POC at P_max [MVAR]"
    )
    pse_q_max_mvar: float = Field(0.0, description="PSE requirement, producing: +0.40·P_max [MVAR]")
    pse_q_min_mvar: float = Field(0.0, description="PSE requirement, absorbing: −0.35·P_max [MVAR]")
    pse_q_range_met: bool = Field(False, description="Both PSE limits reached at P_max")
    wtg_q_capability_mvar: float = Field(
        0.0, description="Assumed ±Q per WTG at rated power [MVAR]"
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
    """Low-voltage ride-through: balanced fault at a network bus."""

    HVRT = "hvrt"
    """High-voltage ride-through: grid voltage swell (illustrative, no PSE profile)."""


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
    voltage_pu: float = Field(description="Voltage at the connection point, PSE 400 kV [p.u.]")
    terminal_voltage_pu: float = Field(
        0.0, description="Voltage at the WTG terminals (aggregated at OSS 66 kV) [p.u.]"
    )
    active_power_mw: float = Field(description="Active power of the 34 WTGs [MW]")
    reactive_power_mvar: float = Field(
        description="Reactive power of the 34 WTGs [MVAR], generating positive"
    )
    reactive_current_pu: float = Field(
        description="WTG reactive current [p.u. of rating], > 0 capacitive"
    )
    statcom_q_mvar: float = Field(0.0, description="STATCOM reactive power [MVAR]")


class FRTEnvelopePoint(BaseModel):
    """Vertex of the PSE FRT profile (time in simulation seconds)."""

    time_s: float
    voltage_pu: float


class FRTSimulationResponse(BaseModel):
    """Complete fault ride-through simulation result.

    Contains time-series data, compliance verdicts for reactive current
    injection and active power recovery, plus the PSE voltage envelope.
    """

    model_config = {"from_attributes": True}

    frt_type: FRTType = Field(description="LVRT or HVRT")
    fault_bus: str = Field(description="Bus where fault was applied")
    fault_duration_s: float = Field(description="Fault duration [s]")
    stayed_connected: bool = Field(
        description="LVRT: POC voltage stayed on/above the PSE profile (ride-through required). "
        "HVRT: terminal voltage within the assumed 1.30 pu converter withstand"
    )
    reactive_current_compliant: bool = Field(
        description="Reactive current ≥ 90 % of K·ΔU (capped at rated current), PSE Art. 20(2)(b)"
    )
    reactive_current_gain: float = Field(description="Delivered ΔIq/ΔU at the end of the event")
    recovery_time_s: float = Field(description="Time from clearance to 90 % of pre-fault P [s]")
    recovery_compliant: bool = Field(description="Recovery within 5 s, PSE Art. 20(3)(a)")
    statcom_peak_q_mvar: float = Field(
        description="Largest STATCOM reactive power during the event [MVAR]"
    )
    k_factor: float = Field(2.0, description="Fast fault current gain K used")
    retained_voltage_pu: float = Field(
        0.0, description="Extreme POC voltage during the event (min LVRT, max HVRT) [p.u.]"
    )
    terminal_voltage_pu: float = Field(
        0.0, description="WTG terminal voltage at that instant [p.u.]"
    )
    passive_voltage_pu: float = Field(
        0.0, description="POC voltage with no converter current (shows the voltage support) [p.u.]"
    )
    recovery_limit_s: float = Field(5.0, description="PSE recovery limit [s]")
    envelope: list[FRTEnvelopePoint] = Field(
        default_factory=list, description="PSE type-D FRT profile at the POC (LVRT only)"
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
    scr: float = Field(description="Short-circuit ratio at the POC (S_sc / P_n)")
    scr_terminal: float = Field(0.0, description="SCR at the 66 kV busbar (incl. farm impedance)")
    stable: bool = Field(description="Kept synchronism and settled back to P_ref within ±2 %")
    voltage_deviation_pu: float = Field(
        description="Max terminal voltage change after the jump [p.u.]"
    )
    settling_time_s: float = Field(description="Time until P stays within ±2 % of rating [s]")
    frequency_deviation_hz: float = Field(
        description="Max frequency excursion seen by the control (PLL or virtual rotor) [Hz]"
    )
    peak_current_pu: float = Field(0.0, description="Peak converter current [p.u. of rating]")
    power_swing_mw: float = Field(0.0, description="Max active power deviation after the jump [MW]")


class ConverterTimePoint(BaseModel):
    """Both converters at one instant (2 ms resolution)."""

    time_s: float
    gfl_p_mw: float | None = Field(description="None after the converter lost synchronism")
    gfm_p_mw: float | None
    gfl_f_hz: float | None
    gfm_f_hz: float | None
    gfl_i_pu: float | None
    gfm_i_pu: float | None


class ConverterComparisonResponse(BaseModel):
    """Educational comparison of GFL vs GFM converters.

    Shows stability differences at strong and weak grid conditions,
    highlighting why GFM is needed for low-SCR connections.
    """

    model_config = {"from_attributes": True}

    scenario: str = Field(description="Test scenario description")
    gfl_result: ConverterResult = Field(description="Grid-following converter result")
    gfm_result: ConverterResult = Field(description="Grid-forming converter result")
    gfm_advantage: str = Field(description="Plain summary of what the simulation shows")
    phase_jump_deg: float = Field(20.0, description="Grid voltage phase jump at t = 0.1 s [deg]")
    time_series: list[ConverterTimePoint] = Field(default_factory=list)


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
