"""
BESS (Battery Energy Storage System) service — M08.

Physics layers
--------------
1. State model — SOC dynamics
   SOC(t+dt) = SOC(t) - (P_discharge * dt / E_rated) + (P_charge * eta * dt / E_rated)
   where eta = round-trip efficiency = 92% for LFP

2. Frequency response (FCR / FFR)
   FCR droop: P_bess = P_rated * (delta_f / (f_n * droop_pct/100))
     delta_f = f_n - f_measured (deviation from 50 Hz)
     Clamped to [-P_rated, +P_rated]
   FFR: if f < threshold → inject P_rated immediately (0-200 ms response)

3. Ramp smoothing
   PSE IRiESP limit: 10% Pn/min = 51 MW/min at POC
   BESS absorbs/injects the difference between desired POC output and WTG ramp
   P_bess = P_poc_desired - P_wtg_actual

4. Degradation model (LFP electrochemical simplified)
   Rainflow-counting approximation:
   cycle_damage = (DoD / DoD_ref)^k_exp per cycle
   SOH(n) = 100 - (n / N_design) * 20%   at reference DoD = 80%
   where N_design = 3000 cycles (LFP to 80% SOH)
   DoD correction: N_effective = N_design * (DoD_ref/DoD_actual)^1.5

5. Dispatch: WTG + BESS combined
   If P_target <= P_avail_wtg: WTG alone, BESS charges surplus
   If P_target > P_avail_wtg: BESS discharges deficit (if SOC allows)

References
----------
- IEC 62933-2-1:2017 — EES terminology and performance
- ENTSO-E Network Code FCR: ±200 mHz deadband, 30s full activation
- PSE IRiESP Art. 6.3: active power ramp rate <= 10% Pn/min
- LFP cycle life data: CATL/BYD 2025 product specifications
"""

from __future__ import annotations

import math
from typing import Any

# ── BESS nameplate parameters (Baltic Wind 50 MW / 200 MWh) ──────────────────

RATED_POWER_MW = 50.0
RATED_ENERGY_MWH = 200.0
ROUNDTRIP_EFFICIENCY_PCT = 92.0
SOC_MIN_PCT = 10.0
SOC_MAX_PCT = 90.0
NOMINAL_FREQ_HZ = 50.0
RESPONSE_TIME_MS = 200.0

# LFP degradation reference
DESIGN_CYCLE_COUNT = 3000  # cycles to 80% SOH at 80% DoD
DESIGN_DOD_PCT = 80.0
DESIGN_EOL_SOH_PCT = 80.0
REPLACEMENT_COST_M_EUR_PER_MWH = 0.35  # 2026 LFP price ~350 EUR/kWh

# Ramp rate limit (PSE IRiESP)
RAMP_RATE_LIMIT_MW_PER_MIN = 51.0  # 10% * 510 MW


# ── Current state (in-memory — resets on server restart) ─────────────────────

_state: dict[str, Any] = {
    "soc_percent": 60.0,
    "power_mw": 0.0,
    "reactive_mvar": 0.0,
    "mode": "STANDBY",
    "temperature_c": 25.0,
    "voltage_v": 1500.0,
    "current_a": 0.0,
    "soh_percent": 99.5,  # Slightly below 100% = delivered system
    "cycle_count": 12,  # Just commissioned
    "capacity_fade_pct": 0.5,
    "alarms_active": False,
}


def get_status() -> dict[str, Any]:
    """Return current BESS operating state."""
    soc = _state["soc_percent"]
    soh = _state["soh_percent"]
    rated_energy = RATED_ENERGY_MWH * (soh / 100.0)
    # Available energy: from SOC_min to current SOC
    available = rated_energy * (soc - SOC_MIN_PCT) / 100.0
    return {
        "soc_percent": round(soc, 2),
        "power_mw": round(_state["power_mw"], 3),
        "reactive_mvar": round(_state["reactive_mvar"], 3),
        "mode": _state["mode"],
        "temperature_c": round(_state["temperature_c"], 1),
        "soh_percent": round(soh, 2),
        "cycle_count": _state["cycle_count"],
        "capacity_fade_pct": round(_state["capacity_fade_pct"], 2),
        "rated_power_mw": RATED_POWER_MW,
        "rated_energy_mwh": round(rated_energy, 1),
        "available_energy_mwh": round(max(0.0, available), 2),
        "alarms_active": _state["alarms_active"],
    }


