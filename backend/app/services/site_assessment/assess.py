"""Assess a candidate site polygon drawn by the user.

The polygon is sampled on a fine grid (≈ 0.25–1 km spacing, at most a few
thousand points); every sample goes through the same screening as the
suitability map. The report gives area, indicative capacity, the share of
the area hit by each exclusion, distances to the things that matter, and a
checklist that says pass / warn / fail / unknown — "unknown" whenever the
layer needed for the check is not loaded, never a silent pass.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from itertools import pairwise
from typing import Literal

import numpy as np

from app.services.site_assessment.criteria import Criteria, depth_band
from app.services.site_assessment.geo import (
    is_simple,
    points_in_polygon,
    points_in_polygons,
    polygon_area_km2,
)
from app.services.site_assessment.layers import RegionPack
from app.services.site_assessment.suitability import (
    CLASS_MARGINAL,
    CLASS_POOR,
    CLASS_SUITABLE,
    REASONS,
    Evaluation,
    evaluate,
    is_complete,
)
from app.services.site_assessment.wind_climate import WindClimate, site_wind

MIN_AREA_KM2 = 1.0
MAX_AREA_KM2 = 2000.0
TARGET_SAMPLES = 2500


class InvalidSiteError(ValueError):
    """The polygon cannot be assessed (too few corners, self-crossing, size, outside region)."""


CheckStatus = Literal["pass", "warn", "fail", "unknown", "info"]


@dataclass(frozen=True)
class Check:
    id: str
    title: str
    status: CheckStatus
    detail: str
    reference: str = ""


@dataclass(frozen=True)
class Assessment:
    area_km2: float
    centroid: tuple[float, float]  # lon, lat
    capacity_mw: float
    samples: int
    excluded_fraction: float
    exclusion_shares: dict[str, float]  # reason → fraction of area
    class_shares: dict[str, float]  # suitable / marginal / poor → fraction of area
    mean_score: float | None
    shore_km: tuple[float, float] | None  # min, max over the site
    grid_km: float | None  # centroid to nearest grid node
    grid_node: str | None
    cable_km: float | None
    owf_km: float | None
    protected_km: float | None
    depth_m: tuple[float, float] | None
    foundation: str | None
    energy_basins: list[str]  # plan basins with an energy function the site lies in
    projects: list[str]  # real wind farm projects inside the site or its energy basins
    wind: WindClimate  # hub-height wind climate over the site
    checks: list[Check]
    complete: bool


def _ring(coords: list[list[float]]) -> list[list[float]]:
    if len(coords) < 3:
        raise InvalidSiteError("a site needs at least three corners")
    ring = [list(map(float, c[:2])) for c in coords]
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    if len(ring) < 4:
        raise InvalidSiteError("a site needs at least three distinct corners")
    return ring


def _densify(ring: np.ndarray, step: float) -> tuple[np.ndarray, np.ndarray]:
    """Points every ≤ step km along a closed ring (vertices included)."""
    xs: list[np.ndarray] = []
    ys: list[np.ndarray] = []
    for (x0, y0), (x1, y1) in pairwise(ring):
        n = max(1, math.ceil(math.hypot(x1 - x0, y1 - y0) / step))
        t = np.arange(n) / n
        xs.append(x0 + t * (x1 - x0))
        ys.append(y0 + t * (y1 - y0))
    return np.concatenate(xs), np.concatenate(ys)


def _finite(a: np.ndarray) -> np.ndarray:
    return np.asarray(a[np.isfinite(a)], dtype=float)


def assess_site(pack: RegionPack, crit: Criteria, coords: list[list[float]]) -> Assessment:
    ring_ll = _ring(coords)
    lon_min, lat_min, lon_max, lat_max = pack.bbox
    for lon, lat in ring_ll:
        if not (lon_min <= lon <= lon_max and lat_min <= lat <= lat_max):
            raise InvalidSiteError("the site must lie inside the region")
    proj = pack.projection
    ring = proj.ring(ring_ll)
    if not is_simple(ring):
        raise InvalidSiteError("the site outline crosses itself")
    area = polygon_area_km2(ring)
    if area < MIN_AREA_KM2:
        raise InvalidSiteError(f"the site is smaller than {MIN_AREA_KM2:g} km²")
    if area > MAX_AREA_KM2:
        raise InvalidSiteError(f"the site is larger than {MAX_AREA_KM2:g} km²")

    # Sample the interior on a square lattice sized for ≈ TARGET_SAMPLES points.
    step = max(0.25, min(1.0, math.sqrt(area / TARGET_SAMPLES)))
    xs = np.arange(ring[:, 0].min() + step / 2, ring[:, 0].max(), step)
    ys = np.arange(ring[:, 1].min() + step / 2, ring[:, 1].max(), step)
    gx, gy = np.meshgrid(xs, ys)
    inside = points_in_polygon(gx.ravel(), gy.ravel(), ring)
    sx, sy = gx.ravel()[inside], gy.ravel()[inside]
    if sx.size == 0:  # very thin polygon: fall back to its vertices
        sx, sy = ring[:-1, 0], ring[:-1, 1]
    slon, slat = proj.inverse(sx, sy)
    ev = evaluate(pack, crit, slon, slat)
    # Distances to features are minima over the whole site, so measure them on
    # the outline too (interior samples sit up to step/2 inside the edge).
    bx, by = _densify(ring, step)
    blon, blat = proj.inverse(bx, by)
    edge = evaluate(pack, crit, blon, blat)
    n = sx.size

    shares = {r: float(ev.excluded[r].mean()) for r in REASONS if ev.excluded[r].any()}
    class_shares = {
        "suitable": float((ev.cls == CLASS_SUITABLE).mean()),
        "marginal": float((ev.cls == CLASS_MARGINAL).mean()),
        "poor": float((ev.cls == CLASS_POOR).mean()),
    }
    ok = ~ev.any_excluded & np.isfinite(ev.score)
    mean_score = float(ev.score[ok].mean()) if ok.any() else None

    cx, cy = float(sx.mean()), float(sy.mean())
    clon, clat = proj.inverse(np.array(cx), np.array(cy))
    grid_node: str | None = None
    grid_km: float | None = None
    for name, glon, glat in pack.points("grid"):
        gx_km, gy_km = proj.forward(np.array(glon), np.array(glat))
        d = math.hypot(float(gx_km) - cx, float(gy_km) - cy)
        if grid_km is None or d < grid_km:
            grid_node, grid_km = name, d

    shore = _finite(np.concatenate([ev.shore_km, edge.shore_km]))
    depth = _finite(np.concatenate([ev.depth_m, edge.depth_m]))
    cable = _finite(np.concatenate([ev.cable_km, edge.cable_km]))
    owf = _finite(np.concatenate([ev.owf_km, edge.owf_km]))
    protected = _finite(np.concatenate([ev.protected_km, edge.protected_km]))

    usable_area = area * (1.0 - float(ev.any_excluded.mean()))
    capacity = usable_area * crit.power_density_mw_km2
    band = depth_band(float(np.median(depth))) if depth.size else None

    # Plan basins with an energy function that the site uses, and the real projects that
    # already hold them (EMODnet locations) or overlap the site (mapped outlines).
    basins = [
        (f, rings)
        for f, rings in pack.named_polygons("msp_energy")
        if points_in_polygons(sx, sy, [rings]).any()
    ]
    projects: list[str] = []
    for f, rings in pack.named_polygons("owf"):
        if points_in_polygons(sx, sy, [rings]).any():
            projects.append(_project_label(f.name, f.props))
    for f in pack.point_features("owf"):
        px, py = proj.forward(np.array([f.coordinates[0]]), np.array([f.coordinates[1]]))
        in_site = bool(points_in_polygon(px, py, ring)[0])
        in_basin = any(points_in_polygons(px, py, [rings])[0] for _, rings in basins)
        label = _project_label(f.name, f.props)
        if (in_site or in_basin) and label not in projects:
            projects.append(label)
    basin_names = [str(f.props.get("basin") or f.name) for f, _ in basins]

    checks = _checks(
        pack,
        crit,
        ev,
        shares,
        depth,
        cable,
        owf,
        protected,
        usable_area,
        capacity,
        basin_names,
        projects,
    )

    return Assessment(
        area_km2=area,
        centroid=(float(clon), float(clat)),
        capacity_mw=capacity,
        samples=n,
        excluded_fraction=float(ev.any_excluded.mean()),
        exclusion_shares=shares,
        class_shares=class_shares,
        mean_score=mean_score,
        shore_km=(float(shore.min()), float(shore.max())) if shore.size else None,
        grid_km=grid_km,
        grid_node=grid_node,
        cable_km=float(cable.min()) if cable.size else None,
        owf_km=float(owf.min()) if owf.size else None,
        protected_km=float(protected.min()) if protected.size else None,
        depth_m=(float(depth.min()), float(depth.max())) if depth.size else None,
        foundation=band.foundation if band else None,
        energy_basins=basin_names,
        projects=projects,
        wind=site_wind(pack, slon, slat),
        checks=checks,
        complete=is_complete(pack),
    )


def _pct(f: float) -> str:
    return f"{100 * f:.0f} %"


def _project_label(name: str, props: dict[str, object]) -> str:
    extra = [
        f"{props['power_mw']:g} MW" if isinstance(props.get("power_mw"), int | float) else "",
        str(props.get("status") or ""),
    ]
    extra = [e for e in extra if e]
    return f"{name} ({', '.join(extra)})" if extra else name


MSP_REFERENCE = (
    "Polish maritime spatial plan, Dz.U. 2021 poz. 935; Act on the maritime areas, "
    "Dz.U. 2024 poz. 1125, Art. 23 ust. 1 and Art. 27g ust. 1 pkt 1"
)


def _checks(
    pack: RegionPack,
    crit: Criteria,
    ev: Evaluation,
    shares: dict[str, float],
    depth: np.ndarray,
    cable: np.ndarray,
    owf: np.ndarray,
    protected: np.ndarray,
    usable_area: float,
    capacity: float,
    basins: list[str],
    projects: list[str],
) -> list[Check]:
    checks: list[Check] = []

    land = shares.get("land", 0.0)
    checks.append(
        Check(
            "sea",
            "Site is at sea",
            "fail" if land > 0 else "pass",
            f"{_pct(land)} of the site is on land." if land > 0 else "The whole site is at sea.",
        )
        if pack.has("sea")
        else Check("sea", "Site is at sea", "unknown", "No sea/land layer loaded.")
    )

    if crit.exclude_territorial_sea:
        ts = shares.get("territorial_sea", 0.0)
        approx = "" if pack.has("territorial") else " (approximated as distance from the coastline)"
        if pack.has("territorial") or pack.has("shore"):
            checks.append(
                Check(
                    "territorial_sea",
                    "Outside the territorial sea",
                    "fail" if ts > 0 else "pass",
                    (
                        f"{_pct(ts)} of the site lies within 12 nm of the coast{approx}."
                        if ts > 0
                        else f"The site lies beyond 12 nm{approx}."
                    ),
                    "UNCLOS Art. 3; case study rule: Polish OWFs only in the EEZ",
                )
            )
        else:
            checks.append(
                Check(
                    "territorial_sea",
                    "Outside the territorial sea",
                    "unknown",
                    "No coastline or limit layer.",
                )
            )

    if pack.has("eez"):
        out = shares.get("outside_eez", 0.0)
        checks.append(
            Check(
                "eez",
                "Inside the EEZ",
                "fail" if out > 0 else "pass",
                f"{_pct(out)} of the site lies outside the EEZ." if out > 0 else "Inside the EEZ.",
                "UNCLOS Art. 56–57",
            )
        )
    else:
        checks.append(Check("eez", "Inside the EEZ", "unknown", "EEZ boundary not loaded yet."))

    if not crit.require_energy_basin:
        checks.append(
            Check(
                "msp_energy",
                "Inside an energy basin of the maritime spatial plan",
                "info",
                "Not applied: the energy-basin rule is switched off (generic study).",
                MSP_REFERENCE,
            )
        )
    elif pack.has("msp_energy"):
        out = shares.get("outside_energy_basin", 0.0)
        where = ", ".join(basins)
        checks.append(
            Check(
                "msp_energy",
                "Inside an energy basin of the maritime spatial plan",
                "fail" if out > 0 else "pass",
                (
                    f"{_pct(out)} of the site lies outside the basins where the plan allows "
                    "offshore wind"
                    + (f" (the rest is in {where})." if where else ".")
                    + " A location permit could not be granted there."
                )
                if out > 0
                else f"The whole site lies in energy basin {where}.",
                MSP_REFERENCE,
            )
        )
    else:
        checks.append(
            Check(
                "msp_energy",
                "Inside an energy basin of the maritime spatial plan",
                "unknown",
                "Maritime spatial plan basins not loaded: the location rule is NOT checked.",
                MSP_REFERENCE,
            )
        )

    if pack.has("owf"):
        ov = shares.get("owf_area", 0.0)
        near = float(owf.min()) if owf.size else math.inf
        named = "; ".join(projects)
        status_owf: CheckStatus
        if ov > 0:
            status_owf = "fail"
            detail_owf = f"{_pct(ov)} of the site overlaps an existing wind farm: {named}."
        elif projects:
            status_owf = "warn"
            detail_owf = (
                f"Already allocated to: {named}. Permits for this sea area are held by another "
                "developer — a real project would need their area or a new allocation."
            )
        elif near < 5.0:
            status_owf = "warn"
            detail_owf = (
                f"Nearest existing wind farm: {near:.1f} km — expect wake losses between the farms."
            )
        else:
            status_owf = "pass"
            detail_owf = (
                f"Nearest mapped wind farm outline: {near:.1f} km."
                if math.isfinite(near)
                else "No mapped wind farm nearby."
            )
        checks.append(
            Check(
                "owf",
                "Real wind farm projects",
                status_owf,
                detail_owf,
                "EMODnet Human Activities 'windfarms'; OpenStreetMap outlines",
            )
        )
    else:
        checks.append(
            Check(
                "owf",
                "Real wind farm projects",
                "unknown",
                "No wind farm projects layer.",
            )
        )

    if pack.has("cable"):
        near = float(cable.min()) if cable.size else math.inf
        hit = shares.get("cable_buffer", 0.0)
        checks.append(
            Check(
                "cables",
                "Clear of subsea cables",
                "fail" if hit > 0 else ("warn" if near < 2.0 else "pass"),
                f"{_pct(hit)} of the site is within {crit.cable_buffer_km:g} km of a cable."
                if hit > 0
                else f"Nearest cable: {near:.1f} km"
                + (" — agree proximity and crossing terms with the owner." if near < 2.0 else "."),
            )
        )
    else:
        checks.append(Check("cables", "Clear of subsea cables", "unknown", "No cables layer."))

    if pack.has("protected"):
        inside = shares.get("protected", 0.0)
        status: CheckStatus
        near = float(protected.min()) if protected.size else math.inf
        if inside > 0 or near <= 0:
            status, detail = "fail", f"{_pct(inside)} of the site lies inside a Natura 2000 site."
        elif near <= crit.protected_screening_km:
            status = "warn"
            detail = (
                f"A Natura 2000 site is {near:.1f} km away: screen for an appropriate assessment "
                "of effects on its conservation objectives."
            )
        else:
            status, detail = "pass", f"Nearest Natura 2000 site: {near:.1f} km."
        checks.append(
            Check(
                "natura2000",
                "Natura 2000",
                status,
                detail,
                "Habitats Directive 92/43/EEC, Art. 6(3)",
            )
        )
    else:
        checks.append(
            Check(
                "natura2000",
                "Natura 2000",
                "unknown",
                "Natura 2000 layer not loaded yet: protected areas are NOT checked.",
                "Habitats Directive 92/43/EEC, Art. 6(3)",
            )
        )

    if pack.has("shipping"):
        hit = shares.get("shipping", 0.0)
        checks.append(
            Check(
                "shipping",
                "Clear of shipping routes",
                "fail" if hit > 0 else "pass",
                f"{_pct(hit)} of the site lies on a shipping route."
                if hit > 0
                else "No shipping route crosses the site.",
            )
        )
    else:
        checks.append(
            Check(
                "shipping",
                "Clear of shipping routes",
                "unknown",
                "Shipping layer not loaded yet: navigation is NOT checked.",
            )
        )

    if pack.has("restricted"):
        hit = shares.get("restricted", 0.0)
        checks.append(
            Check(
                "restricted",
                "Military areas and munitions",
                "fail" if hit > 0 else "pass",
                f"{_pct(hit)} of the site lies in a military area or munition dumpsite."
                if hit > 0
                else "No military area or recorded munition dumpsite in the site. Unexploded "
                "ordnance can lie outside recorded sites: plan a UXO survey.",
                "HELCOM munitions data via EMODnet",
            )
        )
    else:
        checks.append(
            Check(
                "restricted",
                "Military areas and munitions",
                "unknown",
                "Restricted-areas layer not loaded.",
            )
        )

    if depth.size:
        lo, hi = float(depth.min()), float(depth.max())
        bad = shares.get("too_shallow", 0.0) + shares.get("too_deep", 0.0)
        checks.append(
            Check(
                "depth",
                "Water depth",
                "fail" if bad > 0 else "pass",
                f"{lo:.0f}–{hi:.0f} m"
                + (
                    f"; {_pct(bad)} outside {crit.min_depth_m:g}–{crit.max_depth_m:g} m."
                    if bad > 0
                    else "."
                ),
            )
        )
    else:
        checks.append(Check("depth", "Water depth", "unknown", "Bathymetry not loaded yet."))

    checks.append(
        Check(
            "eia",
            "Environmental impact assessment",
            "info",
            "Wind farms are an Annex II project: the competent authority screens whether an "
            "EIA is needed; large offshore wind farms in practice go through a full EIA.",
            "EIA Directive 2011/92/EU (amended by 2014/52/EU), Annex II 3(i)",
        )
    )
    checks.append(
        Check(
            "capacity",
            "Indicative capacity",
            "info",
            f"{usable_area:.0f} km² usable × {crit.power_density_mw_km2:g} MW/km² "
            f"≈ {capacity:.0f} MW (installed; spacing and layout decide the real figure).",
        )
    )
    return checks
