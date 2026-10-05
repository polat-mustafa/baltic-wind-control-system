"""
BESS (50 MW / 200 MWh LFP at the OSS) — state, frequency response, ramp
smoothing, degradation and combined dispatch.

Sign convention (all functions and API fields): battery power positive =
discharging (injecting into the grid), negative = charging — the generator
convention used for P and Q across the platform.

SOC bookkeeping (1 % SOC = 2 MWh): discharging P for dt removes P·dt; charging
stores η·|P|·dt with η = 92 % round-trip efficiency applied on the charge side.
SOC is kept within 10–90 %.

Frequency Containment Reserve — SO GL (EU 2017/1485), Continental Europe
-------------------------------------------------------------------------
  P = P_FCR · clamp((50 − f) / 0.2 Hz, −1, 1)    full activation at ±200 mHz,
  frequency-measurement insensitivity ±10 mHz, full activation within 30 s
  (a battery answers in ~1 s). Limited-energy providers must sustain full FCR
  for a period the TSOs set between 15 and 30 min (SO GL Art. 156) — the
  "endurance" below. The optional fast step below a threshold is an FFR-style
  product (as procured e.g. by Nordic TSOs), not a PSE service.
  The input frequency trace is not changed by the battery: 50 MW is
  negligible against the inertia of the synchronous area.

Ramp smoothing — the plant's ramp limit is a setting agreed with the TSO
(10 % P_n/min = 51 MW/min used as an example); the battery fills the gap
between a ramp-limited POC trajectory and the wind.

Degradation — empirical LFP model (assumptions, not a vendor curve):
cycle loss 20 % SOH after 3000 equivalent full cycles at 80 % DoD, scaled by
(DoD/80 %)^1.5; calendar loss 0.5 % SOH/year; the two add.
"""

from __future__ import annotations

from typing import Any

RATED_POWER_MW = 50.0
RATED_ENERGY_MWH = 200.0
ROUNDTRIP_EFFICIENCY_PCT = 92.0
SOC_MIN_PCT = 10.0
SOC_MAX_PCT = 90.0
NOMINAL_FREQ_HZ = 50.0
FCR_FULL_ACTIVATION_HZ = 0.2
FCR_INSENSITIVITY_HZ = 0.01
LER_MIN_ENDURANCE_MIN = 15.0  # SO GL Art. 156: TSOs set 15–30 min

DESIGN_CYCLE_COUNT = 3000
DESIGN_DOD_PCT = 80.0
DESIGN_EOL_SOH_PCT = 80.0
CALENDAR_FADE_PCT_PER_YEAR = 0.5
REPLACEMENT_COST_M_EUR_PER_MWH = 0.35  # assumption, EUR/kWh system level
RAMP_RATE_LIMIT_MW_PER_MIN = 51.0  # example plant setting (10 % of 510 MW per min)

_ETA = ROUNDTRIP_EFFICIENCY_PCT / 100.0
_MWH_PER_PCT = RATED_ENERGY_MWH / 100.0

_state: dict[str, Any] = {
    "soc_percent": 60.0,
    "power_mw": 0.0,
    "reactive_mvar": 0.0,
    "mode": "STANDBY",
    "temperature_c": 25.0,
    "soh_percent": 99.5,
    "cycle_count": 12,
    "capacity_fade_pct": 0.5,
    "alarms_active": False,
}


def _soc_step(soc: float, p_mw: float, dt_h: float) -> float:
    """SOC after dt with battery power p (positive = discharge)."""
    energy = p_mw * dt_h if p_mw > 0 else p_mw * _ETA * dt_h
    return max(SOC_MIN_PCT, min(SOC_MAX_PCT, soc - energy / _MWH_PER_PCT))


def _limit_by_soc(p_mw: float, soc: float) -> float:
    if p_mw > 0 and soc <= SOC_MIN_PCT:
        return 0.0
    if p_mw < 0 and soc >= SOC_MAX_PCT:
        return 0.0
    return max(-RATED_POWER_MW, min(RATED_POWER_MW, p_mw))


def get_status() -> dict[str, Any]:
    """Current operating state; available energy counts from SOC_min."""
    soc, soh = _state["soc_percent"], _state["soh_percent"]
    rated_energy = RATED_ENERGY_MWH * soh / 100.0
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
        "available_energy_mwh": round(max(0.0, rated_energy * (soc - SOC_MIN_PCT) / 100.0), 2),
        "alarms_active": _state["alarms_active"],
    }


