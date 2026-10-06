"""Pydantic schemas for site assessment (/api/v1/site).

Coordinates are WGS84 [lon, lat] (GeoJSON order). Distances in km, depths
in m (positive down), areas in km², capacity in MW, scores 0…1.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

ClassName = Literal["excluded", "poor", "marginal", "suitable", "unscored"]
CheckStatus = Literal["pass", "warn", "fail", "unknown", "info"]

DEFAULT_REGION = "southern-baltic"


class CriteriaOverrides(BaseModel):
    """Any subset of the screening criteria; omitted fields keep their defaults."""

    exclude_territorial_sea: bool | None = None
    require_energy_basin: bool | None = None
    territorial_sea_km: float | None = Field(None, ge=0, le=50)
    cable_buffer_km: float | None = Field(None, ge=0, le=20)
    owf_buffer_km: float | None = Field(None, ge=0, le=50)
    exclude_protected: bool | None = None
    exclude_restricted: bool | None = None
    min_depth_m: float | None = Field(None, ge=0, le=200)
    max_depth_m: float | None = Field(None, ge=10, le=3000)
    shore_ideal_km: float | None = Field(None, ge=0, le=300)
    shore_max_km: float | None = Field(None, gt=0, le=500)
    grid_ideal_km: float | None = Field(None, ge=0, le=300)
    grid_max_km: float | None = Field(None, gt=0, le=600)
    weight_depth: float | None = Field(None, ge=0, le=10)
    weight_shore: float | None = Field(None, ge=0, le=10)
    weight_grid: float | None = Field(None, ge=0, le=10)
    suitable_score: float | None = Field(None, ge=0, le=1)
    marginal_score: float | None = Field(None, ge=0, le=1)
    protected_screening_km: float | None = Field(None, ge=0, le=100)
    power_density_mw_km2: float | None = Field(None, gt=0, le=20)

    def as_overrides(self) -> dict[str, Any]:
        return self.model_dump(exclude_none=True)


class SuitabilityRequest(BaseModel):
    region: str = DEFAULT_REGION
    cell_km: float = Field(2.0, ge=0.5, le=10.0, description="Grid cell size [km]")
    criteria: CriteriaOverrides = Field(default_factory=CriteriaOverrides)


class AssessRequest(BaseModel):
    region: str = DEFAULT_REGION
    polygon: list[list[float]] = Field(
        ...,
        min_length=3,
        max_length=200,
        description="Site outline [[lon, lat], …] (closed or open)",
    )
    criteria: CriteriaOverrides = Field(default_factory=CriteriaOverrides)


# ── Responses ─────────────────────────────────────────────────────


class RegionInfo(BaseModel):
    region: str
    title: str
    description: str
    bbox: list[float] = Field(description="[lon_min, lat_min, lon_max, lat_max]")


class LayerFeature(BaseModel):
    name: str
    geometry: dict[str, Any] = Field(description="GeoJSON geometry")
    properties: dict[str, Any] = Field(default_factory=dict)


class LayerInfo(BaseModel):
    id: str
    title: str
    role: str
    geometry: str
    source: str
    license: str
    retrieved: str
    features: list[LayerFeature]


class MissingLayer(BaseModel):
    role: str
    effect: str
    source: str
    essential: bool


class CriterionCard(BaseModel):
    key: str
    label: str
    unit: str
    kind: str
    default: float | bool
    provenance: str
    note: str


class DepthBandCard(BaseModel):
    min_m: float
    max_m: float
    score: float
    foundation: str


class LayersResponse(BaseModel):
    region: RegionInfo
    layers: list[LayerInfo]
    missing: list[MissingLayer]
    complete: bool
    criteria: list[CriterionCard]
    depth_bands: list[DepthBandCard]


class ClassArea(BaseModel):
    name: ClassName
    cells: int
    area_km2: float


class ReasonArea(BaseModel):
    reason: str
    label: str
    cells: int
    area_km2: float


class SuitabilityResponse(BaseModel):
    region: str
    lon0: float = Field(description="Centre longitude of cell (0, 0)")
    lat0: float = Field(description="Centre latitude of cell (0, 0)")
    dlon: float
    dlat: float
    nx: int
    ny: int
    cell_km: float
    classes: list[list[int]] = Field(
        description="[row j][col i]: 0 excluded, 1 poor, 2 marginal, 3 suitable, -1 unscored"
    )
    scores: list[list[float | None]] = Field(
        description="Combined score 0…1 (null when excluded or unscored)"
    )
    reasons: list[list[int]] = Field(
        description="Index into `reason_keys` of the first exclusion, -1 when none"
    )
    reason_keys: list[str]
    class_areas: list[ClassArea]
    reason_areas: list[ReasonArea]
    missing: list[MissingLayer]
    complete: bool


class CheckSchema(BaseModel):
    id: str
    title: str
    status: CheckStatus
    detail: str
    reference: str


class WindClimateSchema(BaseModel):
    """Hub-height wind climate of the site (NEWA + ERA5, or the labelled approximation)."""

    mean_ms: float = Field(description="Mean wind speed [m/s]")
    weibull_a: float = Field(description="Weibull scale A [m/s]")
    weibull_k: float = Field(description="Weibull shape k [-]")
    height_m: float
    sector_frequencies: list[float] | None = Field(
        None, description="12 sectors, wind FROM, centres 0°, 30° … 330°; sums to 1"
    )
    source: str
    license: str
    approximate: bool = Field(description="True: real data not found, closest approximation")


class AssessResponse(BaseModel):
    region: str
    area_km2: float
    centroid: list[float] = Field(description="[lon, lat]")
    capacity_mw: float
    samples: int
    excluded_fraction: float
    exclusion_shares: dict[str, float]
    class_shares: dict[str, float]
    mean_score: float | None
    shore_km: list[float] | None = Field(None, description="[min, max] over the site")
    grid_km: float | None
    grid_node: str | None
    cable_km: float | None
    owf_km: float | None
    protected_km: float | None
    depth_m: list[float] | None = Field(None, description="[min, max] over the site")
    foundation: str | None
    energy_basins: list[str] = Field(
        default_factory=list, description="Plan basins with an energy function the site lies in"
    )
    projects: list[str] = Field(
        default_factory=list,
        description="Real wind farm projects inside the site or holding its energy basins",
    )
    wind: WindClimateSchema | None = None
    checks: list[CheckSchema]
    complete: bool
