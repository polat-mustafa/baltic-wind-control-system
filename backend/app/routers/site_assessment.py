"""Site assessment API — /api/v1/site.

  GET  /regions       available case-study regions
  GET  /layers        region layers (GeoJSON), what is missing, criteria model card
  GET  /raster        one raster layer (bathymetry, wind) clipped to a bounding box
  POST /suitability   gridded multi-criteria screening: excluded / poor / marginal / suitable
  POST /assess        report for a candidate site polygon (area, capacity, checklist)

Screening only: results are as complete as the region's layer pack, and the
responses say which layers are missing and what that means.
"""

from __future__ import annotations

import math
from dataclasses import asdict

import numpy as np
from fastapi import APIRouter, Query
from fastapi.concurrency import run_in_threadpool

from app.core.exceptions import NotFoundError, ValidationError
from app.schemas.site_assessment import (
    DEFAULT_REGION,
    AssessRequest,
    AssessResponse,
    CheckSchema,
    ClassArea,
    CriterionCard,
    DepthBandCard,
    LayerFeature,
    LayerInfo,
    LayersResponse,
    MissingLayer,
    PortSchema,
    RasterResponse,
    ReasonArea,
    RegionInfo,
    SeabedClassCard,
    SuitabilityRequest,
    SuitabilityResponse,
    WindClimateSchema,
)
from app.services.site_assessment.assess import InvalidSiteError, assess_site
from app.services.site_assessment.criteria import (
    CRITERIA_INFO,
    DEPTH_BANDS,
    SEABED_CLASSES,
    Criteria,
)
from app.services.site_assessment.layers import Layer, RegionPack, available_regions, load_region
from app.services.site_assessment.suitability import (
    CLASS_NAMES,
    REASON_LABEL,
    REASONS,
    is_complete,
    missing_layers,
    screen,
)

router = APIRouter(prefix="/api/v1/site", tags=["Site Assessment"])

_GEOMETRY_TYPE = {"polygon": "Polygon", "line": "LineString", "point": "Point"}


def _pack(region: str) -> RegionPack:
    try:
        return load_region(region)
    except KeyError as exc:
        raise NotFoundError(
            f"Unknown region {region!r}; available: {', '.join(available_regions())}"
        ) from exc


def _criteria(overrides: dict[str, object]) -> Criteria:
    crit = Criteria().with_overrides(overrides)
    if crit.shore_max_km <= crit.shore_ideal_km or crit.grid_max_km <= crit.grid_ideal_km:
        raise ValidationError("Each 'max' distance must exceed its 'ideal' distance")
    if crit.marginal_score > crit.suitable_score:
        raise ValidationError("marginal_score must not exceed suitable_score")
    if crit.min_depth_m >= crit.max_depth_m:
        raise ValidationError("min_depth_m must be below max_depth_m")
    if crit.weight_depth + crit.weight_shore + crit.weight_grid <= 0:
        raise ValidationError("At least one criterion weight must be positive")
    return crit


def _region_info(pack: RegionPack) -> RegionInfo:
    return RegionInfo(
        region=pack.region, title=pack.title, description=pack.description, bbox=list(pack.bbox)
    )


def _missing(pack: RegionPack) -> list[MissingLayer]:
    return [
        MissingLayer(
            role=m["role"],
            effect=m["effect"],
            source=m["source"],
            essential=m["essential"] == "yes",
        )
        for m in missing_layers(pack)
    ]


def _layer(layer: Layer) -> LayerInfo:
    gtype = _GEOMETRY_TYPE.get(layer.geometry)
    features = (
        [
            LayerFeature(
                name=f.name,
                geometry={"type": gtype, "coordinates": f.coordinates},
                properties=f.props,
            )
            for f in layer.features
        ]
        if gtype
        else []
    )
    return LayerInfo(
        id=layer.id,
        title=layer.title,
        role=layer.role,
        geometry=layer.geometry,
        source=layer.source,
        license=layer.license,
        retrieved=layer.retrieved,
        features=features,
    )


