"""
Market API — M11.

POST /api/v1/grid/market/day — schedule and settle one trading day:
TGE day-ahead (SDAC), PSE imbalance at the single price CEN, two-sided CfD
and BESS arbitrage. Prices in PLN/MWh.

GET /api/v1/grid/pse/day — the real Polish system on one day (PSE open data):
wind, PV and demand per 15 min with the market price RCE.
"""

from __future__ import annotations

import datetime as dt
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Query

from app.routers.farm_spec import FarmSpecDep
from app.schemas.market import MarketDayRequest, MarketDayResponse
from app.services.p2 import market as svc
from app.services.p2 import pse_live


def _today_pl() -> str:
    return dt.datetime.now(ZoneInfo("Europe/Warsaw")).date().isoformat()


router = APIRouter(tags=["M11 Market Integration"])


@router.post(
    "/market/day",
    response_model=MarketDayResponse,
    summary="One trading day: day-ahead, imbalance, CfD, BESS",
)
async def market_day(body: MarketDayRequest, spec: FarmSpecDep) -> MarketDayResponse:
    """
    The farm offers its forecast at 0 PLN/MWh and curtails in negative-price
    periods (no CfD support there, CEEAG 2022 §122). Deviations from the
    schedule settle at the imbalance price CEN, which moves against the farm
    (assumed CEN = DA − λ·dev). The two-sided CfD pays or claws back
    (strike − DA) per metered MWh. The BESS arbitrages the day-ahead curve
    with perfect foresight — an upper bound.

    Price shapes, wind and forecast error are synthetic, labelled scenarios —
    except ``real_day``: that day's RCE price (PSE, hourly means of the
    quarter-hours) and the model wind at the site that day (Open-Meteo).
    """
    args = body.model_dump(exclude={"date"})
    if body.scenario == "real_day":
        day = body.date or _today_pl()
        prices = pse_live.hourly_prices((await pse_live.pse_day(day))["quarters"])
        wind = await pse_live.site_wind_hub(day)
        args["day"] = {
            "label": f"Real day {day}: RCE price (PSE) and the model wind at the site (Open-Meteo)",
            "price": prices,
            "wind": wind,
        }
    return MarketDayResponse(**svc.simulate_day(**args, n_turbines=spec.num_turbines))


@router.get("/pse/day", summary="The real Polish system on one day (PSE open data)")
async def pse_day(
    date: str | None = Query(None, description="YYYY-MM-DD (Polish time); default today"),
) -> dict[str, Any]:
    """
    Wind, PV and demand of the KSE per 15 min (``his-wlk-cal``, about an hour
    behind real time) and the market price RCE (``rce-pln``, published the day
    before), with the day's wind share and the wind capture price.
    """
    result: dict[str, Any] = await pse_live.pse_day(date or _today_pl())
    return result
