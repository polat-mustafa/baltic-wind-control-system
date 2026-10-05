"""Lifecycle API — /api/v1/lifecycle.

  POST /campaign   construction or decommissioning campaign in weather windows
                   (Monte Carlo over synthetic Baltic sea states, P10/P50/P90)

Teaching model: vessel limits, durations and rates are illustrative and are
returned with every result (``assumptions``, ``vessels``).
"""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool

from app.schemas.lifecycle import CampaignRequest, CampaignResponse
from app.services.lifecycle import weather
from app.services.lifecycle.campaign import CampaignInput, run_campaign

router = APIRouter(prefix="/api/v1/lifecycle", tags=["Lifecycle"])

ASSUMPTIONS = [
    "Weather-restricted operations after DNV-ST-N001: each unit needs a window in which Hs "
    "and wind stay below α × the operational limit for its whole planned duration.",
    "Sea states: Rayleigh Hs and Weibull k = 2 wind around the monthly Baltic means of the "
    f"O&M model, {weather.STEP_HOURS}-hourly, persistence ρ = {weather.RHO_6H} per step and "
    f"wind–wave correlation {weather.R_WIND_WAVE} (illustrative, not a hindcast).",
    f"Jack-up crane limit applies at hub height ({weather.HUB_HEIGHT_M:.0f} m); 10 m wind is "
    f"scaled with the power law α = {weather.SHEAR_ALPHA} (IEC 61400-3-1 normal wind profile).",
    "Vessel limits, unit durations, deck capacity, day rates and mobilisation are illustrative "
    "teaching values.",
    "Charter runs from a vessel's first to its last operation, including waiting on weather "
    "and idle time.",
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
        foundation=req.foundation,
        start=req.start_date,
        alpha=req.alpha,
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
