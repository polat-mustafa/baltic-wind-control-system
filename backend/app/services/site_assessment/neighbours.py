"""Approximate layouts of the real wind farms around a site, for cluster wakes.

Real projects within ``RADIUS_KM`` of the site get virtual turbines so PyWake
can estimate the external wake loss (the energy the site loses to its
neighbours' wakes). The layouts are NOT the real ones — the developers have
not published turbine coordinates:

* a project with a mapped outline (OpenStreetMap) fills the outline;
* a project known only as a point (EMODnet) fills a square of area
  P / density centred on the point, density = median of the mapped outlines;
* turbines are the site's turbine model (P / P_rated of them) on a regular
  grid; projects that hold the site's own area (inside the site or its
  energy basins) are left out — they are the site.

Far wakes: aircraft measurements found offshore wind farm wakes 45–70 km long
in stable conditions (Platis et al. 2018), so the radius is 60 km.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from app.services.site_assessment.geo import points_in_polygon, points_in_polygons, polygon_area_km2
from app.services.site_assessment.layers import Feature, RegionPack

RADIUS_KM = 60.0
#: Projects smaller than this are demonstrators (or have no capacity): no cluster wake.
MIN_MW = 50.0
SKIP_STATUS = {"dismantled", "decommissioned", "dismissed"}
NOTE = "Approximate neighbour layout — real turbine coordinates are not published"


@dataclass(frozen=True)
class NeighbourFarm:
    name: str
    status: str
    power_mw: float
    source: str  # "outline" | "point"
    distance_km: float
    turbines: list[list[float]]  # [lon, lat]


@dataclass(frozen=True)
class Neighbours:
    farms: list[NeighbourFarm]
    density_mw_km2: float  # used for point-only projects
    density_basis: str
    radius_km: float
    note: str = NOTE


def _grid_in(ring: NDArray[np.float64], n: int) -> NDArray[np.float64]:
    """≈ n points on a square grid inside a projected ring [km]."""
    area = polygon_area_km2(ring)
    (x0, y0), (x1, y1) = ring.min(axis=0), ring.max(axis=0)
    s = math.sqrt(area / n)
    pts = np.empty((0, 2))
    for _ in range(4):  # rescale the spacing until the count is close
        xs = np.arange(x0 + s / 2, x1, s)
        ys = np.arange(y0 + s / 2, y1, s)
        gx, gy = np.meshgrid(xs, ys)
        cand = np.column_stack([gx.ravel(), gy.ravel()])
        pts = cand[points_in_polygon(cand[:, 0], cand[:, 1], ring)]
        if len(pts) == 0 or abs(len(pts) - n) <= max(1, n // 50):
            break
        s *= math.sqrt(len(pts) / n)
    if len(pts) > n:  # drop the outermost
        c = ring.mean(axis=0)
        pts = pts[np.argsort(np.hypot(*(pts - c).T))[:n]]
    return pts


def _square(centre: NDArray[np.float64], area_km2: float) -> NDArray[np.float64]:
    h = math.sqrt(area_km2) / 2
    cx, cy = centre
    return np.array(
        [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h], [cx - h, cy - h]]
    )


def _mw(f: Feature) -> float:
    v = f.props.get("power_mw")
    return float(v) if isinstance(v, int | float) else 0.0


def neighbour_farms(
    pack: RegionPack, site: list[list[float]], rated_mw: float, radius_km: float = RADIUS_KM
) -> Neighbours:
    proj = pack.projection
    ring = proj.ring([*site, site[0]] if site[0] != site[-1] else site)
    centre = ring[:-1].mean(axis=0)
    # The site's own energy basins: projects there hold the site's area.
    probe = np.vstack([ring, centre])
    own_basins = [
        rings
        for _, rings in pack.named_polygons("msp_energy")
        if points_in_polygons(probe[:, 0], probe[:, 1], [rings]).any()
    ]

    def holds_site(p: NDArray[np.float64]) -> bool:
        x, y = np.array([p[0]]), np.array([p[1]])
        return bool(points_in_polygon(x, y, ring)[0]) or any(
            points_in_polygons(x, y, [b])[0] for b in own_basins
        )

    outlines = [
        (f, rings[0])
        for f, rings in pack.named_polygons("owf")
        if _mw(f) >= MIN_MW and str(f.props.get("status", "")).lower() not in SKIP_STATUS
    ]
    densities = [_mw(f) / polygon_area_km2(r) for f, r in outlines if polygon_area_km2(r) > 1]
    density = float(np.median(densities)) if densities else 4.5
    basis = (
        f"median of {len(densities)} mapped outlines (OpenStreetMap)"
        if densities
        else "screening default (illustrative)"
    )

    farms: list[NeighbourFarm] = []

    def add(name: str, status: str, mw: float, source: str, area_ring: NDArray[np.float64]) -> None:
        c = area_ring[:-1].mean(axis=0)
        d = float(np.hypot(*(c - centre)))
        if d > radius_km or holds_site(c):
            return
        n = max(1, round(mw / rated_mw))
        pts = _grid_in(area_ring, n)
        if len(pts) == 0:
            return
        lon, lat = proj.inverse(pts[:, 0], pts[:, 1])
        farms.append(
            NeighbourFarm(
                name,
                status,
                mw,
                source,
                round(d, 1),
                [[round(float(a), 5), round(float(b), 5)] for a, b in zip(lon, lat, strict=True)],
            )
        )

    for f, r in outlines:
        add(f.name, str(f.props.get("status", "")), _mw(f), "outline", r)

    # Points: drop those inside a mapped outline, merge those at the same location.
    merged: dict[tuple[float, float], tuple[list[str], str, float]] = {}
    for f in pack.point_features("owf"):
        status = str(f.props.get("status", ""))
        if _mw(f) <= 0 or status.lower() in SKIP_STATUS:
            continue
        xy = np.array(proj.forward(np.array(f.coordinates[0]), np.array(f.coordinates[1])), float)
        if any(points_in_polygon(xy[:1], xy[1:], r)[0] for _, r in outlines):
            continue
        key = (round(float(f.coordinates[0]), 3), round(float(f.coordinates[1]), 3))
        names, st, mw = merged.get(key, ([], status, 0.0))
        merged[key] = ([*names, f.name], st, mw + _mw(f))
    for (lon, lat), (names, status, mw) in merged.items():
        if mw < MIN_MW:
            continue
        xy = np.array(proj.forward(np.array(lon), np.array(lat)), float)
        add(" + ".join(names), status, mw, "point", _square(xy, mw / density))

    farms.sort(key=lambda f: f.distance_km)
    return Neighbours(farms, density, basis, radius_km)
