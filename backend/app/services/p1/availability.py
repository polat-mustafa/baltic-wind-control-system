"""
Availability Tracking service — M13 (IEC 61400-26).

Physics layers
--------------
1. Time-Based Availability (TBA)
   TBA = T_producing / T_total * 100 %
   T_producing = T_total - T_scheduled - T_unscheduled - T_force_majeure

2. Energy-Based Availability (EBA)
   EBA = E_actual / E_theoretical * 100 %
   E_theoretical = integral(P_power_curve(v_t) * dt, 0..T_total)
   Penalises downtime during high-wind periods more than low-wind periods.

3. Production-Based Availability (PBA) — IEC 61400-26-2:2014
   PBA = 1 - (E_lost_avoidable / E_theoretical) * 100 %
   Only counts avoidable losses (maintenance), not force majeure.
   Most rigorous and used in lender/investor reporting.

4. MTBF / MTTR
   MTBF = T_total / N_faults  [hours between faults]
   MTTR = sum(T_repair) / N_faults  [hours per repair]

5. Revenue loss
   Revenue_lost = E_lost * avg_price_eur_mwh
   Unscheduled maintenance is 3-5x more expensive than scheduled
   (call-out costs, helicopter/vessel mobilisation offshore).

References
----------
IEC 61400-26-1:2019 — Availability for wind turbine systems (TBA/EBA definitions)
IEC 61400-26-2:2014 — Production-based availability (PBA)
DNVGL-ST-0362       — Certification of condition monitoring systems (links to M12)
PSE IRiESP          — Availability reports required for Type D generators
"""

from __future__ import annotations

import random
from typing import Any

# ── Constants ─────────────────────────────────────────────────────────────────

NUM_TURBINES = 34
TURBINE_RATED_MW = 15.0
DA_PRICE_EUR_MWH = 75.0  # average price for revenue loss calculation

# IEC 61400-26 availability benchmarks for offshore wind
TARGET_TBA_PCT = 97.0
TARGET_EBA_PCT = 95.0
TARGET_PBA_PCT = 94.0

# V236-15.0 MW operating characteristics
CAPACITY_FACTOR_AVG = 0.50  # 50% average capacity factor (Baltic Sea)
FULL_LOAD_HOURS_YEAR = CAPACITY_FACTOR_AVG * 8760  # 4380 FLH/year

# In-memory downtime log
_downtime_events: list[dict[str, Any]] = []


def _generate_synthetic_events(turbine_id: str, period_hours: float) -> list[dict[str, Any]]:
    """
    Generate realistic synthetic downtime history for a turbine.

    Based on typical offshore V236 SCADA data:
    - Scheduled maintenance: 1×/year (120h turbine downtime) → ~1.4%
    - Unscheduled fault: 4-8/year (avg 8h each) → ~0.4-0.8%
    - Grid curtailment: ~50h/year (PSE congestion management) → ~0.6%
    - Force majeure: ~20h/year (icing, extreme weather) → ~0.2%
    """
    rng = random.Random(_seed_from_turbine_id(turbine_id))
    events = []

    hours_per_year = 8760.0
    scale = period_hours / hours_per_year

    # Scheduled maintenance (1 event/year)
    n_scheduled = max(0, round(rng.normalvariate(1.0, 0.3) * scale))
    for _ in range(n_scheduled):
        duration = rng.uniform(100.0, 140.0)
        events.append(
            {
                "category": "SCHEDULED_MAINTENANCE",
                "duration_hours": duration,
                "energy_loss_mwh": duration * TURBINE_RATED_MW * CAPACITY_FACTOR_AVG,
            }
        )

    # Unscheduled faults (6/year average, 8h average per fault)
    n_unscheduled = max(0, round(rng.normalvariate(6.0, 2.0) * scale))
    for _ in range(n_unscheduled):
        duration = rng.lognormvariate(2.0, 0.7)  # log-normal: most short, some long
        duration = min(duration, 168.0)  # cap at 7 days
        events.append(
            {
                "category": "UNSCHEDULED_MAINTENANCE",
                "duration_hours": duration,
                "energy_loss_mwh": duration * TURBINE_RATED_MW * CAPACITY_FACTOR_AVG,
            }
        )

    # Grid curtailment
    n_curtailment = max(0, round(rng.normalvariate(4.0, 1.5) * scale))
    for _ in range(n_curtailment):
        duration = rng.uniform(4.0, 20.0)
        events.append(
            {
                "category": "GRID_CURTAILMENT",
                "duration_hours": duration,
                "energy_loss_mwh": duration * TURBINE_RATED_MW * 0.7,  # partial production
            }
        )

    # Force majeure (icing etc.)
    n_fm = max(0, round(rng.normalvariate(2.0, 1.0) * scale))
    for _ in range(n_fm):
        duration = rng.uniform(4.0, 16.0)
        events.append(
            {
                "category": "FORCE_MAJEURE",
                "duration_hours": duration,
                "energy_loss_mwh": duration * TURBINE_RATED_MW * CAPACITY_FACTOR_AVG,
            }
        )

    return events


