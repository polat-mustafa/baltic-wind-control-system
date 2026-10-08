"""Gridded suitability screening (GIS multi-criteria analysis).

For every point: apply the hard exclusions, score the soft criteria 0…1,
combine them by a weighted linear combination (weights renormalised over
the criteria with data) and classify:

    excluded  ·  poor (< marginal_score)  ·  marginal  ·  suitable (≥ suitable_score)

Soft scores are linear ramps: 1 up to the "ideal" distance, 0 from the "max"
distance on. Depth is scored by foundation band (criteria.DEPTH_BANDS).

The result is only as complete as the region pack: missing layers are
reported with their consequence and the screening is flagged incomplete.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal

import numpy as np
from numpy.typing import NDArray

from app.services.site_assessment.criteria import DEPTH_BANDS, Criteria
from app.services.site_assessment.geo import (
    distance_to_lines,
    distance_to_polygons,
    points_in_polygons,
)
from app.services.site_assessment.layers import MISSING_EFFECT, RegionPack

FloatArray = NDArray[np.float64]
BoolArray = NDArray[np.bool_]

#: Exclusion reasons in priority order (the first that applies is reported).
REASONS: tuple[str, ...] = (
    "land",
    "outside_eez",
    "territorial_sea",
    "protected",
    "owf_area",
    "shipping",
    "restricted",
    "outside_energy_basin",
    "cable_buffer",
    "too_shallow",
    "too_deep",
)

REASON_LABEL: dict[str, str] = {
    "land": "Land",
    "outside_eez": "Outside the EEZ",
    "territorial_sea": "Territorial sea (12 nm)",
    "protected": "Natura 2000 site",
    "owf_area": "Existing wind farm",
    "shipping": "Shipping route",
    "restricted": "Military area or munition dumpsite",
    "outside_energy_basin": "Outside the plan's energy basins",
    "cable_buffer": "Too close to a subsea cable",
    "too_shallow": "Water too shallow",
    "too_deep": "Water too deep",
}

CLASS_EXCLUDED = 0
CLASS_POOR = 1
CLASS_MARGINAL = 2
CLASS_SUITABLE = 3
CLASS_UNSCORED = -1

ClassName = Literal["excluded", "poor", "marginal", "suitable", "unscored"]

CLASS_NAMES: dict[int, ClassName] = {
    CLASS_EXCLUDED: "excluded",
    CLASS_POOR: "poor",
    CLASS_MARGINAL: "marginal",
    CLASS_SUITABLE: "suitable",
    CLASS_UNSCORED: "unscored",
}

#: Roles that decide whether a screening can be trusted for a green light.
ESSENTIAL_ROLES = ("sea", "protected", "shipping", "msp_energy", "bathymetry")

MIN_CELL_KM = 0.5
MAX_CELL_KM = 10.0
MAX_CELLS = 40_000


def ramp(d: FloatArray, ideal: float, worst: float) -> FloatArray:
    """1 for d ≤ ideal, 0 for d ≥ worst, linear between (NaN stays NaN)."""
    span = max(worst - ideal, 1e-9)
    return np.asarray(np.clip(1.0 - (d - ideal) / span, 0.0, 1.0), dtype=float)


def depth_score(depth_m: FloatArray) -> FloatArray:
    out = np.full(np.shape(depth_m), np.nan)
    for band in DEPTH_BANDS:
        out = np.where((depth_m >= band.min_m) & (depth_m < band.max_m), band.score, out)
    return out


@dataclass(frozen=True)
class Evaluation:
    """Per-point screening result (all arrays share the input shape)."""

    excluded: dict[str, BoolArray]
    any_excluded: BoolArray
    reason: NDArray[np.int64]  # index into REASONS, -1 when not excluded
    shore_km: FloatArray
    grid_km: FloatArray
    cable_km: FloatArray
    owf_km: FloatArray
    protected_km: FloatArray
    depth_m: FloatArray
    scores: dict[str, FloatArray]
    score: FloatArray
    cls: NDArray[np.int64]


def evaluate(pack: RegionPack, crit: Criteria, lon: FloatArray, lat: FloatArray) -> Evaluation:
    lon = np.asarray(lon, dtype=float)
    lat = np.asarray(lat, dtype=float)
    proj = pack.projection
    x, y = proj.forward(lon, lat)
    nan = np.full(lon.shape, np.nan)
    false = np.zeros(lon.shape, dtype=bool)

    sea = points_in_polygons(x, y, pack.polygons("sea")) if pack.has("sea") else ~false
    shore_km = distance_to_lines(x, y, pack.lines("shore")) if pack.has("shore") else nan
    if pack.has("grid"):
        gx, gy = proj.forward(
            np.array([p[1] for p in pack.points("grid")]),
            np.array([p[2] for p in pack.points("grid")]),
        )
        grid_km = np.min(np.hypot(x[..., None] - gx, y[..., None] - gy), axis=-1)
    else:
        grid_km = nan
    cable_km = (
        distance_to_lines(x, y, pack.lines("cable"))
        if pack.has("cable")
        else np.full(lon.shape, np.inf)
    )
    owf_km = (
        distance_to_polygons(x, y, pack.polygons("owf"))
        if pack.has_polygons("owf")
        else np.full(lon.shape, np.inf)
    )
    protected_km = (
        distance_to_polygons(x, y, pack.polygons("protected"))
        if pack.has("protected")
        else np.full(lon.shape, np.inf)
    )
    raster = pack.raster("bathymetry")
    depth_m = raster.sample(lon, lat) if raster is not None else nan

    excluded: dict[str, BoolArray] = {r: false.copy() for r in REASONS}
    excluded["land"] = ~sea
    if pack.has("eez"):
        excluded["outside_eez"] = ~points_in_polygons(x, y, pack.polygons("eez"))
    if crit.exclude_territorial_sea:
        if pack.has("territorial"):
            excluded["territorial_sea"] = points_in_polygons(x, y, pack.polygons("territorial"))
        elif pack.has("shore"):
            excluded["territorial_sea"] = shore_km < crit.territorial_sea_km
    if crit.exclude_protected and pack.has("protected"):
        excluded["protected"] = protected_km <= 0.0
    excluded["owf_area"] = owf_km <= crit.owf_buffer_km
    if pack.has("shipping"):
        excluded["shipping"] = points_in_polygons(x, y, pack.polygons("shipping"))
    if crit.require_energy_basin and pack.has("msp_energy"):
        excluded["outside_energy_basin"] = ~points_in_polygons(x, y, pack.polygons("msp_energy"))
    if crit.exclude_restricted and pack.has("restricted"):
        excluded["restricted"] = points_in_polygons(x, y, pack.polygons("restricted"))
    excluded["cable_buffer"] = cable_km < crit.cable_buffer_km
    with np.errstate(invalid="ignore"):
        excluded["too_shallow"] = depth_m < crit.min_depth_m
        excluded["too_deep"] = depth_m > crit.max_depth_m

    reason = np.full(lon.shape, -1, dtype=np.int64)
    for i in reversed(range(len(REASONS))):
        reason = np.where(excluded[REASONS[i]], i, reason)
    any_excluded = reason >= 0

    scores = {
        "depth": depth_score(depth_m),
        "shore": ramp(shore_km, crit.shore_ideal_km, crit.shore_max_km),
        "grid": ramp(grid_km, crit.grid_ideal_km, crit.grid_max_km),
    }
    weights = {"depth": crit.weight_depth, "shore": crit.weight_shore, "grid": crit.weight_grid}
    num = np.zeros(lon.shape)
    den = np.zeros(lon.shape)
    for key, s in scores.items():
        has = ~np.isnan(s)
        num += np.where(has, weights[key] * np.nan_to_num(s), 0.0)
        den += np.where(has, weights[key], 0.0)
    with np.errstate(invalid="ignore", divide="ignore"):
        score = np.where(den > 0, num / den, np.nan)

    cls = np.full(lon.shape, CLASS_UNSCORED, dtype=np.int64)
    cls = np.where(score < crit.marginal_score, CLASS_POOR, cls)
    cls = np.where(score >= crit.marginal_score, CLASS_MARGINAL, cls)
    cls = np.where(score >= crit.suitable_score, CLASS_SUITABLE, cls)
    cls = np.where(any_excluded, CLASS_EXCLUDED, cls)

    return Evaluation(
        excluded=excluded,
        any_excluded=any_excluded,
        reason=reason,
        shore_km=shore_km,
        grid_km=grid_km,
        cable_km=cable_km,
        owf_km=owf_km,
        protected_km=protected_km,
        depth_m=depth_m,
        scores=scores,
        score=score,
        cls=cls,
    )


@dataclass(frozen=True)
class GridResult:
    lon0: float  # centre of cell (0, 0)
    lat0: float
    dlon: float
    dlat: float
    nx: int
    ny: int
    cell_km: float
    evaluation: Evaluation  # arrays shaped (ny, nx)

    @property
    def cell_area_km2(self) -> float:
        return self.cell_km * self.cell_km


def screen(pack: RegionPack, crit: Criteria, cell_km: float = 2.0) -> GridResult:
    """Evaluate a regular grid of ≈ cell_km × cell_km cells over the region bbox."""
    if not (MIN_CELL_KM <= cell_km <= MAX_CELL_KM):
        raise ValueError(f"cell_km must be within [{MIN_CELL_KM}, {MAX_CELL_KM}] km")
    proj = pack.projection
    lon_min, lat_min, lon_max, lat_max = pack.bbox
    dlon = cell_km / proj.kx
    dlat = cell_km / proj.ky
    nx = max(1, math.ceil((lon_max - lon_min) / dlon))
    ny = max(1, math.ceil((lat_max - lat_min) / dlat))
    if nx * ny > MAX_CELLS:
        raise ValueError(f"grid of {nx}×{ny} cells exceeds {MAX_CELLS}; use larger cells")
    lon0 = lon_min + dlon / 2
    lat0 = lat_min + dlat / 2
    lons = lon0 + dlon * np.arange(nx)
    lats = lat0 + dlat * np.arange(ny)
    glon, glat = np.meshgrid(lons, lats)
    return GridResult(lon0, lat0, dlon, dlat, nx, ny, cell_km, evaluate(pack, crit, glon, glat))


def missing_layers(pack: RegionPack) -> list[dict[str, str]]:
    titles = {p["id"]: p for p in pack.pending}
    role_to_pending = {
        "protected": "protected",
        "shipping": "shipping",
        "msp_energy": "msp_energy",
        "bathymetry": "bathymetry",
        "eez": "eez",
    }
    out = []
    for role in pack.missing_roles():
        pending = titles.get(role_to_pending.get(role, ""), {})
        out.append(
            {
                "role": role,
                "effect": MISSING_EFFECT[role],
                "source": pending.get("source", ""),
                "essential": "yes" if role in ESSENTIAL_ROLES else "no",
            }
        )
    return out


def is_complete(pack: RegionPack) -> bool:
    return all(pack.has(role) for role in ESSENTIAL_ROLES)