def set_mode(mode: str, power_setpoint_mw: float, soc_target_pct: float) -> dict[str, Any]:
    """
    Change BESS operating mode.

    Validates mode transitions (e.g., cannot go CHARGE if SOC > SOC_max).
    """
    previous_mode = _state["mode"]
    soc = _state["soc_percent"]

    allowed = True
    reason = "Mode change accepted"

    if mode == "CHARGE" and soc >= SOC_MAX_PCT:
        allowed = False
        reason = f"Cannot charge: SOC {soc:.1f}% already at maximum {SOC_MAX_PCT}%"
    elif mode == "DISCHARGE" and soc <= SOC_MIN_PCT:
        allowed = False
        reason = f"Cannot discharge: SOC {soc:.1f}% at minimum {SOC_MIN_PCT}%"
    elif mode == "FREQUENCY_RESPONSE" and soc < 20.0:
        allowed = False
        reason = f"FCR not available: SOC {soc:.1f}% too low — minimum 20% for frequency response"

    if allowed:
        _state["mode"] = mode
        # Clamp power setpoint to ±rated
        p_set = max(-RATED_POWER_MW, min(RATED_POWER_MW, power_setpoint_mw))
        # In automatic modes, power is controlled by the algorithm
        if mode in ("FREQUENCY_RESPONSE", "RAMP_SMOOTHING"):
            p_set = 0.0  # Will be set by algorithm
        _state["power_mw"] = p_set

    return {
        "previous_mode": previous_mode,
        "new_mode": _state["mode"],
        "power_setpoint_mw": _state["power_mw"],
        "soc_current_pct": soc,
        "transition_allowed": allowed,
        "reason": reason,
    }


def simulate_frequency_response(
    frequency_trace_hz: list[float],
    fcr_droop_pct: float,
    ffr_threshold_hz: float,
    initial_soc_pct: float,
) -> dict[str, Any]:
    """
    Simulate BESS frequency response (FCR + FFR).

    FCR (Frequency Containment Reserve — ENTSO-E Network Code):
    - Symmetric response within ±200 mHz deadband (no response)
    - Full activation at ±500 mHz (50% rated power)
    - Linear between deadband and full activation

    FFR (Fast Frequency Response — PSE requirement for Baltic):
    - Activated below threshold (default 49.7 Hz)
    - Full rated power within 200 ms
    - Overrides FCR droop calculation

    Returns time-domain traces of frequency, BESS power, and SOC.
    """
    soc = initial_soc_pct
    bess_powers = []
    soc_trace = []
    times = list(range(len(frequency_trace_hz)))  # 1-second steps

    fcr_activated = False
    ffr_activated = False
    energy_mwh = 0.0

    deadband_hz = 0.2  # ENTSO-E standard
    dt_h = 1.0 / 3600.0  # 1-second step in hours

    for f in frequency_trace_hz:
        delta_f = NOMINAL_FREQ_HZ - f  # positive = underfrequency

        # FFR check (highest priority)
        if abs(f - NOMINAL_FREQ_HZ) > (NOMINAL_FREQ_HZ - ffr_threshold_hz):
            p_bess = -RATED_POWER_MW * math.copysign(1.0, delta_f)
            ffr_activated = True
        elif abs(delta_f) <= deadband_hz:
            p_bess = 0.0  # inside deadband
        else:
            # FCR: linear droop outside deadband
            droop_fraction = droop_pct_to_fraction(fcr_droop_pct)
            delta_f_excess = abs(delta_f) - deadband_hz
            p_bess = -(RATED_POWER_MW * delta_f_excess / (NOMINAL_FREQ_HZ * droop_fraction))
            p_bess = max(-RATED_POWER_MW, min(RATED_POWER_MW, p_bess))
            p_bess *= math.copysign(1.0, delta_f)
            if abs(delta_f) > deadband_hz:
                fcr_activated = True

        # SOC limits
        if p_bess < 0 and soc <= SOC_MIN_PCT:  # discharging but empty
            p_bess = 0.0
        if p_bess > 0 and soc >= SOC_MAX_PCT:  # charging but full
            p_bess = 0.0

        # Update SOC (p_bess negative = discharge = SOC decreases)
        if p_bess < 0:  # discharging
            delta_soc = p_bess * dt_h / (RATED_ENERGY_MWH / 100.0)
        else:  # charging
            eta = ROUNDTRIP_EFFICIENCY_PCT / 100.0
            delta_soc = p_bess * eta * dt_h / (RATED_ENERGY_MWH / 100.0)
        soc = max(SOC_MIN_PCT, min(SOC_MAX_PCT, soc + delta_soc))

        if p_bess < 0:
            energy_mwh += abs(p_bess) * dt_h

        bess_powers.append(round(p_bess, 3))
        soc_trace.append(round(soc, 2))

    nadir_f = min(frequency_trace_hz)
    nadir_t = frequency_trace_hz.index(nadir_f)

    if nadir_f < 49.0:
        assessment = "CRITICAL — frequency below PSE limit 49.0 Hz; BESS response insufficient"
    elif nadir_f < 49.5:
        assessment = "ALERT — nadir below 49.5 Hz; BESS FFR activated"
    elif ffr_activated:
        assessment = "PASS — FFR successfully contained frequency event"
    elif fcr_activated:
        assessment = "PASS — FCR response within normal operating range"
    else:
        assessment = "PASS — frequency within deadband, no BESS response required"

    return {
        "time_s": times,
        "frequency_hz": [round(f, 4) for f in frequency_trace_hz],
        "bess_power_mw": bess_powers,
        "soc_percent": soc_trace,
        "nadir_hz": round(nadir_f, 4),
        "nadir_time_s": float(nadir_t),
        "energy_delivered_mwh": round(energy_mwh, 4),
        "fcr_activated": fcr_activated,
        "ffr_activated": ffr_activated,
        "assessment": assessment,
    }