@router.get("/regions", response_model=list[RegionInfo])
async def get_regions() -> list[RegionInfo]:
    """Case-study regions with a layer pack."""
    return [_region_info(load_region(r)) for r in available_regions()]


@router.get("/layers", response_model=LayersResponse)
async def get_layers(region: str = DEFAULT_REGION) -> LayersResponse:
    """Region layers with provenance, missing layers and the criteria model card."""
    pack = _pack(region)
    defaults = Criteria().as_dict()
    return LayersResponse(
        region=_region_info(pack),
        layers=[_layer(layer) for layer in pack.layers],
        missing=_missing(pack),
        complete=is_complete(pack),
        criteria=[
            CriterionCard(
                key=c.key,
                label=c.label,
                unit=c.unit,
                kind=c.kind,
                default=defaults[c.key],
                provenance=c.provenance,
                note=c.note,
            )
            for c in CRITERIA_INFO
        ],
        depth_bands=[DepthBandCard(**asdict(b)) for b in DEPTH_BANDS],
        seabed_classes=[SeabedClassCard(**asdict(c)) for c in SEABED_CLASSES],
    )


_MAX_RASTER_CELLS = 40_000


@router.get("/raster", response_model=RasterResponse)
async def get_raster(
    role: str,
    bbox: str = Query(description="lon_min,lat_min,lon_max,lat_max"),
    region: str = DEFAULT_REGION,
) -> RasterResponse:
    """A raster layer (e.g. bathymetry for per-turbine depth) clipped to ``bbox`` plus one cell."""
    try:
        w, s, e, n = (float(v) for v in bbox.split(","))
    except ValueError as exc:
        raise ValidationError("bbox must be lon_min,lat_min,lon_max,lat_max") from exc
    if not all(math.isfinite(v) for v in (w, s, e, n)) or w >= e or s >= n:
        raise ValidationError("bbox must be lon_min,lat_min,lon_max,lat_max with min < max")
    layer = next((ly for ly in _pack(region).by_role(role) if ly.raster is not None), None)
    if layer is None or layer.raster is None:
        raise NotFoundError(f"Region {region!r} has no {role!r} raster")
    r = layer.raster
    bands: dict[str, list[list[float | None]]] = r.get("bands") or {"values": r["values"]}
    first = next(iter(bands.values()))
    ny, nx = len(first), len(first[0])
    i0 = max(0, math.floor((w - r["lon0"]) / r["dlon"]))
    i1 = min(nx - 1, math.ceil((e - r["lon0"]) / r["dlon"]))
    j0 = max(0, math.floor((s - r["lat0"]) / r["dlat"]))
    j1 = min(ny - 1, math.ceil((n - r["lat0"]) / r["dlat"]))
    if i1 < i0 or j1 < j0:
        raise ValidationError("bbox does not overlap the raster")
    if (i1 - i0 + 1) * (j1 - j0 + 1) > _MAX_RASTER_CELLS:
        raise ValidationError("bbox too large: ask for a smaller area")
    return RasterResponse(
        role=role,
        lon0=round(r["lon0"] + i0 * r["dlon"], 6),
        lat0=round(r["lat0"] + j0 * r["dlat"], 6),
        dlon=r["dlon"],
        dlat=r["dlat"],
        bands={k: [row[i0 : i1 + 1] for row in v[j0 : j1 + 1]] for k, v in bands.items()},
        classes=r.get("classes"),
        source=layer.source,
        license=layer.license,
        retrieved=layer.retrieved,
    )


def _rounded(a: np.ndarray, digits: int = 3) -> list[list[float | None]]:
    return [[None if not math.isfinite(v) else round(float(v), digits) for v in row] for row in a]


