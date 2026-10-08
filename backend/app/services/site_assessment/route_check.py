"""Export cable route check: what a drawn (or automatic) route crosses.

The route runs from the offshore substation (or the site edge) through the
user's waypoints to the onshore end. It is sampled every ``STEP_KM``; each
sample is at sea or on land (region sea polygons), so the first sea → land
change is the landfall. Reported:

* length offshore / onshore / total [km] — the export length of the farm;
* km inside Natura 2000 sites, military areas and munition dumpsites;
* every crossing of a shipping basin boundary and of an existing cable or
  pipeline, with the crossing angle (90° = at right angles).

Crossing rule: as close to 90° as possible, never below 45° — ICPC
Recommendation No. 2 (cable crossings); shipping lanes are crossed at right
angles where possible to shorten the exposure to anchors and the closures
during installation, and the same 45° floor is used for them here (a teaching
proxy, not a rule of the maritime authority).

Without a drawn route the check builds one on the bathymetry grid: military
areas and munition dumpsites are closed, a km inside a Natura 2000 site counts
as ``NATURA_WEIGHT`` km and inside a shipping basin as ``SHIPPING_WEIGHT`` km
(closed areas keep a ``CLOSED_BUFFER_KM`` margin)
(teaching weights, illustrative), and the landfall is the coastal cell outside
the shipping basins (harbour channels) with the least weighted sea path plus
straight land distance to the grid node.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field, replace
from itertools import pairwise

import numpy as np
from numpy.typing import NDArray
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra

from app.services.site_assessment.assess import Check
from app.services.site_assessment.geo import (
    EARTH_RADIUS_KM,
    distance_to_polygons,
    points_in_polygons,
)
from app.services.site_assessment.layers import RegionPack
from app.services.site_assessment.sea_routes import SeaGrid, sea_grid

STEP_KM = 0.1
NATURA_WEIGHT = 10.0
SHIPPING_WEIGHT = 3.0
CLOSED_BUFFER_KM = 1.0
MIN_CROSSING_DEG = 45.0
ICPC = "ICPC Recommendation No. 2 (crossings at 90°, not below 45°)"


class RouteError(ValueError):
    """The route cannot be checked (too short, outside the region, no sea path)."""


@dataclass(frozen=True)
class Crossing:
    name: str
    angle_deg: float  # acute angle between the route and the crossed line, 0–90°
    at: tuple[float, float]  # lon, lat


@dataclass(frozen=True)
class AreaLength:
    name: str
    km: float


@dataclass(frozen=True)
class RouteCheck:
    route: list[list[float]]  # [lon, lat]
    auto: bool
    total_km: float
    offshore_km: float
    onshore_km: float
    landfall: tuple[float, float] | None
    natura: list[AreaLength]
    restricted: list[AreaLength]
    shipping: list[Crossing]
    shipping_km: list[AreaLength]
    cables: list[Crossing]
    checks: list[Check] = field(default_factory=list)


def _angle(d1: NDArray[np.float64], d2: NDArray[np.float64]) -> NDArray[np.float64]:
    """Acute angle [deg] between direction vectors (rows)."""
    cos = np.abs(np.sum(d1 * d2, axis=-1)) / (
        np.linalg.norm(d1, axis=-1) * np.linalg.norm(d2, axis=-1)
    )
    return np.asarray(np.degrees(np.arccos(np.clip(cos, 0.0, 1.0))), dtype=float)


def _crossings(
    route: NDArray[np.float64], lines: list[tuple[str, NDArray[np.float64]]]
) -> list[tuple[str, float, NDArray[np.float64]]]:
    """(name, angle, point) of every intersection of the route with the named polylines."""
    found: list[tuple[str, float, NDArray[np.float64]]] = []
    for name, line in lines:
        if len(line) < 2:
            continue
        c, d = line[:-1], line[1:]
        for a, b in pairwise(route):
            r, s = b - a, d - c
            den = r[0] * s[:, 1] - r[1] * s[:, 0]
            ok = np.abs(den) > 1e-12
            qp = c - a
            t = np.where(ok, (qp[:, 0] * s[:, 1] - qp[:, 1] * s[:, 0]) / np.where(ok, den, 1), -1)
            u = np.where(ok, (qp[:, 0] * r[1] - qp[:, 1] * r[0]) / np.where(ok, den, 1), -1)
            hit = ok & (t >= 0) & (t < 1) & (u >= 0) & (u <= 1)
            for k in np.nonzero(hit)[0]:
                angle = float(_angle(r[None, :], s[k][None, :])[0])
                found.append((name, angle, a + t[k] * r))
    return found


def _lengths_inside(
    xy: NDArray[np.float64],
    step: NDArray[np.float64],
    named: list[tuple[str, list[NDArray[np.float64]]]],
) -> list[AreaLength]:
    out: dict[str, float] = {}
    for name, rings in named:
        inside = points_in_polygons(xy[:, 0], xy[:, 1], [rings])
        km = float(step[inside].sum())
        if km > 0:
            out[name] = out.get(name, 0.0) + km
    return [AreaLength(n, km) for n, km in sorted(out.items(), key=lambda x: -x[1])]


#: Weighted routing graph and landfall cells by the grid and the layers they are built from;
#: the value holds those objects so their ids stay unique.
_WEIGHTED: dict[tuple[int, ...], tuple[tuple[object, ...], csr_matrix, NDArray[np.bool_]]] = {}
_WEIGHT_ROLES = ("restricted", "protected", "shipping")


def _weighted(pack: RegionPack, grid: SeaGrid) -> tuple[csr_matrix, NDArray[np.bool_]]:
    """Graph with the constraint weights, and the cells a cable may land from."""
    sources: tuple[object, ...] = (grid, *(ly for r in _WEIGHT_ROLES for ly in pack.by_role(r)))
    key = tuple(id(o) for o in sources)
    if key not in _WEIGHTED:
        r = grid.raster
        ny, nx = grid.sea.shape
        gx, gy = np.meshgrid(r.lon0 + r.dlon * np.arange(nx), r.lat0 + r.dlat * np.arange(ny))
        x, y = pack.projection.forward(gx.ravel(), gy.ravel())

        def inside(role: str) -> NDArray[np.bool_]:
            polys = pack.polygons(role)
            return points_in_polygons(x, y, polys) if polys else np.zeros(x.size, dtype=bool)

        shipping = inside("shipping")
        # closed areas with a buffer, so paths between cell centres keep clear of the edge
        restricted = pack.polygons("restricted")
        closed = (
            distance_to_polygons(x, y, restricted) < CLOSED_BUFFER_KM
            if restricted
            else np.zeros(x.size, dtype=bool)
        )
        cost = np.where(inside("protected"), NATURA_WEIGHT, 1.0)
        cost = np.where(shipping, np.maximum(cost, SHIPPING_WEIGHT), cost)
        cost[closed] = np.inf
        g = grid.graph.tocoo()
        w = g.data * (cost[g.row] + cost[g.col]) / 2
        ok = np.isfinite(w)
        graph = csr_matrix((w[ok], (g.row[ok], g.col[ok])), shape=grid.graph.shape)
        # open-sea cells next to a cell that is not open sea (land, coastline); outside the
        # raster counts as sea, so the region's border is not a coast
        ny, nx = grid.sea.shape
        pad = np.pad(grid.sea, 1, constant_values=True)
        edge = np.zeros_like(grid.sea)
        for dj in (-1, 0, 1):
            for di in (-1, 0, 1):
                edge |= ~pad[1 + dj : 1 + dj + ny, 1 + di : 1 + di + nx]
        landfall = (grid.sea & edge).ravel() & ~shipping & ~closed
        _WEIGHTED[key] = (sources, graph, landfall)
    _, graph, landfall = _WEIGHTED[key]
    return graph, landfall


def auto_route(
    pack: RegionPack, start: tuple[float, float], end: tuple[float, float]
) -> list[list[float]]:
    """Least-weighted sea path from ``start`` to the best landfall, then straight to ``end``."""
    grid = sea_grid(pack)
    first = None if grid is None else grid.node(*start)
    if grid is None or first is None:
        raise RouteError("no open sea at the start (bathymetry missing?)")
    graph, landfall = _weighted(pack, grid)
    dist, pred = dijkstra(graph, directed=False, indices=first[0], return_predecessors=True)
    r = grid.raster
    ny, nx = grid.sea.shape
    lon = r.lon0 + r.dlon * (np.arange(ny * nx) % nx)
    lat = r.lat0 + r.dlat * (np.arange(ny * nx) // nx)
    kx = EARTH_RADIUS_KM * math.cos(math.radians(end[1])) * math.pi / 180
    land_km = np.hypot((lon - end[0]) * kx, (lat - end[1]) * EARTH_RADIUS_KM * math.pi / 180)
    total = np.where(landfall & np.isfinite(dist), dist + land_km, np.inf)
    # best landfall whose straight land leg to ``end`` stays out of closed areas too
    closed = pack.polygons("restricted")
    ex, ey = pack.projection.forward(np.array(end[0]), np.array(end[1]))
    best = None
    for k in np.argsort(total)[: int(np.isfinite(total).sum())]:
        lx, ly = pack.projection.forward(np.array(lon[k]), np.array(lat[k]))
        t = np.linspace(0.0, 1.0, 50)
        leg_x, leg_y = lx + t * (ex - lx), ly + t * (ey - ly)
        if not closed or not points_in_polygons(leg_x, leg_y, closed).any():
            best = int(k)
            break
    if best is None:
        raise RouteError("no landfall reachable by sea and land outside closed areas")
    cells = [best]
    while cells[-1] != first[0]:
        cells.append(int(pred[cells[-1]]))
    pts = np.column_stack([lon[cells[::-1]], lat[cells[::-1]]])
    if len(pts) > 2:  # keep the turning points
        turn = np.any(np.abs(np.diff(np.diff(pts, axis=0), axis=0)) > 1e-9, axis=1)
        pts = pts[np.concatenate([[True], turn, [True]])]
    path = [[round(float(a), 5), round(float(b), 5)] for a, b in pts]
    return [list(start), *path[1:], list(end)]


def check_route(pack: RegionPack, route: list[list[float]], auto: bool = False) -> RouteCheck:
    if len(route) < 2:
        raise RouteError("a route needs at least two points")
    lon0, lat0, lon1, lat1 = pack.bbox
    if any(not (lon0 <= p[0] <= lon1 and lat0 <= p[1] <= lat1) for p in route):
        raise RouteError(
            "every route point must lie inside the region "
            f"({lon0:g}–{lon1:g} °E, {lat0:g}–{lat1:g} °N)"
        )
    proj = pack.projection
    pts = proj.ring(route)
    seg = np.hypot(*np.diff(pts, axis=0).T)
    if seg.sum() < 1.0:
        raise RouteError("the route is shorter than 1 km")

    # Samples at the middle of STEP_KM pieces (each carries its own length).
    xy_parts: list[NDArray[np.float64]] = []
    step_parts: list[NDArray[np.float64]] = []
    for (a, b), length in zip(pairwise(pts), seg, strict=True):
        n = max(1, math.ceil(length / STEP_KM))
        t = (np.arange(n) + 0.5) / n
        xy_parts.append(a + t[:, None] * (b - a))
        step_parts.append(np.full(n, length / n))
    xy = np.concatenate(xy_parts)
    step = np.concatenate(step_parts)

    sea = (
        points_in_polygons(xy[:, 0], xy[:, 1], pack.polygons("sea"))
        if pack.has("sea")
        else np.ones(len(xy), dtype=bool)
    )
    land_idx = np.nonzero(~sea)[0]
    landfall = None
    if land_idx.size and sea[: land_idx[0]].any():
        lon, lat = proj.inverse(xy[land_idx[0], 0], xy[land_idx[0], 1])
        landfall = (round(float(lon), 5), round(float(lat), 5))
    offshore = float(step[sea].sum())
    onshore = float(step[~sea].sum())

    def named(role: str) -> list[tuple[str, list[NDArray[np.float64]]]]:
        return [(f.name, rings) for f, rings in pack.named_polygons(role)]

    natura = _lengths_inside(xy, step, named("protected"))
    restricted = _lengths_inside(xy, step, named("restricted"))
    shipping_km = _lengths_inside(xy, step, named("shipping"))

    def to_crossing(name: str, angle: float, at: NDArray[np.float64]) -> Crossing:
        lon, lat = proj.inverse(at[0], at[1])
        return Crossing(name, round(angle, 1), (round(float(lon), 5), round(float(lat), 5)))

    boundaries = [(f.name, ring) for f, rings in pack.named_polygons("shipping") for ring in rings]
    shipping = [to_crossing(*c) for c in _crossings(pts, boundaries)]
    cable_lines = [
        (f.name or layer.title, proj.ring(f.coordinates))
        for layer in pack.by_role("cable")
        if layer.geometry == "line"
        for f in layer.features
    ]
    cables = [to_crossing(*c) for c in _crossings(pts, cable_lines)]

    rc = RouteCheck(
        route=[[round(p[0], 5), round(p[1], 5)] for p in route],
        auto=auto,
        total_km=float(seg.sum()),
        offshore_km=offshore,
        onshore_km=onshore,
        landfall=landfall,
        natura=natura,
        restricted=restricted,
        shipping=shipping,
        shipping_km=shipping_km,
        cables=cables,
    )
    return _with_checks(rc)


def _names(items: list[AreaLength]) -> str:
    return "; ".join(f"{a.name} {a.km:.1f} km" for a in items)


def _with_checks(r: RouteCheck) -> RouteCheck:
    checks: list[Check] = []
    if r.landfall is None:
        checks.append(
            Check(
                "landfall",
                "Landfall",
                "fail",
                "The route does not go from the sea to land: end it at the onshore substation.",
                "",
            )
        )
    else:
        checks.append(
            Check(
                "landfall",
                "Landfall",
                "info",
                f"At {r.landfall[1]:.4f} °N {r.landfall[0]:.4f} °E; "
                f"{r.offshore_km:.1f} km subsea + {r.onshore_km:.1f} km on land.",
                "",
            )
        )
    checks.append(
        Check(
            "natura2000",
            "Natura 2000",
            "warn" if r.natura else "pass",
            f"Through {_names(r.natura)}: screen for an appropriate assessment (timing, HDD at "
            "the landfall)."
            if r.natura
            else "The route stays outside every Natura 2000 site.",
            "Habitats Directive 92/43/EEC, Art. 6(3)",
        )
    )
    steep = [c for c in r.shipping if c.angle_deg < MIN_CROSSING_DEG]
    checks.append(
        Check(
            "shipping",
            "Shipping basins",
            "warn" if steep else ("info" if r.shipping else "pass"),
            (
                f"{len(r.shipping)} boundary crossing(s) at "
                + ", ".join(f"{c.angle_deg:.0f}°" for c in r.shipping)
                + f"; {_names(r.shipping_km)} inside."
                + (
                    f" {len(steep)} below {MIN_CROSSING_DEG:.0f}°: cross the lane at right angles."
                    if steep
                    else ""
                )
            )
            if r.shipping
            else "No shipping basin on the route.",
            f"Crossing lanes at right angles shortens the exposure; floor from {ICPC}",
        )
    )
    steep = [c for c in r.cables if c.angle_deg < MIN_CROSSING_DEG]
    checks.append(
        Check(
            "cables",
            "Cable and pipeline crossings",
            "warn" if steep else ("info" if r.cables else "pass"),
            (
                f"{len(r.cables)} crossing(s): "
                + ", ".join(f"{c.name} {c.angle_deg:.0f}°" for c in r.cables)
                + ". Each needs a crossing agreement with the owner."
                + (f" {len(steep)} below {MIN_CROSSING_DEG:.0f}°." if steep else "")
            )
            if r.cables
            else "No existing cable or pipeline crossed.",
            ICPC,
        )
    )
    checks.append(
        Check(
            "restricted",
            "Military areas and munitions",
            "warn" if r.restricted else "pass",
            f"Through {_names(r.restricted)}: UXO survey and the navy's consent."
            if r.restricted
            else "No military area or recorded munition dumpsite on the route.",
            "HELCOM munitions data via EMODnet",
        )
    )
    return replace(r, checks=checks)