def simulate_ramp_smoothing(
    wind_power_trace_mw: list[float],
    max_ramp_rate_mw_per_min: float,
    initial_soc_pct: float,
) -> dict[str, Any]:
    """
    BESS ramp smoothing to comply with PSE IRiESP ramp rate limit.

    Algorithm:
    1. Compute WTG ramp rate at each minute
    2. If |ramp| > limit: BESS provides the difference
       P_bess = P_desired_poc - P_wtg_actual
       where P_desired_poc follows a ramp-limited trajectory from P_wtg
    3. SOC constraints enforced — if BESS saturated, ramp violation reported

    dt = 1 minute throughout.
    """
    soc = initial_soc_pct
    bess_powers = []
    soc_trace = []
    smoothed_output: list[float] = []

    violations_before = 0
    violations_after = 0
    peak_charge = 0.0
    peak_discharge = 0.0

    dt_min = 1.0
    dt_h = dt_min / 60.0

    # Target POC output (ramp-limited)
    p_poc_target = wind_power_trace_mw[0]

    for i, p_wtg in enumerate(wind_power_trace_mw):
        if i == 0:
            p_bess = 0.0
            smoothed = p_wtg
        else:
            p_prev = wind_power_trace_mw[i - 1]
            ramp_actual = p_wtg - p_prev  # MW in 1 minute

            # Count violations without BESS
            if abs(ramp_actual) > max_ramp_rate_mw_per_min:
                violations_before += 1

            # Desired POC: apply ramp limit
            p_poc_desired = p_poc_target + max(
                -max_ramp_rate_mw_per_min, min(max_ramp_rate_mw_per_min, p_wtg - p_poc_target)
            )
            p_poc_target = p_poc_desired

            # BESS = desired POC - actual WTG
            p_bess_required = p_poc_desired - p_wtg

            # Clip to rated power
            p_bess = max(-RATED_POWER_MW, min(RATED_POWER_MW, p_bess_required))

            # SOC enforcement
            if p_bess < 0 and soc <= SOC_MIN_PCT:
                p_bess = 0.0
            if p_bess > 0 and soc >= SOC_MAX_PCT:
                p_bess = 0.0

            smoothed = p_wtg + p_bess

            # Check residual violations after BESS
            ramp_smoothed = smoothed - smoothed_output[-1] if smoothed_output else 0.0
            if abs(ramp_smoothed) > max_ramp_rate_mw_per_min:
                violations_after += 1

        # Update SOC
        if p_bess < 0:  # charging WTG surplus into BESS
            eta = ROUNDTRIP_EFFICIENCY_PCT / 100.0
            delta_soc = -p_bess * eta * dt_h / (RATED_ENERGY_MWH / 100.0)
        else:  # discharging BESS to grid
            delta_soc = -p_bess * dt_h / (RATED_ENERGY_MWH / 100.0)
        soc = max(SOC_MIN_PCT, min(SOC_MAX_PCT, soc + delta_soc))

        peak_charge = max(peak_charge, max(0.0, -p_bess))
        peak_discharge = max(peak_discharge, max(0.0, p_bess))

        bess_powers.append(round(p_bess, 3))
        soc_trace.append(round(soc, 2))
        smoothed_output.append(round(smoothed, 3))

    if violations_after == 0:
        assessment = "PASS — all ramp rate violations eliminated by BESS"
    elif violations_after < violations_before:
        reduction = 100 * (1 - violations_after / max(1, violations_before))
        assessment = f"PARTIAL — {reduction:.0f}% ramp violations reduced; BESS may be undersized"
    else:
        assessment = "FAIL — BESS unable to smooth ramps (SOC limits exceeded)"

    return {
        "wind_power_mw": [round(p, 3) for p in wind_power_trace_mw],
        "bess_power_mw": bess_powers,
        "smoothed_output_mw": smoothed_output,
        "soc_percent": soc_trace,
        "ramp_violations_before": violations_before,
        "ramp_violations_after": violations_after,
        "peak_bess_charge_mw": round(peak_charge, 2),
        "peak_bess_discharge_mw": round(peak_discharge, 2),
        "assessment": assessment,
    }


