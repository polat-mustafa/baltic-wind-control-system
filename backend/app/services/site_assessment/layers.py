"""Region layer packs: the GIS data a site screening runs on.

A pack is a JSON file in ``data/`` (one per region) holding GeoJSON-style
geometry in WGS84 (lon, lat) plus provenance for every layer. Layers are
identified by ``role``; the engine uses whichever roles a pack provides and
reports the rest as missing, so a pack can grow layer by layer.

Roles
-----
sea         polygon   water area (cells outside it are land)
shore       line      coastline, for shore distance and the territorial-sea approximation
territorial polygon   territorial sea (replaces the coastline approximation)
eez         polygon   the State's EEZ (cells outside it are another jurisdiction)
cable       line      subsea cables and pipelines
owf         polygon   real offshore wind farm projects (outlines), or point (locations)
msp_energy  polygon   maritime spatial plan basins where offshore wind is allowed
grid        point     onshore grid connection points
protected   polygon   protected areas (Natura 2000)
shipping    polygon   shipping routes / high-density traffic areas
restricted  polygon   military areas, munition dumpsites
bathymetry  raster    water depth [m, positive down] on a regular lon/lat grid
wind        raster    wind climate at hub height, bands mean [m/s], k [-], A [m/s]
wind_rose   raster    wind direction frequency, bands f000 … f330 (12 × 30° sectors, wind FROM)

A raster is ``{lon0, lat0, dlon, dlat, values}`` (one band) or ``{…, bands: {name: values}}``.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
from numpy.typing import NDArray

from app.services.site_assessment.geo import LocalProjection

DATA_DIR = Path(__file__).parent / "data"

ROLES = (
    "sea",
    "shore",
    "territorial",
    "eez",
    "cable",
    "owf",
    "msp_energy",
    "grid",
    "protected",
    "shipping",
    "restricted",
    "bathymetry",
    "wind",
    "wind_rose",
)

#: What a screening loses when a role is missing.
MISSING_EFFECT: dict[str, str] = {
    "sea": "Land cannot be told from sea.",
    "shore": "No shore distance score and no territorial-sea approximation.",
    "territorial": "Territorial sea approximated from the coastline.",
    "eez": "Jurisdiction (EEZ) not checked.",
    "cable": "Cable buffers not applied.",
    "owf": "Overlap with real wind farm projects not checked.",
    "msp_energy": "The maritime spatial plan's energy basins are NOT checked — a site outside "
    "them cannot get a Polish location permit.",
    "grid": "No grid-distance score.",
    "protected": "Natura 2000 sites are NOT excluded — areas shown as suitable may be protected.",
    "shipping": "Shipping routes are NOT excluded.",
    "restricted": "Military areas and munition dumpsites are NOT excluded.",
    "bathymetry": "No water-depth score or depth limits.",
    "wind": "No site wind climate: energy uses the regional approximation (A 10.5 m/s, k 2.2).",
    "wind_rose": "No site wind rose: energy uses the regional approximation.",
}


@dataclass(frozen=True)
class Feature:
    name: str
    coordinates: Any
    props: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class Layer:
    id: str
    title: str
    role: str
    geometry: str  # "polygon" | "line" | "point" | "raster"
    source: str
    license: str
    retrieved: str
    features: tuple[Feature, ...]
    raster: dict[str, Any] | None = None


@dataclass(frozen=True)
class Raster:
    """Regular lon/lat grid; ``values[j, i]`` at (lon0 + i·dlon, lat0 + j·dlat), NaN = no data."""

    lon0: float
    lat0: float
    dlon: float
    dlat: float
    values: NDArray[np.float64]

    def sample(self, lon: NDArray[np.float64], lat: NDArray[np.float64]) -> NDArray[np.float64]:
        """Bilinear interpolation; NaN outside the grid or next to a no-data node."""
        ny, nx = self.values.shape
        fx = (np.asarray(lon, dtype=float) - self.lon0) / self.dlon
        fy = (np.asarray(lat, dtype=float) - self.lat0) / self.dlat
        inside = (fx >= 0) & (fy >= 0) & (fx <= nx - 1) & (fy <= ny - 1)
        i0 = np.clip(np.floor(fx).astype(int), 0, max(nx - 2, 0))
        j0 = np.clip(np.floor(fy).astype(int), 0, max(ny - 2, 0))
        i1 = np.minimum(i0 + 1, nx - 1)
        j1 = np.minimum(j0 + 1, ny - 1)
        tx = np.clip(fx - i0, 0.0, 1.0)
        ty = np.clip(fy - j0, 0.0, 1.0)
        v = self.values
        out = (
            v[j0, i0] * (1 - tx) * (1 - ty)
            + v[j0, i1] * tx * (1 - ty)
            + v[j1, i0] * (1 - tx) * ty
            + v[j1, i1] * tx * ty
        )
        return np.where(inside, out, np.nan)


@dataclass(frozen=True)
class RegionPack:
    region: str
    title: str
    description: str
    bbox: tuple[float, float, float, float]  # lon_min, lat_min, lon_max, lat_max
    layers: tuple[Layer, ...]
    pending: tuple[dict[str, str], ...]

    @property
    def projection(self) -> LocalProjection:
        lon_min, lat_min, lon_max, lat_max = self.bbox
        return LocalProjection((lon_min + lon_max) / 2, (lat_min + lat_max) / 2)

    def by_role(self, role: str) -> list[Layer]:
        return [layer for layer in self.layers if layer.role == role]

    def has(self, role: str) -> bool:
        return any(layer.role == role for layer in self.layers)

    def polygons(self, role: str) -> list[list[NDArray[np.float64]]]:
        """Projected polygons ([outer, holes…]) of every layer with this role."""
        proj = self.projection
        return [
            [proj.ring(ring) for ring in f.coordinates]
            for layer in self.by_role(role)
            if layer.geometry == "polygon"
            for f in layer.features
        ]

    def named_polygons(self, role: str) -> list[tuple[Feature, list[NDArray[np.float64]]]]:
        """(feature, projected rings) of every polygon feature with this role."""
        proj = self.projection
        return [
            (f, [proj.ring(ring) for ring in f.coordinates])
            for layer in self.by_role(role)
            if layer.geometry == "polygon"
            for f in layer.features
        ]

    def lines(self, role: str) -> list[NDArray[np.float64]]:
        proj = self.projection
        return [
            proj.ring(f.coordinates)
            for layer in self.by_role(role)
            if layer.geometry == "line"
            for f in layer.features
        ]

    def points(self, role: str) -> list[tuple[str, float, float]]:
        """(name, lon, lat) of every point feature with this role."""
        return [
            (f.name, float(f.coordinates[0]), float(f.coordinates[1]))
            for layer in self.by_role(role)
            if layer.geometry == "point"
            for f in layer.features
        ]

    def point_features(self, role: str) -> list[Feature]:
        return [
            f for layer in self.by_role(role) if layer.geometry == "point" for f in layer.features
        ]

    def has_polygons(self, role: str) -> bool:
        return any(layer.geometry == "polygon" and layer.features for layer in self.by_role(role))

    def raster(self, role: str, band: str | None = None) -> Raster | None:
        """The raster of this role (``band`` picks one band of a multi-band raster)."""
        for layer in self.by_role(role):
            if layer.raster is not None:
                r = layer.raster
                rows = r["bands"][band] if band is not None else r["values"]
                values = np.array(
                    [[np.nan if v is None else float(v) for v in row] for row in rows],
                    dtype=float,
                )
                return Raster(
                    float(r["lon0"]), float(r["lat0"]), float(r["dlon"]), float(r["dlat"]), values
                )
        return None

    def missing_roles(self) -> list[str]:
        return [role for role in ROLES if not self.has(role)]


def parse_pack(raw: dict[str, Any]) -> RegionPack:
    layers = []
    for item in raw["layers"]:
        if item["role"] not in ROLES:
            raise ValueError(f"layer {item['id']}: unknown role {item['role']!r}")
        features = tuple(
            Feature(
                f.get("name", ""),
                f.get("coordinates"),
                {k: v for k, v in f.items() if k not in ("name", "coordinates")},
            )
            for f in item.get("features", [])
        )
        layers.append(
            Layer(
                id=item["id"],
                title=item["title"],
                role=item["role"],
                geometry=item["geometry"],
                source=item["source"],
                license=item["license"],
                retrieved=item["retrieved"],
                features=features,
                raster=item.get("raster"),
            )
        )
    bbox = raw["bbox"]
    return RegionPack(
        region=raw["region"],
        title=raw["title"],
        description=raw.get("description", ""),
        bbox=(float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])),
        layers=tuple(layers),
        pending=tuple(raw.get("pending", [])),
    )


def available_regions() -> list[str]:
    return sorted(p.stem.replace("_", "-") for p in DATA_DIR.glob("*.json"))


@lru_cache(maxsize=8)
def load_region(region: str) -> RegionPack:
    path = DATA_DIR / f"{region.replace('-', '_')}.json"
    if region not in available_regions() or not path.is_file():
        raise KeyError(region)
    return parse_pack(json.loads(path.read_text(encoding="utf-8")))
