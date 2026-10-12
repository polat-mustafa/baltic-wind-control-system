"""Lifecycle API — /api/v1/lifecycle.

  POST /campaign   construction or decommissioning campaign in weather windows
                   (Monte Carlo over synthetic Baltic sea states, P10/P50/P90)
  GET  /om-simulation  fleet O&M replay: failures, CTV crews in shifts, jack-up campaigns,
                   availability per hindcast year and corrective O&M cost

Teaching model: vessel limits, durations and rates are illustrative and are
returned with every result (``assumptions``, ``vessels``).
"""

from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.concurrency import run_in_threadpool

from app.schemas.lifecycle import (
    CampaignRequest,
    CampaignResponse,
    OMSimulationResponse,
    OMYearRow,
)
from app.services.lifecycle import weather
from app.services.lifecycle.availability_model import FAILURE_CLASSES, availability
from app.services.lifecycle.campaign import CampaignInput, run_campaign
from app.services.lifecycle.om_simulation import simulate_om

router = APIRouter(prefix="/api/v1/lifecycle", tags=["Lifecycle"])

ASSUMPTIONS = [
    "Weather-restricted operations after DNV-ST-N001: each unit needs a window in which Hs "
    "and wind stay below α × the operational limit for its whole planned duration.",
    f"Sea states: a real {weather.STEP_HOURS}-hourly hindcast at the site — "
    f"{weather.HINDCAST_SOURCE}. Each run replays one historical year (1995–2024).",
    f"Jack-up crane limit applies at hub height ({weather.HUB_HEIGHT_M:.0f} m); 10 m wind is "
    f"scaled with the power law α = {weather.SHEAR_ALPHA} (IEC 61400-3-1 normal wind profile).",
    "Port round trips: units × fastening time at the quay + 2 × port distance / transit "
    "speed (NREL ORBIT process times and vessel library); the port distance is the sea route "
    "from the installation port.",
    "Vessel limits, operation durations, deck capacity, day rates and mobilisation are "
    "illustrative teaching values.",
    "The array cable vessel is mobilised just in time behind the foundations; charter covers "
    "the work including waiting on weather, idle time and gaps up to 30 days (a longer gap "
    "costs a new mobilisation).",
]


def _default_strings(n: int, per: int = 6) -> list[int]:
    k = -(-n // per)
    base, extra = divmod(n, k)
    return [base + 1] * extra + [base] * (k - extra)


@router.post(
    "/campaign",
    response_model=CampaignResponse,
    summary="Construction / decommissioning campaign in weather windows",
)
async def campaign(req: CampaignRequest) -> CampaignResponse:
    """
    Simulate the offshore campaign of a wind farm many times over synthetic
    weather and report P10 / P50 / P90 dates, waiting on weather and vessel cost.

    **Install:** OSS → foundations (heavy-lift vessel); export then array cables
    (cable-lay vessel, a section follows its foundation); turbines (jack-up, a
    turbine follows its foundation); export system energisation; string by
    string turbine commissioning.

    **Remove:** reverse order — isolate, turbines, array cables (recover or cut
    and bury), foundations (cut below the seabed or fully remove), OSS, export
    cable, seabed survey and debris clearance.
    """
    c = CampaignInput(
        mode=req.mode,
        n_turbines=req.n_turbines,
        strings=req.strings or _default_strings(req.n_turbines),
        array_km=req.array_km if req.array_km is not None else 1.6 * req.n_turbines,
        export_km=req.export_km,
        port_km=req.port_km,
        foundation=req.foundation,
        start=req.start_date,
        alpha=req.alpha,
        contingency=req.contingency_fraction,
        runs=req.runs,
        seed=req.seed,
        remove_foundations=req.remove_foundations,
        remove_array=req.remove_array,
        remove_export=req.remove_export,
        remove_scour=req.remove_scour,
        limits={lim.vessel: (lim.hs_m, lim.wind_ms) for lim in req.limits},
    )
    result = await run_in_threadpool(run_campaign, c)
    return CampaignResponse(**result, assumptions=ASSUMPTIONS)


@router.get("/om-simulation", response_model=OMSimulationResponse)
async def om_simulation(
    n_ctv: int = Query(2, ge=1, le=6, description="Crew transfer vessels"),
    crews_per_ctv: int = Query(3, ge=1, le=6),
    mode: str = Query("shifts", pattern="^(shifts|continuous)$"),
    seed: int = Query(0, ge=0, le=99),
) -> OMSimulationResponse:
    """SB-510's 34 turbines through every hindcast year with limited vessels and crews."""
    r = await run_in_threadpool(simulate_om, n_ctv, crews_per_ctv, mode, seed)
    return OMSimulationResponse(
        mode=r.mode,
        n_ctv=r.n_ctv,
        crews_per_ctv=r.crews_per_ctv,
        time_based_mean=round(r.time_based_mean, 4),
        energy_based_mean=round(r.energy_based_mean, 4),
        energy_based_p90=round(r.energy_based_p90, 4),
        analytic_time_based=round(availability().time_based, 4),
        mean_downtime_h={
            c.name: d for c, d in zip(FAILURE_CLASSES, r.mean_downtime_h, strict=True)
        },
        cost_eur_per_year=r.cost_eur_per_year,
        cost_eur_per_mw_year=r.cost_eur_per_mw_year,
        years=[
            OMYearRow(
                year=y.year,
                time_based=round(y.time_based, 4),
                energy_based=round(y.energy_based, 4),
                failures=y.failures,
                jackup_days=round(y.jackup_days, 1),
                jackup_mobilisations=y.jackup_mobilisations,
            )
            for y in r.years
        ],
        source=r.source,
    )
