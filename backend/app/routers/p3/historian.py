"""P3 sub-router: SCADA Historian time-series endpoints.

Provides read access to synthesised SCADA historian data for the
510 MW Baltic Wind Alpha offshore wind farm.

In a production system these endpoints query TimescaleDB hypertables
(raw scan data + continuous aggregates). Here, the service layer
generates deterministic waveforms so the platform runs without a
live historian database.

Architecture — Tiered Storage (IEC 62443 Layer 3 Historian)
-------------------------------------------------------------
  Raw:       Scan rate (4 s per IEC 61400-25) → 90-day retention
  1-min avg: TimescaleDB continuous aggregate → 2-year retention
  1-hr avg:  TimescaleDB continuous aggregate → Lifetime retention

Available time ranges:
  1 hr  — Operations: last hour at 1-min resolution
  4 hr  — Shift handover: last 4 hours at 5-min resolution
  24 hr — Daily: last day at 15-min resolution
  7 d   — Weekly: last 7 days at 1-hr resolution

Endpoints
---------
GET  /api/v1/scada/historian/tags           — List available tags
GET  /api/v1/scada/historian/latest         — Latest value per tag
POST /api/v1/scada/historian/query          — Multi-tag time-series query
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.scada import (
    HistorianLatestResponse,
    HistorianQueryRequest,
    HistorianQueryResponse,
    HistorianTagMetaSchema,
    TagTimeSeriesSchema,
    TimeSeriesPointSchema,
)
from app.services.p3.historian import (
    HistorianTag,
    TimeResolution,
    generate_time_series,
    get_available_tags,
    get_latest_values,
)

router = APIRouter()

# Allowed range_hours values (matching TimescaleDB retention tiers)
_VALID_RANGE_HOURS = {1, 4, 24, 168}


@router.get("/historian/tags", response_model=list[HistorianTagMetaSchema])
async def list_historian_tags() -> list[HistorianTagMetaSchema]:
    """List all available SCADA historian tags.

    Returns engineering metadata (unit, description, nominal value,
    and physical range) for each tag. Use the ``tag`` field as the
    identifier in the query endpoint.
    """
    return [
        HistorianTagMetaSchema(
            tag=meta.tag.value,
            display_name=meta.display_name,
            description=meta.description,
            unit=meta.unit,
            nominal=meta.nominal,
            range_min=meta.range_min,
            range_max=meta.range_max,
        )
        for meta in get_available_tags()
    ]


@router.get("/historian/latest", response_model=HistorianLatestResponse)
async def get_latest_historian_values() -> HistorianLatestResponse:
    """Get the latest synthesised value for every registered historian tag.

    Equivalent to a snapshot query at ``now``. Useful for KPI cards and
    live data feeds that don't need full time-series history.
    """
    return HistorianLatestResponse(values=get_latest_values())


@router.post("/historian/query", response_model=HistorianQueryResponse)
async def query_historian(request: HistorianQueryRequest) -> HistorianQueryResponse:
    """Query time-series data for one or more historian tags.

    Returns a list of time-series, one per requested tag, for the
    specified time window and resolution.

    **Supported range_hours:** 1, 4, 24, 168 (= 7 days)

    **Supported resolutions:** ``1min``, ``5min``, ``15min``, ``1hr``

    **Maximum points per series:** 2,000 (request a coarser resolution
    if your time window × resolution exceeds this limit).

    Raises 422 for invalid tag names or unsupported range/resolution values.
    """
    # Validate range_hours
    if request.range_hours not in _VALID_RANGE_HOURS:
        raise HTTPException(
            status_code=422,
            detail=(
                f"range_hours must be one of {sorted(_VALID_RANGE_HOURS)}. "
                f"Got: {request.range_hours}"
            ),
        )

    # Validate resolution
    try:
        resolution = TimeResolution(request.resolution)
    except ValueError as err:
        valid = [r.value for r in TimeResolution]
        raise HTTPException(
            status_code=422,
            detail=(f"resolution must be one of {valid}. Got: '{request.resolution}'"),
        ) from err

    series_list: list[TagTimeSeriesSchema] = []
    invalid_tags: list[str] = []

    for tag_str in request.tags:
        try:
            tag = HistorianTag(tag_str)
        except ValueError:
            invalid_tags.append(tag_str)
            continue

        ts = generate_time_series(
            tag=tag,
            range_hours=request.range_hours,
            resolution=resolution,
            now_epoch_minutes=request.now_epoch_minutes,
        )

        series_list.append(
            TagTimeSeriesSchema(
                tag=ts.tag,
                display_name=ts.display_name,
                unit=ts.unit,
                description=ts.description,
                nominal=ts.nominal,
                range_min=ts.range_min,
                range_max=ts.range_max,
                resolution=ts.resolution,
                points=[
                    TimeSeriesPointSchema(
                        timestamp_iso=p.timestamp_iso,
                        value=p.value,
                    )
                    for p in ts.points
                ],
            )
        )

    if invalid_tags:
        valid_examples = [t.value for t in list(HistorianTag)[:3]]
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unknown tag(s): {invalid_tags}. "
                f"Use GET /historian/tags to list valid tags. "
                f"Examples: {valid_examples}"
            ),
        )

    return HistorianQueryResponse(
        range_hours=request.range_hours,
        resolution=resolution.value,
        series=series_list,
    )
