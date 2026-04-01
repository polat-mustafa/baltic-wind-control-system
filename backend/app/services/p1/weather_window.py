"""
Weather Window & O&M Logistics service — M14.

Physics layers
--------------
1. Wave climate model
   Baltic Sea significant wave height Hs follows Weibull distribution.
   Monthly P50 Hs ranges from 0.5 m (July–August) to 1.8 m (December–January).
   CTV limit Hs ≤ 1.5 m → inaccessible ~15–20% of winter days.

2. Vessel access probability
   P(access) = P(Hs ≤ Hs_limit) × P(Vw ≤ Vw_limit)
   Wind and wave are correlated (r ≈ 0.7 for Baltic offshore).
   Simplified: monthly P(Hs ≤ limit) from climatological exceedance curves.

3. Wait-for-window model
   Expected wait = (1 - P_access) / P_access × mean_window_duration
   With P_access = 70% and mean window = 48h → expected wait ≈ 0.43 × 48h ≈ 21h
   Adds geometric distribution: P(wait > T) = (1 - p_day)^T

4. O&M cost model
   Planned maintenance: ~80% cheaper than unplanned (no call-out, no emergency vessel)
   Unplanned: vessel day-rate × (wait_days + repair_days) + technician day-rates
   Heavy lift: jack-up charter ~€150k/day + crane crew + specialised parts

References
----------
DNVGL-RP-O101    Offshore wind O&M operational philosophy
IEC 61400-26-1   Availability categories (links to M13)
Offshore Wind O&M Market Report 2024 (Bloomberg NEF) — EUR 80-120/MW/year benchmark
"""

from __future__ import annotations

import math
from typing import Any

# ── Constants ─────────────────────────────────────────────────────────────────

# Baltic Sea monthly mean significant wave height P50 [m] — Jan..Dec
# Source: CMEMS Baltic Sea wave reanalysis (BAL-PHY-WAV-007) 2000–2020 average
_MONTHLY_HS_P50 = [1.7, 1.6, 1.4, 1.0, 0.8, 0.6, 0.6, 0.7, 0.9, 1.2, 1.5, 1.8]

# Baltic Sea monthly mean wind speed [m/s] — Jan..Dec (10 m height)
_MONTHLY_VW_MEAN = [9.5, 9.2, 8.8, 7.5, 6.8, 6.5, 6.3, 6.6, 7.4, 8.2, 9.0, 9.6]

# Vessel operational limits
_VESSEL_HS_LIMIT = {
    "CTV": 1.5,
    "SOV": 2.5,
    "JACK_UP": 2.0,
    "HELICOPTER": 99.0,  # Hs not limiting — wind speed is
}
_VESSEL_VW_LIMIT = {
    "CTV": 10.0,
    "SOV": 15.0,
    "JACK_UP": 8.0,
    "HELICOPTER": 12.0,
}

# Vessel costs (EUR/day)
_VESSEL_DAY_RATE = {
    "CTV": 4_000,
    "SOV": 30_000,
    "JACK_UP": 150_000,
    "HELICOPTER": 20_000,
}

_VESSEL_MOBILISATION_EUR = {
    "CTV": 5_000,
    "SOV": 50_000,
    "JACK_UP": 250_000,
    "HELICOPTER": 10_000,
}

TECHNICIAN_DAY_RATE_EUR = 800  # offshore day-rate
TECHNICIANS_CTV = 10
TECHNICIANS_SOV = 20
TECHNICIANS_JACKUP = 8  # specialised crane crew

LOCATION = "Baltic Wind Alpha — offshore Polish EEZ (54.5°N, 16.0°E)"
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


# ── Core probability model ────────────────────────────────────────────────────


def _wave_exceedance_prob(hs_mean: float, hs_limit: float) -> float:
    """
    Approximate P(Hs ≤ hs_limit) using Rayleigh distribution.

    P(Hs > x) ≈ exp(-π/4 × (x/Hs_mean)^2)
    This is the standard Rayleigh CDF for wave height.
    """
    if hs_limit >= 3.0 * hs_mean:
        return 1.0
    exponent = -math.pi / 4.0 * (hs_limit / max(0.01, hs_mean)) ** 2
    return 1.0 - math.exp(exponent)


def _wind_exceedance_prob(vw_mean: float, vw_limit: float) -> float:
    """
    Approximate P(Vw ≤ vw_limit) using Weibull k=2 (Rayleigh).

    P(Vw > x) ≈ exp(-(x / (vw_mean × 2/√π))^2)
    """
    if vw_limit >= 3.0 * vw_mean:
        return 1.0
    # Scale parameter c = vw_mean * 2/sqrt(π)
    c = vw_mean * 2.0 / math.sqrt(math.pi)
    exponent = -((vw_limit / max(0.01, c)) ** 2)
    return 1.0 - math.exp(exponent)


