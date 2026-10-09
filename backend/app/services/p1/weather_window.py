"""
Weather Window & O&M Logistics service — M14.

Physics layers
--------------
1. Wave climate — measured
   30-year ERA5 hindcast at the site (lifecycle.weather): monthly mean of the 6-hourly
   worst-hour Hs, 0.79 m (May) to 1.66 m (January).

2. Vessel access probability
   P(access) = share of hindcast 6-hour steps with Hs ≤ Hs_limit AND Vw ≤ Vw_limit,
   per month — the joint frequency, so the wind–wave correlation is the real one.

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

from app.core.exceptions import ValidationError
from app.services.lifecycle import weather

# ── Constants ─────────────────────────────────────────────────────────────────

# Monthly mean Hs [m] and 10 m wind [m/s] (6-hourly worst hour), Jan..Dec, from the real
# SB-510 hindcast (ERA5 waves + wind 1995–2024, lifecycle.weather). The earlier hand-typed
# Rayleigh inputs and the independence assumption gave CTV 55 % access a year; the
# measured joint frequency gives 68 % (wind and waves calm down together).
_MONTHLY_HS_P50 = [round(float(x), 2) for x in weather.HS_MEAN]
_MONTHLY_VW_MEAN = [round(float(x), 2) for x in weather.VW_MEAN]

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

# Working day and CTV transit — NREL WOMBAT defaults (library/default/project/config/
# base_osw_fixed.yaml: workday 07–19; vessels/ctv.yaml: speed 37.04 km/h = 20 kn).
WORKDAY_HOURS = 12.0
CTV_SPEED_KMH = 37.04
#: SB-510's O&M port by sea: Ustka, 52.5 km to the nearest turbine of the site
#: (site assessment, `test_sb510_ports_by_sea`).
SB510_OM_PORT_KM = 52.5
TECHNICIANS_CTV = 10
TECHNICIANS_SOV = 20
TECHNICIANS_JACKUP = 8  # specialised crane crew

LOCATION = "SB-510 — offshore Polish EEZ, site PZP_44 (55.06°N, 16.54°E)"
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


# ── Core probability model ────────────────────────────────────────────────────


def _monthly_access_probability(vessel: str, month_idx: int) -> float:
    """
    Access probability [0–1] for a given vessel and month (0=Jan, 11=Dec).

    Measured, not modelled: the share of 6-hour steps of that month in the 30-year
    hindcast with Hs AND wind both inside the vessel limits — the real wind–wave
    correlation included (the Rayleigh × Weibull product assumed independence).
    """
    access = weather.monthly_access(_VESSEL_HS_LIMIT[vessel], _VESSEL_VW_LIMIT[vessel])
    return float(access[month_idx])


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
    # Which limit closes more of the year on its own (measured marginals)
    _, hs_all, vw_all = weather.hindcast()
    p_wave = float((hs_all <= hs_limit).mean())
    p_wind = float((vw_all <= vw_limit).mean())
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
    ice = weather.ice_climate()
    return {
        "location": LOCATION,
        "year": year,
        "vessels": vessels,
        "hindcast": weather.HINDCAST_SOURCE,
        "sea_ice": {
            **ice,
            "note": "Passive-microwave ice in a cell 37 km offshore; isolated days in mild "
            "winters may be coastal or wet-snow artefacts. Ice at PZP_44 is rare and brief — "
            "no ice-class foundation design driver, but a winter access risk.",
        },
    }


def find_maintenance_window(
    failure_date_iso: str,
    vessel: str,
    repair_duration_hours: float,
    turbine_id: str,
    port_km: float = SB510_OM_PORT_KM,
) -> dict[str, Any]:
    """
    Estimate next weather window for a repair job.

    Work per day = the 12 h working day minus the CTV transit out and back
    (port_km by sea at 20 kn); vessels that stay offshore lose no transit.

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

    # Cost estimate: work per day after the CTV transit (WOMBAT working day)
    transit_h = port_km / CTV_SPEED_KMH if vessel == "CTV" else 0.0
    work_h = WORKDAY_HOURS - 2.0 * transit_h
    if work_h <= 0.5:
        raise ValidationError(
            f"CTV transit {transit_h:.1f} h each way leaves no working time: use an SOV"
        )
    repair_calendar_days = math.ceil(repair_duration_hours / work_h)
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
        "port_km": port_km,
        "transit_hours": round(transit_h, 2),
        "work_hours_per_day": round(work_h, 2),
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
    Bottom-up annual cost of maintenance and marine logistics.

    Covers planned/unplanned visits, SOV charter, heavy lifts and insurance.
    It is a SUBSET of total OPEX: OEM service agreements, port/base, permanent
    staff, seabed lease and grid charges are not modelled. Total offshore
    OPEX is typically EUR 70–120k/MW/year (IRENA renewable cost reports), so
    the result is reported as a share of that range, not judged against it.
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

    # Insurance (0.5 % of CAPEX; CAPEX 3200 EUR/kW as in the M04 comparison)
    capex_eur = 3_200 * installed_mw * 1_000
    insurance_eur = 0.005 * capex_eur

    total_eur = planned_eur + unplanned_eur + sov_charter_eur + jackup_eur + insurance_eur
    per_mw = total_eur / max(1.0, installed_mw)

    assessment = (
        f"Maintenance & logistics (bottom-up) EUR {per_mw / 1000:.0f}k/MW/year — "
        f"{per_mw / 120_000 * 100:.0f}–{per_mw / 70_000 * 100:.0f} % of a typical total "
        "OPEX of EUR 70–120k/MW/year (service contract, base, staff, lease and grid "
        "charges not modelled)"
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