def set_mode(mode: str, power_setpoint_mw: float, soc_target_pct: float) -> dict[str, Any]:
    """Change the operating mode if the SOC allows it."""
    previous, soc = _state["mode"], _state["soc_percent"]
    reason = "Mode change accepted"
    allowed = True
    if mode == "CHARGE" and soc >= SOC_MAX_PCT:
        allowed, reason = False, f"Cannot charge: SOC {soc:.1f} % at the {SOC_MAX_PCT} % maximum"
    elif mode == "DISCHARGE" and soc <= SOC_MIN_PCT:
        allowed, reason = False, f"Cannot discharge: SOC {soc:.1f} % at the {SOC_MIN_PCT} % minimum"
    elif mode == "FREQUENCY_RESPONSE":
        endurance_min = (soc - SOC_MIN_PCT) * _MWH_PER_PCT / RATED_POWER_MW * 60
        if endurance_min < LER_MIN_ENDURANCE_MIN:
            allowed = False
            reason = (
                f"FCR needs ≥ {LER_MIN_ENDURANCE_MIN:.0f} min at full power: "
                f"only {endurance_min:.0f} min left at SOC {soc:.1f} %"
            )
    if allowed:
        _state["mode"] = mode
        p = max(-RATED_POWER_MW, min(RATED_POWER_MW, power_setpoint_mw))
        _state["power_mw"] = 0.0 if mode in ("FREQUENCY_RESPONSE", "RAMP_SMOOTHING") else p
    return {
        "previous_mode": previous,
        "new_mode": _state["mode"],
        "power_setpoint_mw": _state["power_mw"],
        "soc_current_pct": soc,
        "transition_allowed": allowed,
        "reason": reason,
    }


def fcr_power_mw(frequency_hz: float, capacity_mw: float = RATED_POWER_MW) -> float:
    """FCR characteristic (CE): linear to full capacity at ±200 mHz, ±10 mHz insensitivity."""
    df = NOMINAL_FREQ_HZ - frequency_hz
    if abs(df) <= FCR_INSENSITIVITY_HZ:
        return 0.0
    return capacity_mw * max(-1.0, min(1.0, df / FCR_FULL_ACTIVATION_HZ))


def simulate_frequency_response(
    frequency_trace_hz: list[float],
    fcr_capacity_mw: float = RATED_POWER_MW,
    ffr_threshold_hz: float | None = None,
    initial_soc_pct: float = 60.0,
) -> dict[str, Any]:
    """Battery response to a frequency trace (1 s steps): FCR, optional FFR step."""
    soc = initial_soc_pct
    powers: list[float] = []
    socs: list[float] = []
    fcr_on = ffr_on = False
    energy_out = energy_in = 0.0
    dt_h = 1.0 / 3600.0
    for f in frequency_trace_hz:
        p = fcr_power_mw(f, fcr_capacity_mw)
        fcr_on |= p != 0.0
        if ffr_threshold_hz is not None and f < ffr_threshold_hz:
            p = RATED_POWER_MW
            ffr_on = True
        p = _limit_by_soc(p, soc)
        soc = _soc_step(soc, p, dt_h)
        energy_out += max(p, 0.0) * dt_h
        energy_in += max(-p, 0.0) * dt_h
        powers.append(round(p, 3))
        socs.append(round(soc, 3))

    nadir = min(frequency_trace_hz)
    endurance_min = (socs[-1] - SOC_MIN_PCT) * _MWH_PER_PCT / max(fcr_capacity_mw, 1e-6) * 60
    assessment = (
        f"FCR followed the CE characteristic (full {fcr_capacity_mw:.0f} MW at ±200 mHz)"
        + ("; FFR step used" if ffr_on else "")
        + f". Nadir {nadir:.3f} Hz"
        + (
            " — below 49.0 Hz, where under-frequency load shedding starts in CE"
            if nadir < 49.0
            else ""
        )
        + f". Endurance left at full FCR: {endurance_min:.0f} min "
        + ("(≥ 15 min ✓)" if endurance_min >= LER_MIN_ENDURANCE_MIN else "(< 15 min ✗)")
    )
    return {
        "time_s": list(range(len(frequency_trace_hz))),
        "frequency_hz": [round(f, 4) for f in frequency_trace_hz],
        "bess_power_mw": powers,
        "soc_percent": socs,
        "nadir_hz": round(nadir, 4),
        "nadir_time_s": float(frequency_trace_hz.index(nadir)),
        "energy_delivered_mwh": round(energy_out, 4),
        "energy_absorbed_mwh": round(energy_in, 4),
        "fcr_endurance_min": round(endurance_min, 1),
        "fcr_activated": fcr_on,
        "ffr_activated": ffr_on,
        "assessment": assessment,
    }


