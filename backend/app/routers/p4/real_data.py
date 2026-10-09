"""P4 sub-router: day-ahead forecast trained and scored on real Baltic offshore data."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.core.cache import cached
from app.schemas.forecast import RealDataSourceSchema, RealForecastResponse, RealModelScoreSchema
from app.services.p4.real_data import (
    CAPACITY_MW,
    FARMS,
    N_SPLITS,
    evaluate_real_dayahead,
)

from ._pipeline import DETERMINISTIC_TTL_S

router = APIRouter()


# The data file is bundled and the training seeded, so a hit equals a rebuild; bump the
# prefix when the data file or the model changes.
@cached(prefix="real_dayahead_v1", ttl=DETERMINISTIC_TTL_S)
def _real_dayahead_payload() -> dict[str, Any]:
    r = evaluate_real_dayahead()
    return RealForecastResponse(
        source=RealDataSourceSchema(
            production="Energinet Energi Data Service — ProductionConsumptionSettlement, "
            "DK2 OffshoreWindGe100MW_MWh (CC BY 4.0)",
            nwp="Open-Meteo Previous Runs API — ECMWF IFS 0.25° and DWD ICON, 100 m wind "
            "issued the day before (lead 24–47 h, CC BY 4.0)",
            farms=list(FARMS),
            capacity_mw=round(CAPACITY_MW, 1),
            period_start_utc=r.period[0],
            period_end_utc=r.period[1],
            hours=r.hours,
            folds=N_SPLITS,
        ),
        scores=[RealModelScoreSchema(**vars(s)) for s in r.scores],
        p10_p90_coverage_pct=r.p10_p90_coverage_pct,
        feature_importance=[{"feature": k, "gain_share": v} for k, v in r.feature_importance],
        series=r.series,
    ).model_dump()


@router.get("/real-data/day-ahead", response_model=RealForecastResponse)
async def real_dayahead() -> RealForecastResponse:
    """XGBoost P10/P50/P90 vs NWP power curve, climatology and 24 h persistence.

    First call trains 5 folds on the bundled data (~1 min on a CPU), then Redis serves it.
    """
    return RealForecastResponse(**await _real_dayahead_payload())