def get_fleet_availability(period_hours: float = 8760.0) -> dict[str, Any]:
    """
    Compute IEC 61400-26 availability KPIs for the entire Baltic Wind fleet.

    Parameters
    ----------
    period_hours : float
        Analysis period [hours]. Default = 8760 (1 year).
    """
    turbines = []
    fleet_tba_sum = 0.0
    fleet_eba_sum = 0.0
    fleet_pba_sum = 0.0
    total_energy_loss = 0.0
    total_revenue_loss = 0.0
    worst_tba = 100.0
    worst_id = "WTG-01"
    best_tba = 0.0
    best_id = "WTG-01"

    for i in range(1, NUM_TURBINES + 1):
        tid = f"WTG-{i:02d}"
        kpi = get_turbine_availability(tid, period_hours)
        turbines.append(kpi)
        fleet_tba_sum += kpi["tba_pct"]
        fleet_eba_sum += kpi["eba_pct"]
        fleet_pba_sum += kpi["pba_pct"]
        total_energy_loss += kpi["energy_loss_mwh"]
        total_revenue_loss += kpi["energy_loss_mwh"] * DA_PRICE_EUR_MWH
        if kpi["tba_pct"] < worst_tba:
            worst_tba = kpi["tba_pct"]
            worst_id = tid
        if kpi["tba_pct"] > best_tba:
            best_tba = kpi["tba_pct"]
            best_id = tid

    fleet_tba = fleet_tba_sum / NUM_TURBINES
    fleet_eba = fleet_eba_sum / NUM_TURBINES
    fleet_pba = fleet_pba_sum / NUM_TURBINES

    # Fleet MTBF/MTTR (aggregate)
    total_faults = sum(t["fault_count"] for t in turbines)
    fleet_mtbf = period_hours * NUM_TURBINES / max(1, total_faults)
    total_repair_time = sum(t["hours_unscheduled_maintenance"] for t in turbines)
    fleet_mttr = total_repair_time / max(1, total_faults)

    assessment = _fleet_assessment(fleet_tba, fleet_eba)

    return {
        "period_start": "2025-01-01T00:00:00Z",
        "period_end": "2025-12-31T23:59:59Z",
        "turbines": turbines,
        "fleet_tba_pct": round(fleet_tba, 2),
        "fleet_eba_pct": round(fleet_eba, 2),
        "fleet_pba_pct": round(fleet_pba, 2),
        "total_energy_loss_mwh": round(total_energy_loss, 1),
        "total_revenue_loss_eur": round(total_revenue_loss, 0),
        "worst_turbine": worst_id,
        "best_turbine": best_id,
        "fleet_mtbf_hours": round(fleet_mtbf, 1),
        "fleet_mttr_hours": round(fleet_mttr, 1),
        "assessment": assessment,
    }


def get_turbine_availability(turbine_id: str, period_hours: float = 8760.0) -> dict[str, Any]:
    """
    Compute IEC 61400-26 KPIs for a single turbine.

    Uses synthetic event generator seeded by turbine_id for deterministic demo data.
    In production: queries TimescaleDB downtime event table.
    """
    events = _generate_synthetic_events(turbine_id, period_hours)

    def _sum_cat(cat: str) -> float:
        return float(sum(e["duration_hours"] for e in events if e["category"] == cat))

    hours_scheduled = _sum_cat("SCHEDULED_MAINTENANCE")
    hours_unscheduled = _sum_cat("UNSCHEDULED_MAINTENANCE")
    hours_fm = _sum_cat("FORCE_MAJEURE")
    hours_curtailment = _sum_cat("GRID_CURTAILMENT")
    hours_producing = max(
        0.0, period_hours - hours_scheduled - hours_unscheduled - hours_fm - hours_curtailment
    )
    fault_count = sum(1 for e in events if e["category"] == "UNSCHEDULED_MAINTENANCE")

    # TBA: simple time fraction
    tba = 100.0 * hours_producing / period_hours

    # EBA: weighted by theoretical energy production (assume avg CF)
    energy_theoretical = period_hours * TURBINE_RATED_MW * CAPACITY_FACTOR_AVG
    energy_loss = sum(e["energy_loss_mwh"] for e in events)
    energy_actual = max(0.0, energy_theoretical - energy_loss)
    eba = 100.0 * energy_actual / energy_theoretical

    # PBA: exclude force majeure and curtailment from avoidable losses
    avoidable_loss = sum(
        e["energy_loss_mwh"]
        for e in events
        if e["category"] in ("SCHEDULED_MAINTENANCE", "UNSCHEDULED_MAINTENANCE")
    )
    pba = 100.0 * (energy_theoretical - avoidable_loss) / energy_theoretical

    mtbf = period_hours / max(1, fault_count)
    mttr = hours_unscheduled / max(1, fault_count)

    return {
        "turbine_id": turbine_id,
        "period_hours": period_hours,
        "tba_pct": round(tba, 2),
        "eba_pct": round(max(0.0, eba), 2),
        "pba_pct": round(max(0.0, pba), 2),
        "hours_producing": round(hours_producing, 1),
        "hours_scheduled_maintenance": round(hours_scheduled, 1),
        "hours_unscheduled_maintenance": round(hours_unscheduled, 1),
        "hours_force_majeure": round(hours_fm, 1),
        "hours_curtailment": round(hours_curtailment, 1),
        "hours_unknown": 0.0,
        "energy_loss_mwh": round(energy_loss, 1),
        "mtbf_hours": round(mtbf, 1),
        "mttr_hours": round(mttr, 1),
        "fault_count": fault_count,
    }