def simulate_ramp_smoothing(
    wind_power_trace_mw: list[float],
    max_ramp_rate_mw_per_min: float = RAMP_RATE_LIMIT_MW_PER_MIN,
    initial_soc_pct: float = 50.0,
) -> dict[str, Any]:
    """Battery keeps the POC within a ramp limit (1 min steps)."""
    soc = initial_soc_pct
    target = wind_power_trace_mw[0]
    powers: list[float] = []
    socs: list[float] = []
    out: list[float] = []
    before = after = 0
    for i, p_wind in enumerate(wind_power_trace_mw):
        if i:
            before += abs(p_wind - wind_power_trace_mw[i - 1]) > max_ramp_rate_mw_per_min + 1e-9
            target += max(-max_ramp_rate_mw_per_min, min(max_ramp_rate_mw_per_min, p_wind - target))
        p = _limit_by_soc(target - p_wind, soc) if i else 0.0
        poc = p_wind + p
        if out and abs(poc - out[-1]) > max_ramp_rate_mw_per_min + 1e-6:
            after += 1
        target = poc  # the POC really is where the battery could put it
        soc = _soc_step(soc, p, 1.0 / 60.0)
        powers.append(round(p, 3))
        socs.append(round(soc, 2))
        out.append(round(poc, 3))
    assessment = (
        "PASS — every ramp kept within the limit"
        if after == 0
        else f"PARTIAL — {after} of {before} ramp violations remain (power or SOC limit reached)"
        if after < before
        else "FAIL — the battery could not reduce the ramp violations"
    )
    return {
        "wind_power_mw": [round(p, 3) for p in wind_power_trace_mw],
        "bess_power_mw": powers,
        "smoothed_output_mw": out,
        "soc_percent": socs,
        "ramp_violations_before": before,
        "ramp_violations_after": after,
        "peak_bess_charge_mw": round(max(0.0, -min(powers)), 2),
        "peak_bess_discharge_mw": round(max(0.0, max(powers)), 2),
        "assessment": assessment,
    }


def calculate_degradation(years: int, annual_cycles: float, avg_dod_pct: float) -> dict[str, Any]:
    """SOH projection: cycle fade (DoD-scaled) + calendar fade."""
    cycles_to_eol_at_dod = DESIGN_CYCLE_COUNT * (DESIGN_DOD_PCT / avg_dod_pct) ** 1.5
    projection = []
    eol_year = None
    for yr in range(years + 1):
        cycles = yr * annual_cycles
        cycle_loss = cycles / cycles_to_eol_at_dod * (100.0 - DESIGN_EOL_SOH_PCT)
        calendar_loss = yr * CALENDAR_FADE_PCT_PER_YEAR
        soh = max(0.0, 100.0 - cycle_loss - calendar_loss)
        projection.append(
            {
                "year": yr,
                "soh_percent": round(soh, 2),
                "cycle_loss_pct": round(cycle_loss, 2),
                "calendar_loss_pct": round(calendar_loss, 2),
                "cumulative_cycles": round(cycles, 0),
                "capacity_mwh": round(RATED_ENERGY_MWH * soh / 100.0, 1),
            }
        )
        if eol_year is None and soh <= DESIGN_EOL_SOH_PCT:
            eol_year = yr
    eol = eol_year if eol_year is not None else years
    replacement = RATED_ENERGY_MWH * REPLACEMENT_COST_M_EUR_PER_MWH
    throughput = annual_cycles * avg_dod_pct / 100.0 * RATED_ENERGY_MWH * max(eol, 1)
    return {
        "projection": projection,
        "eol_year": eol,
        "eol_reached": eol_year is not None,
        "total_cycles_to_eol": round(eol * annual_cycles, 0),
        "replacement_cost_m_eur": round(replacement, 2),
        "lcoe_contribution_eur_mwh": round(replacement * 1e6 / throughput, 2),
        "assessment": (
            f"End of life (80 % SOH) in year {eol_year}"
            if eol_year is not None
            else f"Still above 80 % SOH after {years} years"
        ),
    }


def dispatch_bess(
    p_target_mw: float,
    p_available_wtg_mw: float,
    current_soc_pct: float,
) -> dict[str, Any]:
    """Meet a POC target with WTGs + battery (positive battery power = discharge).

    Surplus wind charges the battery (WTGs run at target + charge, POC stays
    on target); a wind deficit is covered by discharge up to 50 MW.
    """
    gap = p_target_mw - p_available_wtg_mw
    if gap > 0:
        p_bess = _limit_by_soc(min(gap, RATED_POWER_MW), current_soc_pct)
        p_wtg = p_available_wtg_mw
        mode = "DISCHARGE" if p_bess > 0 else "STANDBY"
        notes = f"Wind deficit {gap:.1f} MW; battery discharges {p_bess:.1f} MW"
    else:
        p_bess = _limit_by_soc(max(gap, -RATED_POWER_MW), current_soc_pct)
        p_wtg = p_target_mw - p_bess  # p_bess ≤ 0: turbines also cover the charging
        mode = "CHARGE" if p_bess < 0 else "STANDBY"
        notes = (
            f"Wind surplus {-gap:.1f} MW; battery charges {-p_bess:.1f} MW instead of curtailing"
            if p_bess < 0
            else "Wind covers the target; battery idle"
        )
    p_poc = p_wtg + p_bess
    return {
        "p_target_mw": round(p_target_mw, 3),
        "p_wtg_dispatch_mw": round(p_wtg, 3),
        "p_bess_mw": round(p_bess, 3),
        "p_poc_mw": round(p_poc, 3),
        "soc_after_pct": round(_soc_step(current_soc_pct, p_bess, 1.0 / 60.0), 3),
        "bess_mode": mode,
        "dispatch_feasible": abs(p_poc - p_target_mw) < 0.5,
        "notes": notes,
    }
