"""
Market API — M11.

POST /api/v1/grid/market/day — schedule and settle one trading day:
TGE day-ahead (SDAC), PSE imbalance at the single price CEN, two-sided CfD
and BESS arbitrage. Prices in PLN/MWh.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.market import MarketDayRequest, MarketDayResponse
from app.services.p2 import market as svc

router = APIRouter(tags=["M11 Market Integration"])


@router.post(
    "/market/day",
    response_model=MarketDayResponse,
    summary="One trading day: day-ahead, imbalance, CfD, BESS",
)
async def market_day(body: MarketDayRequest) -> MarketDayResponse:
    """
    The farm offers its forecast at 0 PLN/MWh and curtails in negative-price
    periods (no CfD support there, CEEAG 2022 §122). Deviations from the
    schedule settle at the imbalance price CEN, which moves against the farm
    (assumed CEN = DA − λ·dev). The two-sided CfD pays or claws back
    (strike − DA) per metered MWh. The BESS arbitrages the day-ahead curve
    with perfect foresight — an upper bound.

    Price shapes, wind and forecast error are synthetic, labelled scenarios.
    """
    return MarketDayResponse(**svc.simulate_day(**body.model_dump()))