def _monthly_access_probability(vessel: str, month_idx: int) -> float:
    """
    Access probability [0–1] for a given vessel and month (0=Jan, 11=Dec).

    Assumes Hs and Vw are independently distributed (conservative).
    """
    hs_mean = _MONTHLY_HS_P50[month_idx]
    vw_mean = _MONTHLY_VW_MEAN[month_idx]
    p_wave = _wave_exceedance_prob(hs_mean, _VESSEL_HS_LIMIT[vessel])
    p_wind = _wind_exceedance_prob(vw_mean, _VESSEL_VW_LIMIT[vessel])
    return min(1.0, p_wave * p_wind)


# ── Public API ────────────────────────────────────────────────────────────────


def get_vessel_access(vessel: str) -> dict[str, Any]:
    """
    Return monthly access probability and annual average for a vessel type.
    """
    monthly_pct = [round(100.0 * _monthly_access_probability(vessel, m), 1) for m in range(12)]
    annual_avg = round(sum(monthly_pct) / 12.0, 1)

    # Determine limiting parameter
    hs_limit = _VESSEL_HS_LIMIT[vessel]
    vw_limit = _VESSEL_VW_LIMIT[vessel]
    # Compare at average annual conditions
    avg_hs = sum(_MONTHLY_HS_P50) / 12.0
    avg_vw = sum(_MONTHLY_VW_MEAN) / 12.0
    p_wave = _wave_exceedance_prob(avg_hs, hs_limit)
    p_wind = _wind_exceedance_prob(avg_vw, vw_limit)
    limiting = "Hs (wave height)" if p_wave < p_wind else "Vw (wind speed)"

    return {
        "location": LOCATION,
        "vessel": vessel,
        "monthly_access_pct": monthly_pct,
        "annual_average_pct": annual_avg,
        "limiting_parameter": limiting,
    }


def get_all_vessel_access(year: int = 2025) -> dict[str, Any]:
    """Return access probabilities for all four vessel types."""
    vessels = [get_vessel_access(v) for v in ("CTV", "SOV", "JACK_UP", "HELICOPTER")]
    return {
        "location": LOCATION,
        "year": year,
        "vessels": vessels,
    }


def find_maintenance_window(
    failure_date_iso: str,
    vessel: str,
    repair_duration_hours: float,
    turbine_id: str,
) -> dict[str, Any]:
    """
    Estimate next weather window for a repair job.

    Uses geometric distribution: each day has P(accessible) chance.
    Expected wait = (1 - P) / P days.
    Window must accommodate repair_duration_hours of continuous work.
    """
    from datetime import date, timedelta

    failure_date = date.fromisoformat(failure_date_iso)
    failure_month = failure_date.month - 1  # 0-indexed

    p_daily = _monthly_access_probability(vessel, failure_month)

    # Expected wait before getting the needed continuous window
    # For a T-hour window: probability per day that a T-hour block is accessible
    # Simplified: treat each day as one opportunity with p_daily probability
    if p_daily < 0.01:
        expected_wait_days = 30.0
    else:
        # Geometric expected wait = (1 - p) / p days
        repair_days = repair_duration_hours / 24.0
        # Longer windows are rarer — adjust probability
        effective_p = p_daily ** max(1.0, repair_days)
        expected_wait_days = (1.0 - effective_p) / max(0.001, effective_p)
        expected_wait_days = min(expected_wait_days, 60.0)

    wait_days = round(expected_wait_days, 1)
    window_start = failure_date + timedelta(days=wait_days)
    total_downtime = wait_days + repair_duration_hours / 24.0

    # Cost estimate
    repair_calendar_days = math.ceil(repair_duration_hours / 8.0)  # 8h work/day
    vessel_day_rate = _VESSEL_DAY_RATE[vessel]
    mobilisation = _VESSEL_MOBILISATION_EUR[vessel]

    tech_count = {
        "CTV": TECHNICIANS_CTV,
        "SOV": TECHNICIANS_SOV,
        "JACK_UP": TECHNICIANS_JACKUP,
        "HELICOPTER": 4,
    }[vessel]
    labour_eur = tech_count * TECHNICIAN_DAY_RATE_EUR * repair_calendar_days
    vessel_eur = vessel_day_rate * (math.ceil(wait_days) + repair_calendar_days)

    # Parts cost estimate (rough — unplanned events carry uncertainty)
    parts_base = {"CTV": 5_000, "SOV": 20_000, "JACK_UP": 500_000, "HELICOPTER": 10_000}
    parts_eur = parts_base[vessel]

    total_cost = mobilisation + vessel_eur + labour_eur + parts_eur

    return {
        "turbine_id": turbine_id,
        "failure_date_iso": failure_date_iso,
        "vessel_type": vessel,
        "repair_duration_hours": repair_duration_hours,
        "estimated_window_start_iso": window_start.isoformat(),
        "wait_days": wait_days,
        "total_downtime_days": round(total_downtime, 1),
        "access_probability_pct": round(100.0 * p_daily, 1),
        "cost_estimate_eur": round(total_cost, 0),
        "cost_breakdown": {
            "vessel_day_rate_eur": round(vessel_eur, 0),
            "mobilisation_eur": round(mobilisation, 0),
            "labour_eur": round(labour_eur, 0),
            "parts_eur": round(parts_eur, 0),
        },
    }