def calculate_degradation(years: int, annual_cycles: float, avg_dod_pct: float) -> dict[str, Any]:
    """
    Project BESS degradation over a specified number of years.

    LFP degradation model:
    - Reference: 3000 cycles to 80% SOH at 80% DoD
    - DoD correction: N_eff = N_design * (DoD_ref / DoD_actual)^1.5
      Higher DoD → fewer cycles to EOL (exponential relationship)
    - Calendar ageing: ~0.5% SOH/year for LFP at ambient temperature
    - Combined SOH: SOH = 100 - max(cycle_loss, calendar_loss)
    """
    # Effective cycle count to EOL with DoD correction
    dod_factor = (DESIGN_DOD_PCT / avg_dod_pct) ** 1.5
    n_eff_to_eol = DESIGN_CYCLE_COUNT * dod_factor  # effective cycles to 80% SOH

    calendar_degradation_per_year = 0.5  # % SOH/year LFP at 25°C

    projection = []
    eol_year = years
    total_cycles = 0.0

    for yr in range(years + 1):
        total_cycles = yr * annual_cycles
        cycle_soh_loss = (total_cycles / n_eff_to_eol) * 20.0  # 20% total degradation
        calendar_soh_loss = yr * calendar_degradation_per_year
        soh = max(0.0, 100.0 - max(cycle_soh_loss, calendar_soh_loss))

        capacity_mwh = RATED_ENERGY_MWH * soh / 100.0

        projection.append(
            {
                "year": yr,
                "soh_percent": round(soh, 2),
                "cumulative_cycles": round(total_cycles, 0),
                "capacity_mwh": round(capacity_mwh, 1),
            }
        )

        if soh <= DESIGN_EOL_SOH_PCT and eol_year == years:
            eol_year = yr

    total_cycles_to_eol = eol_year * annual_cycles
    replacement_cost = RATED_ENERGY_MWH * REPLACEMENT_COST_M_EUR_PER_MWH
    # BESS LCOE contribution: CAPEX / (annual_cycles * avg_dod_pct/100 * RATED_ENERGY * years)
    total_energy_throughput_mwh = (
        annual_cycles * (avg_dod_pct / 100.0) * RATED_ENERGY_MWH * eol_year
    )
    lcoe_eur_mwh = (replacement_cost * 1e6) / max(1.0, total_energy_throughput_mwh)

    if eol_year >= 15:
        assessment = "EXCELLENT — LFP chemistry achieves 15+ year lifetime at this duty cycle"
    elif eol_year >= 10:
        assessment = "GOOD — 10+ years to EOL; within typical wind farm operating period"
    else:
        assessment = "REVIEW — EOL before 10 years; consider reducing DoD or annual cycles"

    return {
        "projection": projection,
        "eol_year": eol_year,
        "total_cycles_to_eol": round(total_cycles_to_eol, 0),
        "replacement_cost_m_eur": round(replacement_cost, 2),
        "lcoe_contribution_eur_mwh": round(lcoe_eur_mwh, 2),
        "assessment": assessment,
    }


