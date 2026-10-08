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

Without a drawn route the check builds one: the shortest path by sea from
the start to the sea nearest the grid node, then straight over land to it.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field, replace
from itertools import pairwise

import numpy as np
from numpy.typing import NDArray

from app.services.site_assessment.assess import Check
from app.services.site_assessment.geo import points_in_polygons
from app.services.site_assessment.layers import RegionPack
from app.services.site_assessment.sea_routes import sea_grid, sea_path

STEP_KM = 0.1
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


def auto_route(
    pack: RegionPack, start: tuple[float, float], end: tuple[float, float]
) -> list[list[float]]:
    """Shortest sea path from ``start`` to the sea nearest ``end``, then straight to ``end``."""
    grid = sea_grid(pack)
    path = None if grid is None else sea_path(grid, start, end)
    if path is None:
        raise RouteError("no sea path from the start to the grid node (bathymetry missing?)")
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
