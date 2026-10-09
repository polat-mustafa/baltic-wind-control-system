"""P4 sub-router: day-ahead forecast trained and scored on real Baltic offshore data."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.core.cache import cached
from app.core.exceptions import NotFoundError
from app.schemas.forecast import RealDataSourceSchema, RealForecastResponse, RealModelScoreSchema
from app.services.p4.real_data import N_SPLITS, evaluate_real_dayahead, sites

from ._pipeline import DETERMINISTIC_TTL_S

router = APIRouter()

NWP_SOURCE = (
    "Open-Meteo Previous Runs API — ECMWF IFS 0.25° and DWD ICON, 100 m wind "
    "issued the day before (lead 24–47 h, CC BY 4.0)"
)


# The data files are bundled and the training seeded, so a hit equals a rebuild; bump the
# prefix when a data file or the model changes.
@cached(prefix="real_dayahead_v3", ttl=DETERMINISTIC_TTL_S)
def _real_dayahead_payload(site: str) -> dict[str, Any]:
    st = sites()[site]
    r = evaluate_real_dayahead(site)
    return RealForecastResponse(
        source=RealDataSourceSchema(
            site=st.key,
            title=st.title,
            production=st.production,
            nwp=NWP_SOURCE,
            farms=list(st.farms),
            capacity_mw=round(st.capacity_mw, 1),
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


@router.get("/real-data/sites")
async def real_sites() -> list[dict[str, Any]]:
    """Real production series available: DK2 aggregate + ENTSO-E farms once fetched."""
    return [
        {"key": s.key, "title": s.title, "capacity_mw": s.capacity_mw} for s in sites().values()
    ]


@router.get("/real-data/day-ahead", response_model=RealForecastResponse)
async def real_dayahead(site: str = "dk2") -> RealForecastResponse:
    """XGBoost P10/P50/P90 vs NWP power curve, climatology and 24 h persistence.

    First call per site trains 5 folds on the bundled data (~1 min on a CPU), then Redis
    serves it.
    """
    if site not in sites():
        raise NotFoundError(f"Unknown real-data site {site!r}; see /real-data/sites")
    return RealForecastResponse(**await _real_dayahead_payload(site))