def dispatch_bess(
    p_target_mw: float,
    p_available_wtg_mw: float,
    current_soc_pct: float,
) -> dict[str, Any]:
    """
    Enhanced WTG + BESS dispatch (extends PPC pro-rata algorithm).

    Decision logic:
    1. If P_target <= P_avail_wtg:
       - WTG covers target; surplus can charge BESS (if SOC < SOC_max)
       - P_wtg = P_target, P_bess = 0 (or charge surplus if available)
    2. If P_target > P_avail_wtg:
       - BESS discharges deficit: P_bess = -(P_target - P_avail_wtg)
       - Clamped to rated power and SOC limits
    3. SOC limits always enforced.
    """
    p_bess = 0.0
    p_wtg = min(p_target_mw, p_available_wtg_mw)
    bess_mode = "STANDBY"
    notes = ""

    if p_target_mw <= p_available_wtg_mw:
        # WTG can cover target — opportunistic BESS charging
        surplus_mw = p_available_wtg_mw - p_target_mw
        if current_soc_pct < SOC_MAX_PCT and surplus_mw > 0:
            charge_power = min(RATED_POWER_MW, surplus_mw)
            p_bess = charge_power  # positive = charging
            bess_mode = "CHARGE"
            notes = f"WTG surplus {surplus_mw:.1f} MW absorbed by BESS (SOC {current_soc_pct:.1f}%)"
        else:
            notes = "WTG covers target; BESS in STANDBY"
    else:
        # WTG deficit — BESS discharges
        deficit = p_target_mw - p_available_wtg_mw
        if current_soc_pct > SOC_MIN_PCT:
            discharge_power = min(RATED_POWER_MW, deficit)
            p_bess = -discharge_power  # negative = discharging
            bess_mode = "DISCHARGE"
            notes = f"WTG deficit {deficit:.1f} MW covered by BESS discharge"
            if deficit > RATED_POWER_MW:
                shortfall = deficit - RATED_POWER_MW
                notes += f" (BESS limited to {RATED_POWER_MW:.0f} MW; shortfall {shortfall:.1f} MW)"
        else:
            notes = f"Cannot discharge: SOC {current_soc_pct:.1f}% at minimum {SOC_MIN_PCT}%"
            p_wtg = p_available_wtg_mw  # curtail to available

    # P_POC = P_WTG (dispatch) + P_BESS (negative = discharge adds to grid)
    p_poc = p_wtg - p_bess  # WTG output - BESS consumption (negative discharge = add to WTG)

    # Estimate SOC after 1-minute dispatch
    dt_h = 1.0 / 60.0  # 1 minute
    if p_bess > 0:  # charging
        delta_soc = p_bess * ROUNDTRIP_EFFICIENCY_PCT / 100.0 * dt_h / (RATED_ENERGY_MWH / 100.0)
    else:  # discharging
        delta_soc = p_bess * dt_h / (RATED_ENERGY_MWH / 100.0)  # negative delta
    soc_after = max(SOC_MIN_PCT, min(SOC_MAX_PCT, current_soc_pct + delta_soc))

    feasible = abs(p_poc - p_target_mw) < 0.5  # within 0.5 MW of target

    return {
        "p_target_mw": round(p_target_mw, 3),
        "p_wtg_dispatch_mw": round(p_wtg, 3),
        "p_bess_mw": round(p_bess, 3),
        "p_poc_mw": round(p_poc, 3),
        "soc_after_pct": round(soc_after, 2),
        "bess_mode": bess_mode,
        "dispatch_feasible": feasible,
        "notes": notes,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────


def droop_pct_to_fraction(droop_pct: float) -> float:
    """Convert droop percentage to per-unit fraction for FCR calculation."""
    return droop_pct / 100.0