def get_oam_cost_breakdown(
    n_turbines: int = 34,
    turbine_rated_mw: float = 15.0,
    planned_events_per_turbine: float = 1.0,
    unplanned_events_per_turbine: float = 6.0,
    heavy_lift_events_per_year: float = 2.0,
) -> dict[str, Any]:
    """
    Annual O&M cost model for the wind farm.

    Industry benchmark: EUR 80–120/MW/year for modern offshore.
    Planned maintenance 60-80% cheaper than unplanned (no call-out premium).
    """
    installed_mw = n_turbines * turbine_rated_mw

    # Planned maintenance (CTV, scheduled during weather window)
    planned_cost_per_event = (
        _VESSEL_MOBILISATION_EUR["CTV"]
        + _VESSEL_DAY_RATE["CTV"] * 2
        + TECHNICIANS_CTV * TECHNICIAN_DAY_RATE_EUR * 1
    )
    planned_eur = planned_cost_per_event * planned_events_per_turbine * n_turbines

    # Unplanned (CTV, unscheduled call-out — higher wait/mobilisation)
    unplanned_cost_per_event = (
        _VESSEL_MOBILISATION_EUR["CTV"] * 2  # emergency premium
        + _VESSEL_DAY_RATE["CTV"] * 3  # wait + repair
        + TECHNICIANS_CTV * TECHNICIAN_DAY_RATE_EUR * 1
        + 8_000  # avg parts per fault
    )
    unplanned_eur = unplanned_cost_per_event * unplanned_events_per_turbine * n_turbines

    # Vessel charter (SOV seasonal contract — 6-month summer campaign)
    sov_charter_eur = _VESSEL_DAY_RATE["SOV"] * 180  # 6 months

    # Heavy lift (jack-up)
    jackup_eur = (
        _VESSEL_MOBILISATION_EUR["JACK_UP"]
        + _VESSEL_DAY_RATE["JACK_UP"] * 5  # avg 5 days per heavy lift
        + 200_000  # avg parts (bearing/blade section)
    ) * heavy_lift_events_per_year

    # Insurance (0.5% of capex; assume capex = 2000 EUR/kW × installed MW)
    capex_eur = 2_000 * installed_mw * 1_000
    insurance_eur = 0.005 * capex_eur

    total_eur = planned_eur + unplanned_eur + sov_charter_eur + jackup_eur + insurance_eur
    per_mw = total_eur / max(1.0, installed_mw)

    if per_mw < 80_000:
        assessment = "BELOW BENCHMARK -- verify inputs; industry range EUR 80-120k/MW/year"
    elif per_mw <= 120_000:
        assessment = f"WITHIN BENCHMARK -- EUR {per_mw / 1000:.0f}k/MW/year (industry: 80-120k)"
    else:
        assessment = (
            f"ABOVE BENCHMARK — EUR {per_mw / 1000:.0f}k/MW/year; "
            "review vessel strategy or maintenance frequency"
        )

    return {
        "total_oam_eur": round(total_eur, 0),
        "per_mw_eur": round(per_mw, 0),
        "planned_maintenance_eur": round(planned_eur, 0),
        "unplanned_maintenance_eur": round(unplanned_eur, 0),
        "vessel_charter_eur": round(sov_charter_eur, 0),
        "heavy_lift_eur": round(jackup_eur, 0),
        "insurance_eur": round(insurance_eur, 0),
        "assessment": assessment,
    }
