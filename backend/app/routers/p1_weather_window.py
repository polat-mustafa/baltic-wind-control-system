"""
Weather Window & O&M Logistics API endpoints — M14.

Endpoints
---------
GET    /api/v1/wind/weather-windows                    — All vessel access probabilities
GET    /api/v1/wind/weather-windows/{vessel}           — Single vessel monthly probabilities
POST   /api/v1/wind/maintenance-scheduling             — Find next window + cost estimate
GET    /api/v1/wind/oam-cost                           — Annual O&M cost model

Standards
---------
DNVGL-RP-O101 — Offshore wind O&M operational philosophy
IEC 61400-26  — Availability (downtime categories)
"""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.weather_window import (
    AccessProbabilityResponse,
    AllVesselAccessResponse,
    MaintenanceWindowRequest,
    MaintenanceWindowResponse,
    OAMCostBreakdown,
    OAMCostRequest,
    VesselType,
)
from app.services.p1 import weather_window as svc

router = APIRouter(tags=["M14 Weather Window O&M Logistics"])


@router.get(
    "/weather-windows",
    response_model=AllVesselAccessResponse,
    summary="Monthly vessel access probability — all vessel types",
)
async def get_all_vessel_access(year: int = 2025) -> AllVesselAccessResponse:
    """
    Return monthly access probability for CTV, SOV, Jack-up, and Helicopter.

    **Why access probability matters:**

    Baltic Sea significant wave height (Hs) varies from 0.5 m in summer to 1.8 m
    in winter. CTV vessels (crew transfers) are limited to Hs ≤ 1.5 m — meaning
    technicians cannot access turbines during ~40% of December/January days.

    **Consequence for O&M planning:**

    A major gearbox failure in January may wait 2–3 weeks for a CTV window.
    The same fault in July might be repaired within 24 hours.
    This drives O&M cost differences of 3–5× between summer and winter faults.

    **Vessel types and their use cases:**

    | Vessel | Hs limit | Vw limit | Typical use |
    |--------|----------|----------|-------------|
    | CTV | 1.5 m | 10 m/s | Routine, small faults |
    | SOV | 2.5 m | 15 m/s | Campaigns, extended stays |
    | Jack-up | 2.0 m | 8 m/s | Heavy lift (blade, main bearing) |
    | Helicopter | — | 12 m/s | Emergency, fast response |

    SOV vessels dramatically extend the accessible campaign season — they can
    maintain station in conditions where CTV vessels would return to port.
    The higher daily charter rate (€30k vs €4k) is often justified by the
    reduction in total downtime and repeat vessel mobilisations.
    """
    result = svc.get_all_vessel_access(year)
    return AllVesselAccessResponse(**result)


@router.get(
    "/weather-windows/{vessel}",
    response_model=AccessProbabilityResponse,
    summary="Monthly access probability for a specific vessel type",
)
async def get_vessel_access(vessel: VesselType) -> AccessProbabilityResponse:
    """
    Return monthly access probability for a specific vessel type.

    **Physics of the access model:**

    Significant wave height Hs follows a Rayleigh distribution (k=2 Weibull).
    P(Hs ≤ H_limit) = 1 - exp(-π/4 × (H_limit/Hs_mean)²)

    Wind speed follows Weibull k=2:
    P(Vw ≤ V_limit) = 1 - exp(-(V_limit/c)²) where c = Vw_mean × 2/√π

    Total access probability = P(Hs ≤ limit) × P(Vw ≤ limit).
    This is conservative (assumes wind and wave are independent; in reality
    they are correlated at r≈0.7, meaning the true access probability is
    slightly higher).
    """
    result = svc.get_vessel_access(vessel.value)
    return AccessProbabilityResponse(**result)


@router.post(
    "/maintenance-scheduling",
    response_model=MaintenanceWindowResponse,
    summary="Find next weather window + O&M cost estimate",
)
async def find_maintenance_window(
    request: MaintenanceWindowRequest,
) -> MaintenanceWindowResponse:
    """
    Estimate when the next accessible weather window will occur and total repair cost.

    **Wait-for-window model:**

    Each day has P(accessible) probability of meeting vessel operating limits.
    The number of days waiting follows a geometric distribution:

    Expected wait = (1 - P_daily) / P_daily days

    For a multi-day repair, the effective daily probability is reduced:
    P_effective = P_daily ^ repair_days  (requires consecutive accessible days)

    **Cost components:**
    - Vessel day-rate × (wait + repair) days
    - Mobilisation fee (crane pre-positioning, crew transit)
    - Technician day-rates (10 offshore techs @ €800/day for CTV)
    - Parts estimate (varies widely: €5k routine → €500k+ for main bearing)

    **Unplanned vs planned cost premium:**
    Unplanned call-outs add 2× mobilisation premium for emergency standby vessel
    positioning. This is why CMS-based predictive maintenance (M12) typically
    shows 3–5× ROI — avoiding the emergency call-out premium alone often pays
    for the CMS system.
    """
    result = svc.find_maintenance_window(
        request.failure_date_iso,
        request.vessel_type.value,
        request.repair_duration_hours,
        request.turbine_id,
    )
    return MaintenanceWindowResponse(**result)


@router.get(
    "/oam-cost",
    response_model=OAMCostBreakdown,
    summary="Annual O&M cost model (EUR/MW benchmark)",
)
async def get_oam_cost(
    n_turbines: int = 34,
    turbine_rated_mw: float = 15.0,
    planned_events_per_turbine: float = 1.0,
    unplanned_events_per_turbine: float = 6.0,
    heavy_lift_events_per_year: float = 2.0,
) -> OAMCostBreakdown:
    """
    Annual O&M cost breakdown with industry benchmark comparison.

    **Industry benchmark (Bloomberg NEF Offshore Wind O&M 2024):**
    EUR 80,000–120,000 per MW installed per year for modern offshore wind.

    At 510 MW (34 × V236-15.0 MW), that's EUR 40–60 million per year.

    **Cost drivers:**

    1. **Planned maintenance (40% of total):** One annual major service per turbine.
       CTV + 10 technicians, 2-day campaign. Fully weather-window scheduled.

    2. **Unplanned faults (35% of total):** ~6 faults/turbine/year average.
       Emergency call-out premium + parts uncertainty.
       Most expensive faults: power converter (€50k), main bearing (€300k+).

    3. **Vessel charter (15% of total):** SOV seasonal contract (April–October).
       Enables back-to-back campaigns without per-trip mobilisation.

    4. **Heavy lift (5% of total):** Jack-up for blade sections or main bearings.
       Baltic Sea jack-up day rate ~€150k/day + specialised crane crew.

    5. **Insurance (5% of total):** ~0.5% of CAPEX per year.

    **How to reduce O&M cost:**
    - CMS (M12): convert unplanned → planned saves 2–4× per event
    - Reliability-centred maintenance: focus resources on high-failure components
    - SOV instead of per-trip CTV: reduces per-access mobilisation premium
    """
    request = OAMCostRequest(
        n_turbines=n_turbines,
        turbine_rated_mw=turbine_rated_mw,
        planned_events_per_turbine=planned_events_per_turbine,
        unplanned_events_per_turbine=unplanned_events_per_turbine,
        heavy_lift_events_per_year=heavy_lift_events_per_year,
    )
    result = svc.get_oam_cost_breakdown(
        request.n_turbines,
        request.turbine_rated_mw,
        request.planned_events_per_turbine,
        request.unplanned_events_per_turbine,
        request.heavy_lift_events_per_year,
    )
    return OAMCostBreakdown(**result)