@router.post("/suitability", response_model=SuitabilityResponse)
async def post_suitability(req: SuitabilityRequest) -> SuitabilityResponse:
    """Screen the whole region on a grid of ≈ cell_km × cell_km cells."""
    pack = _pack(req.region)
    crit = _criteria(req.criteria.as_overrides())
    try:
        grid = await run_in_threadpool(screen, pack, crit, req.cell_km)
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc
    ev = grid.evaluation
    cell_area = grid.cell_area_km2
    scores = np.where(ev.any_excluded, np.nan, ev.score)
    return SuitabilityResponse(
        region=pack.region,
        lon0=grid.lon0,
        lat0=grid.lat0,
        dlon=grid.dlon,
        dlat=grid.dlat,
        nx=grid.nx,
        ny=grid.ny,
        cell_km=grid.cell_km,
        classes=ev.cls.astype(int).tolist(),
        scores=_rounded(scores),
        reasons=ev.reason.astype(int).tolist(),
        reason_keys=list(REASONS),
        class_areas=[
            ClassArea(
                name=name,
                cells=int((ev.cls == code).sum()),
                area_km2=round(float((ev.cls == code).sum()) * cell_area, 1),
            )
            for code, name in CLASS_NAMES.items()
        ],
        reason_areas=[
            ReasonArea(
                reason=r,
                label=REASON_LABEL[r],
                cells=int((ev.reason == i).sum()),
                area_km2=round(float((ev.reason == i).sum()) * cell_area, 1),
            )
            for i, r in enumerate(REASONS)
            if (ev.reason == i).any()
        ],
        missing=_missing(pack),
        complete=is_complete(pack),
    )


@router.post("/assess", response_model=AssessResponse)
async def post_assess(req: AssessRequest) -> AssessResponse:
    """Report for one candidate site: area, capacity, exclusions, distances, checklist."""
    pack = _pack(req.region)
    crit = _criteria(req.criteria.as_overrides())
    for corner in req.polygon:
        if len(corner) < 2 or not all(math.isfinite(v) for v in corner[:2]):
            raise ValidationError("Every corner must be [lon, lat]")
    try:
        a = await run_in_threadpool(assess_site, pack, crit, req.polygon)
    except InvalidSiteError as exc:
        raise ValidationError(str(exc)) from exc
    return AssessResponse(
        region=pack.region,
        area_km2=round(a.area_km2, 2),
        centroid=[round(a.centroid[0], 5), round(a.centroid[1], 5)],
        capacity_mw=round(a.capacity_mw, 1),
        samples=a.samples,
        excluded_fraction=round(a.excluded_fraction, 4),
        exclusion_shares={k: round(v, 4) for k, v in a.exclusion_shares.items()},
        class_shares={k: round(v, 4) for k, v in a.class_shares.items()},
        mean_score=None if a.mean_score is None else round(a.mean_score, 3),
        shore_km=None if a.shore_km is None else [round(v, 2) for v in a.shore_km],
        grid_km=None if a.grid_km is None else round(a.grid_km, 2),
        grid_node=a.grid_node,
        cable_km=None if a.cable_km is None else round(a.cable_km, 2),
        owf_km=None if a.owf_km is None else round(a.owf_km, 2),
        protected_km=None if a.protected_km is None else round(a.protected_km, 2),
        depth_m=None if a.depth_m is None else [round(v, 1) for v in a.depth_m],
        foundation=a.foundation,
        energy_basins=a.energy_basins,
        projects=a.projects,
        wind=WindClimateSchema(
            mean_ms=round(a.wind.mean_ms, 2),
            weibull_a=round(a.wind.a_ms, 2),
            weibull_k=round(a.wind.k, 3),
            height_m=a.wind.height_m,
            sector_frequencies=(
                None if a.wind.frequencies is None else [round(f, 4) for f in a.wind.frequencies]
            ),
            source=a.wind.source,
            license=a.wind.license,
            approximate=a.wind.approximate,
        ),
        seabed=None if a.seabed is None else {k: round(v, 4) for k, v in a.seabed.items()},
        ports=[
            PortSchema(
                name=p.name,
                use="O&M" if p.use == "O&M" else "installation",
                status=p.status,
                km=None if p.km is None else round(p.km, 1),
                basis=p.basis,
            )
            for p in a.ports
        ],
        checks=[
            CheckSchema(
                id=c.id, title=c.title, status=c.status, detail=c.detail, reference=c.reference
            )
            for c in a.checks
        ],
        complete=a.complete,
    )
