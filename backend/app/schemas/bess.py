"""
Pydantic schemas for BESS (Battery Energy Storage System) API — M08.

50 MW / 200 MWh LFP battery collocated at Baltic Wind OSS (220 kV).
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class BESSMode(str, Enum):  # noqa: UP042
    """BESS operating mode — determines power setpoint source."""

    STANDBY = "STANDBY"  # SOC maintained, zero power
    CHARGE = "CHARGE"  # Actively charging from grid / WTG surplus
    DISCHARGE = "DISCHARGE"  # Actively discharging to grid
    FREQUENCY_RESPONSE = "FREQUENCY_RESPONSE"  # Automatic FCR/FFR (freq-triggered)
    RAMP_SMOOTHING = "RAMP_SMOOTHING"  # Fill/absorb WTG ramp transients
    ARBITRAGE = "ARBITRAGE"  # Optimised charge/discharge vs electricity price
    TEST = "TEST"  # Commissioning / capacity test mode


class BESSStatusResponse(BaseModel):
    """Current BESS operating state snapshot."""

    soc_percent: float = Field(
        description="State of Charge [0-100 %]. Operating window: 10-90% to limit degradation."
    )
    power_mw: float = Field(
        description="Active power [MW]. Positive = charging, negative = discharging."
    )
    reactive_mvar: float = Field(
        description="Reactive power injection [MVAR]. Full 4-quadrant PCS capability."
    )
    mode: BESSMode
    temperature_c: float = Field(description="Average rack temperature [deg C]")
    soh_percent: float = Field(
        description=(
            "State of Health [%]. SOH = current capacity / nameplate capacity * 100. "
            "LFP chemistry (LiFePO4) retains > 80% SOH after ~3000 cycles."
        )
    )
    cycle_count: int = Field(description="Cumulative equivalent full cycles (EFC)")
    capacity_fade_pct: float = Field(
        description="Capacity fade from BOL [%]. EOL defined at 20% fade (80% SOH)."
    )
    rated_power_mw: float = Field(default=50.0, description="Nameplate rated power [MW]")
    rated_energy_mwh: float = Field(default=200.0, description="Nameplate energy capacity [MWh]")
    available_energy_mwh: float = Field(description="Energy available for dispatch [MWh]")
    alarms_active: bool


class BESSModeRequest(BaseModel):
    """Request body for BESS mode change."""

    mode: BESSMode = Field(description="Target operating mode")
    power_setpoint_mw: float = Field(
        default=0.0,
        ge=-50.0,
        le=50.0,
        description=(
            "Active power setpoint [MW]. "
            "Positive = charge, negative = discharge. "
            "Ignored in FREQUENCY_RESPONSE and RAMP_SMOOTHING modes (auto-controlled)."
        ),
    )
    soc_target_pct: float = Field(
        default=50.0,
        ge=10.0,
        le=90.0,
        description="Target SOC for CHARGE/DISCHARGE modes [%]",
    )


class BESSModeResponse(BaseModel):
    """Mode change confirmation."""

    previous_mode: BESSMode
    new_mode: BESSMode
    power_setpoint_mw: float
    soc_current_pct: float
    transition_allowed: bool
    reason: str = Field(description="Why the transition was allowed or blocked")


# ── Frequency response simulation ────────────────────────────────────────────


class FrequencyResponsePoint(BaseModel):
    """Single time step in frequency response simulation."""

    time_s: float
    frequency_hz: float
    power_mw: float = Field(description="BESS power injection (negative = discharge to grid)")
    soc_percent: float


class FrequencyResponseRequest(BaseModel):
    """Parameters for simulating BESS frequency response (FCR/FFR)."""

    frequency_trace_hz: list[float] = Field(
        description=(
            "Grid frequency time series [Hz], 1-second resolution. "
            "Example: [50.0, 49.9, 49.7, 49.5, 49.6, 49.8, 50.0] simulates a frequency dip."
        ),
        min_length=2,
        max_length=300,
        examples=[[50.0, 49.95, 49.85, 49.6, 49.45, 49.5, 49.7, 49.85, 49.95, 50.0]],
    )
    fcr_droop_pct: float = Field(
        default=5.0,
        ge=1.0,
        le=20.0,
        description=(
            "FCR droop [%]. At 5% droop: a 0.5 Hz deviation (1% of 50 Hz) "
            "triggers 20% rated power response (0.01/0.05 = 20%)."
        ),
    )
    ffr_threshold_hz: float = Field(
        default=49.7,
        ge=49.0,
        le=49.9,
        description="FFR activation threshold [Hz]. Below this, full power injected immediately.",
    )
    initial_soc_pct: float = Field(
        default=60.0,
        ge=10.0,
        le=90.0,
        description="Initial SOC at start of simulation [%]",
    )


class FrequencyResponseResult(BaseModel):
    """Frequency response simulation output."""

    time_s: list[float]
    frequency_hz: list[float]
    bess_power_mw: list[float] = Field(
        description="BESS power [MW]. Negative = discharging (injecting to grid)."
    )
    soc_percent: list[float]
    nadir_hz: float = Field(description="Frequency nadir (minimum) [Hz]")
    nadir_time_s: float = Field(description="Time of nadir [s]")
    energy_delivered_mwh: float = Field(description="Total energy delivered during event [MWh]")
    fcr_activated: bool
    ffr_activated: bool
    assessment: str


# ── Ramp smoothing simulation ────────────────────────────────────────────────


class RampSmoothingRequest(BaseModel):
    """Parameters for BESS ramp smoothing simulation."""

    wind_power_trace_mw: list[float] = Field(
        description=(
            "Wind farm active power time series [MW], 1-minute resolution. "
            "The BESS smooths ramps exceeding PSE IRiESP limit (10%/min = 51 MW/min)."
        ),
        min_length=10,
        max_length=1440,
        examples=[[200.0, 220.0, 350.0, 480.0, 510.0, 490.0, 380.0, 250.0]],
    )
    max_ramp_rate_mw_per_min: float = Field(
        default=51.0,
        ge=5.0,
        le=200.0,
        description=(
            "Maximum allowed ramp rate at POC [MW/min]. "
            "PSE IRiESP limit: 10% Pn/min = 51 MW/min for 510 MW farm."
        ),
    )
    initial_soc_pct: float = Field(default=50.0, ge=10.0, le=90.0)


class RampSmoothingResult(BaseModel):
    """Ramp smoothing simulation output."""

    wind_power_mw: list[float]
    bess_power_mw: list[float]
    smoothed_output_mw: list[float] = Field(description="WTG + BESS combined output at POC")
    soc_percent: list[float]
    ramp_violations_before: int = Field(description="Number of ramp rate violations without BESS")
    ramp_violations_after: int = Field(description="Number of ramp rate violations with BESS")
    peak_bess_charge_mw: float
    peak_bess_discharge_mw: float
    assessment: str


# ── Degradation ───────────────────────────────────────────────────────────────


class DegradationRequest(BaseModel):
    """Parameters for degradation projection."""

    years: int = Field(
        default=20,
        ge=1,
        le=30,
        description="Projection horizon [years]",
    )
    annual_cycles: float = Field(
        default=365.0,
        ge=50.0,
        le=1000.0,
        description=(
            "Equivalent full cycles per year. "
            "FCR/ramp-smoothing duty: ~250-400 cycles/year. "
            "Arbitrage duty: ~300-500 cycles/year."
        ),
    )
    avg_dod_pct: float = Field(
        default=70.0,
        ge=10.0,
        le=90.0,
        description=(
            "Average depth of discharge per cycle [%]. "
            "Lower DoD significantly extends cycle life. "
            "Operating between 10-90% SOC = 80% DoD."
        ),
    )


class DegradationYearPoint(BaseModel):
    """Single year in degradation projection."""

    year: int
    soh_percent: float
    cumulative_cycles: float
    capacity_mwh: float = Field(description="Available energy capacity [MWh]")


class DegradationResponse(BaseModel):
    """20-year BESS degradation projection (LFP model)."""

    projection: list[DegradationYearPoint]
    eol_year: int = Field(description="Year when SOH drops below 80% EOL threshold")
    total_cycles_to_eol: float
    replacement_cost_m_eur: float = Field(
        description="Estimated replacement cost at EOL [M EUR] (2026 prices)"
    )
    lcoe_contribution_eur_mwh: float = Field(description="BESS LCOE contribution to farm [EUR/MWh]")
    assessment: str


# ── Dispatch ─────────────────────────────────────────────────────────────────


class BESSDispatchRequest(BaseModel):
    """Enhanced WTG + BESS dispatch request."""

    p_target_mw: float = Field(
        ge=0.0,
        le=560.0,  # 510 MW WTG + 50 MW BESS
        description="Active power setpoint from grid operator [MW]",
    )
    p_available_wtg_mw: float = Field(
        ge=0.0,
        le=510.0,
        description="Sum of all WTG available power at current wind [MW]",
    )
    current_soc_pct: float = Field(
        default=50.0,
        ge=0.0,
        le=100.0,
        description="Current BESS SOC [%]",
    )


class BESSDispatchResponse(BaseModel):
    """WTG + BESS combined dispatch result."""

    p_target_mw: float
    p_wtg_dispatch_mw: float = Field(description="Total WTG active power setpoint [MW]")
    p_bess_mw: float = Field(
        description="BESS power [MW]. Positive = charge (absorb surplus), negative = discharge."
    )
    p_poc_mw: float = Field(description="Resulting power at POC = WTG + BESS [MW]")
    soc_after_pct: float = Field(description="Estimated SOC after dispatch [%]")
    bess_mode: str
    dispatch_feasible: bool
    notes: str