def get_downtime_breakdown(scope: str, period_hours: float = 8760.0) -> dict[str, Any]:
    """
    IEC 61400-26 downtime breakdown by category.

    Parameters
    ----------
    scope : str
        'FLEET' for all 34 turbines, or specific turbine ID ('WTG-01').
    """
    if scope == "FLEET":
        all_events = []
        for i in range(1, NUM_TURBINES + 1):
            all_events.extend(_generate_synthetic_events(f"WTG-{i:02d}", period_hours))
        total_hours = period_hours * NUM_TURBINES
    else:
        all_events = _generate_synthetic_events(scope, period_hours)
        total_hours = period_hours

    category_totals: dict[str, float] = {}
    category_energy: dict[str, float] = {}
    for event in all_events:
        cat = event["category"]
        category_totals[cat] = category_totals.get(cat, 0.0) + event["duration_hours"]
        category_energy[cat] = category_energy.get(cat, 0.0) + event["energy_loss_mwh"]

    total_downtime = sum(category_totals.values())
    categories = []
    for cat, hours in sorted(category_totals.items(), key=lambda x: -x[1]):
        revenue_loss = category_energy.get(cat, 0.0) * DA_PRICE_EUR_MWH
        categories.append(
            {
                "category": cat,
                "hours": round(hours, 1),
                "share_pct": round(100.0 * hours / max(1.0, total_downtime), 1),
                "energy_loss_mwh": round(category_energy.get(cat, 0.0), 1),
                "revenue_loss_eur": round(revenue_loss, 0),
            }
        )

    dominant = categories[0]["category"] if categories else "UNKNOWN"

    # Controllable: scheduled + unscheduled (not FM or curtailment)
    controllable_hours = category_totals.get("SCHEDULED_MAINTENANCE", 0.0) + category_totals.get(
        "UNSCHEDULED_MAINTENANCE", 0.0
    )
    controllable_pct = 100.0 * controllable_hours / max(1.0, total_hours)

    if controllable_pct < 2.0:
        assessment = "EXCELLENT — controllable downtime below 2% target"
    elif controllable_pct < 4.0:
        assessment = "GOOD — controllable downtime within acceptable range"
    else:
        assessment = "REVIEW — controllable downtime above 4%; investigate maintenance efficiency"

    return {
        "scope": scope,
        "period_hours": total_hours,
        "categories": categories,
        "dominant_category": dominant,
        "controllable_loss_pct": round(controllable_pct, 2),
        "assessment": assessment,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────


def _seed_from_turbine_id(turbine_id: str) -> int:
    """Deterministic seed from turbine ID string."""
    return sum(ord(c) for c in turbine_id) * 31


def _fleet_assessment(tba: float, eba: float) -> str:
    if tba >= TARGET_TBA_PCT and eba >= TARGET_EBA_PCT:
        return (
            f"EXCELLENT — Fleet TBA {tba:.1f}% >= {TARGET_TBA_PCT}%,"
            f" EBA {eba:.1f}% >= {TARGET_EBA_PCT}%"
        )
    if tba >= 95.0 and eba >= 93.0:
        return f"GOOD — TBA {tba:.1f}%, EBA {eba:.1f}%; within typical offshore range"
    return f"REVIEW — TBA {tba:.1f}%, EBA {eba:.1f}%; investigate high-downtime turbines"
