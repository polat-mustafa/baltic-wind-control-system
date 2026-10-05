"""Download and package the open marine data layers of a site-assessment region.

    cd backend && python scripts/fetch_marine_layers.py            # writes the pack
    cd backend && python scripts/fetch_marine_layers.py --dry-run  # prints a summary only

Sources (all queried through their OGC web services; licences checked in
the ISO metadata of each dataset when this script was written):

* EMODnet Human Activities WFS (CC BY 4.0): Natura 2000 sites (EEA data),
  offshore wind farm areas, maritime spatial planning zones, military
  areas, dumped munitions.
* EMODnet Bathymetry WCS, latest DTM (DTM 2024 at writing; not for navigation).
* Marine Regions WFS (Flanders Marine Institute, CC BY): EEZ and 12 nm limit.

Polygons are clipped to the region box (plus a margin) and simplified
(Ramer–Douglas–Peucker, ≈ 100 m), bathymetry is block-averaged to a coarse
grid, so the pack stays small enough to commit. The layers that do not come
from these services (coastline, cables, grid nodes, sea mask) are kept from
the existing pack.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np

PACK = (
    Path(__file__).resolve().parents[1] / "app/services/site_assessment/data/southern_baltic.json"
)

EMODNET_HA_WFS = "https://ows.emodnet-humanactivities.eu/wfs"
EMODNET_BATHY_WCS = "https://ows.emodnet-bathymetry.eu/wcs"
MARINE_REGIONS_WFS = "https://geo.vliz.be/geoserver/MarineRegions/wfs"

EMODNET_HA_LICENCE = (
    "CC BY 4.0 — data downloaded from the EMODnet Portal (https://emodnet.ec.europa.eu/en/)"
)
MARINE_REGIONS_LICENCE = (
    "CC BY 4.0 — Flanders Marine Institute (VLIZ), MarineRegions.org; no legal value"
)

MARGIN_DEG = 0.15
SIMPLIFY_DEG = 0.001  # ≈ 110 m north-south, 65 m east-west at 54.8° N
BATHY_STEP_DEG = 0.01


# ── HTTP ─────────────────────────────────────────────────────────


def http_get(url: str, params: dict[str, str] | list[tuple[str, str]], retries: int = 4) -> bytes:
    full = f"{url}?{urllib.parse.urlencode(params, safe=':,()=')}"
    delay = 2.0
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(full, timeout=180) as resp:  # fixed https hosts
                return bytes(resp.read())
        except OSError as exc:
            if attempt == retries:
                raise RuntimeError(f"GET failed: {full}") from exc
            print(f"  retry in {delay:.0f} s ({exc})", file=sys.stderr)
            time.sleep(delay)
            delay *= 2
    raise AssertionError("unreachable")


def wfs_geojson(
    url: str, type_name: str, bbox: tuple[float, float, float, float], **extra: str
) -> dict[str, Any]:
    lon0, lat0, lon1, lat1 = bbox
    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeNames": type_name,
        "outputFormat": "application/json",
        "srsName": "EPSG:4326",
        **extra,
    }
    if "CQL_FILTER" not in extra:
        params["bbox"] = f"{lat0},{lon0},{lat1},{lon1},urn:ogc:def:crs:EPSG::4326"
    data = json.loads(http_get(url, params))
    return data  # type: ignore[no-any-return]


# ── Geometry ─────────────────────────────────────────────────────


def rdp(points: np.ndarray, eps: float) -> np.ndarray:
    """Ramer–Douglas–Peucker simplification of a polyline (iterative)."""
    n = len(points)
    if n < 3:
        return points
    keep = np.zeros(n, dtype=bool)
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        a, b = points[i], points[j]
        seg = b - a
        seg_len = math.hypot(*seg)
        mid = points[i + 1 : j]
        if seg_len == 0:
            d = np.hypot(*(mid - a).T)
        else:
            d = np.abs(seg[0] * (mid[:, 1] - a[1]) - seg[1] * (mid[:, 0] - a[0])) / seg_len
        k = int(np.argmax(d))
        if d[k] > eps:
            keep[i + 1 + k] = True
            stack += [(i, i + 1 + k), (i + 1 + k, j)]
    return points[keep]


def clip_ring(ring: np.ndarray, box: tuple[float, float, float, float]) -> np.ndarray:
    """Sutherland–Hodgman clip of a closed ring to an axis-aligned box."""
    lon0, lat0, lon1, lat1 = box
    pts = (
        [tuple(p) for p in ring[:-1]]
        if np.allclose(ring[0], ring[-1])
        else [tuple(p) for p in ring]
    )
    # (axis, bound, keep values >= bound?) for the left, right, bottom and top edges
    for axis, bound, keep_ge in (
        (0, lon0, True),
        (0, lon1, False),
        (1, lat0, True),
        (1, lat1, False),
    ):
        if not pts:
            break

        def inside(
            p: tuple[float, float], axis: int = axis, bound: float = bound, keep_ge: bool = keep_ge
        ) -> bool:
            return p[axis] >= bound if keep_ge else p[axis] <= bound

        def cross(
            p: tuple[float, float], q: tuple[float, float], axis: int = axis, bound: float = bound
        ) -> tuple[float, float]:
            t = (bound - p[axis]) / (q[axis] - p[axis])
            return (p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1]))

        out: list[tuple[float, float]] = []
        prev = pts[-1]
        for cur in pts:
            if inside(cur):
                if not inside(prev):
                    out.append(cross(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(cross(prev, cur))
            prev = cur
        pts = out
    if len(pts) < 3:
        return np.empty((0, 2))
    arr = np.asarray(pts, dtype=float)
    return np.vstack([arr, arr[:1]])


def ring_area_deg2(ring: np.ndarray) -> float:
    x, y = ring[:, 0], ring[:, 1]
    return float(abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1))) / 2)


def prepare_polygons(
    geometry: dict[str, Any], box: tuple[float, float, float, float]
) -> list[list[list[list[float]]]]:
    """GeoJSON (Multi)Polygon → clipped, simplified list of polygons [[ring], …]."""
    polys = (
        geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
    )
    out = []
    for poly in polys:
        rings = []
        for k, ring in enumerate(poly):
            r = clip_ring(np.asarray(ring, dtype=float)[:, :2], box)
            if len(r) < 4:
                if k == 0:
                    break  # outer ring outside the box: drop the polygon
                continue
            r = rdp(r, SIMPLIFY_DEG)
            if len(r) < 4 or ring_area_deg2(r) < 1e-6:  # < ≈ 0.007 km²
                if k == 0:
                    break
                continue
            rings.append([[round(float(x), 5), round(float(y), 5)] for x, y in r])
        if rings:
            out.append(rings)
    return out


def polygon_features(
    fc: dict[str, Any], box: tuple[float, float, float, float], name_of: Any, props_of: Any
) -> list[dict[str, Any]]:
    features = []
    for f in fc["features"]:
        if not f.get("geometry"):
            continue
        for rings in prepare_polygons(f["geometry"], box):
            features.append(
                {
                    "name": name_of(f["properties"]),
                    "coordinates": rings,
                    **props_of(f["properties"]),
                }
            )
    return features


# ── Layers ───────────────────────────────────────────────────────


def fetch_ha(type_name: str, bbox: tuple[float, float, float, float]) -> dict[str, Any]:
    print(f"  EMODnet Human Activities: {type_name}")
    return wfs_geojson(EMODNET_HA_WFS, f"emodnet:{type_name}", bbox)


def layer(
    id_: str,
    title: str,
    role: str,
    geometry: str,
    source: str,
    licence: str,
    today: str,
    **rest: Any,
) -> dict[str, Any]:
    return {
        "id": id_,
        "title": title,
        "role": role,
        "geometry": geometry,
        "source": source,
        "license": licence,
        "retrieved": today,
        **rest,
    }


def build_layers(bbox: tuple[float, float, float, float], today: str) -> list[dict[str, Any]]:
    lon0, lat0, lon1, lat1 = bbox
    box = (lon0 - MARGIN_DEG, lat0 - MARGIN_DEG, lon1 + MARGIN_DEG, lat1 + MARGIN_DEG)
    layers: list[dict[str, Any]] = []

    n2k = fetch_ha("natura2000areas", box)
    layers.append(
        layer(
            "natura2000",
            "Natura 2000 sites",
            "protected",
            "polygon",
            "EEA Natura 2000 spatial data via EMODnet Human Activities 'natura2000areas'",
            EMODNET_HA_LICENCE,
            today,
            features=polygon_features(
                n2k,
                box,
                lambda p: f"{p['sitename']} ({p['sitecode']})",
                lambda p: {
                    "sitecode": p["sitecode"],
                    "sitetype": p.get("sitedesc"),
                    "release": p.get("release_da"),
                },
            ),
        )
    )

    owf = fetch_ha("windfarmspoly", box)
    layers.append(
        layer(
            "owf_areas",
            "Offshore wind farm areas",
            "owf",
            "polygon",
            "EMODnet Human Activities 'windfarmspoly' (Polish maritime spatial plan basins)",
            EMODNET_HA_LICENCE,
            today,
            features=polygon_features(
                owf,
                box,
                lambda p: p.get("name") or "Wind farm area",
                lambda p: {"status": p.get("status"), "power_mw": p.get("power_mw")},
            ),
        )
    )

    msp = fetch_ha("mspzoningpoly", box)
    traffic = {
        "type": "FeatureCollection",
        "features": [
            f
            for f in msp["features"]
            if f["properties"].get("seausename") == "Maritime Traffic flows"
            and f["properties"].get("seausefct") == "Priority"
        ],
    }
    layers.append(
        layer(
            "shipping",
            "Shipping priority basins (maritime spatial plan)",
            "shipping",
            "polygon",
            "Polish maritime spatial plan (Dz.U. 2021 poz. 935): basins with 'maritime traffic "
            "flows' as priority use, via EMODnet Human Activities 'mspzoningpoly'",
            EMODNET_HA_LICENCE,
            today,
            features=polygon_features(
                traffic,
                box,
                lambda p: f"{p.get('localid')} — shipping priority",
                lambda p: {"plan": p.get("offsource")},
            ),
        )
    )

    military = fetch_ha("militaryareaspoly", box)
    munitions = fetch_ha("munitionspoly", box)
    restricted = polygon_features(
        military,
        box,
        lambda p: f"Military: {p.get('type_1') or 'area'}",
        lambda p: {"kind": "military"},
    ) + polygon_features(
        munitions,
        box,
        lambda p: f"Munitions: {p.get('description') or p.get('munition_type')}",
        lambda p: {"kind": "munitions", "munition_type": p.get("munition_type")},
    )
    layers.append(
        layer(
            "restricted",
            "Military areas and munition dumpsites",
            "restricted",
            "polygon",
            "EMODnet Human Activities 'militaryareaspoly' and 'munitionspoly' (HELCOM dumpsites)",
            EMODNET_HA_LICENCE,
            today,
            features=restricted,
        )
    )

    for type_name, id_, title, role in (
        ("eez", "eez", "Polish EEZ", "eez"),
        ("eez_12nm", "territorial", "Polish territorial sea (12 nm)", "territorial"),
    ):
        print(f"  Marine Regions: {type_name}")
        fc = wfs_geojson(
            MARINE_REGIONS_WFS, f"MarineRegions:{type_name}", box, CQL_FILTER="iso_ter1='POL'"
        )
        layers.append(
            layer(
                id_,
                title,
                role,
                "polygon",
                "Flanders Marine Institute (2026): MarineRegions.org, Maritime Boundaries layer "
                f"'{type_name}' (MRGID {fc['features'][0]['properties']['mrgid']})",
                MARINE_REGIONS_LICENCE,
                today,
                features=polygon_features(
                    fc, box, lambda p: p["geoname"], lambda p: {"mrgid": p["mrgid"]}
                ),
            )
        )

    layers.append(fetch_bathymetry(bbox, today))
    return layers


def parse_wcs_text(text: str) -> tuple[np.ndarray, float, float, float, float]:
    """GeoServer WCS text/plain coverage → (values[row, col], x0, dx, y0, dy).

    The affine maps (col, row) to the pixel centre: x = x0 + col·dx, y = y0 + row·dy
    (dy < 0: rows run north to south).
    """

    def param(name: str) -> float:
        k = text.index(f'PARAMETER["{name}",')
        return float(text[k:].split(",", 1)[1].split("]", 1)[0])

    dx, x0, dy, y0 = param("elt_0_0"), param("elt_0_2"), param("elt_1_1"), param("elt_1_2")
    body = text.split("Band 0:", 1)[1].strip().splitlines()
    rows = [
        [float(v) if v not in ("NaN", "nan") else math.nan for v in line.split()]
        for line in body
        if line.strip()
    ]
    width = max(len(r) for r in rows)
    values = np.full((len(rows), width), math.nan)
    for i, r in enumerate(rows):
        values[i, : len(r)] = r
    return values, x0, dx, y0, dy


def fetch_bathymetry(bbox: tuple[float, float, float, float], today: str) -> dict[str, Any]:
    """Mean depth on the native 1/16′ grid, block-averaged to BATHY_STEP_DEG cells."""
    lon0, lat0, lon1, lat1 = bbox
    print("  EMODnet Bathymetry: emodnet__mean (text/plain)")
    raw = http_get(
        EMODNET_BATHY_WCS,
        [
            ("service", "WCS"),
            ("version", "2.0.1"),
            ("request", "GetCoverage"),
            ("coverageId", "emodnet__mean"),
            ("format", "text/plain"),
            ("subset", f"Long({lon0},{lon1})"),
            ("subset", f"Lat({lat0},{lat1})"),
        ],
    )
    elev, x0, dx, y0, dy = parse_wcs_text(raw.decode("utf-8"))
    nrow, ncol = elev.shape
    lon = x0 + dx * np.arange(ncol)
    lat = y0 + dy * np.arange(nrow)
    with np.errstate(invalid="ignore"):
        depth = np.where(elev < 0, -elev, np.nan)  # positive down; land and no-data → NaN
    nx = math.ceil((lon1 - lon0) / BATHY_STEP_DEG)
    ny = math.ceil((lat1 - lat0) / BATHY_STEP_DEG)
    ci = np.clip(((lon - lon0) / BATHY_STEP_DEG).astype(int), 0, nx - 1)
    rj = np.clip(((lat - lat0) / BATHY_STEP_DEG).astype(int), 0, ny - 1)
    total = np.zeros((ny, nx))
    count = np.zeros((ny, nx))
    cells = np.zeros((ny, nx))
    jj, ii = np.meshgrid(rj, ci, indexing="ij")
    np.add.at(cells, (jj, ii), 1)
    ok = np.isfinite(depth)
    np.add.at(total, (jj[ok], ii[ok]), depth[ok])
    np.add.at(count, (jj[ok], ii[ok]), 1)
    with np.errstate(invalid="ignore", divide="ignore"):
        mean = np.where(count >= 0.5 * cells, total / count, np.nan)  # mostly-land blocks → no data
    values = [[None if not math.isfinite(v) else round(float(v), 1) for v in row] for row in mean]
    print(
        f"    native {nrow}×{ncol} → {ny}×{nx}, depth {np.nanmin(mean):.1f}–{np.nanmax(mean):.1f} m"
    )
    return layer(
        "bathymetry",
        "Water depth (mean)",
        "bathymetry",
        "raster",
        "EMODnet Digital Bathymetry, latest DTM (DTM 2024, "
        "doi:10.12770/cf51df64-56f9-4a99-b1aa-36b8d7b743a1), "
        f"mean of the 1/16′ cells in {BATHY_STEP_DEG}° blocks",
        "EMODnet data, free and open with attribution; DO NOT USE FOR NAVIGATION",
        today,
        features=[],
        raster={
            "lon0": lon0 + BATHY_STEP_DEG / 2,
            "lat0": lat0 + BATHY_STEP_DEG / 2,
            "dlon": BATHY_STEP_DEG,
            "dlat": BATHY_STEP_DEG,
            "unit": "m (positive down)",
            "values": values,
        },
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    pack = json.loads(PACK.read_text(encoding="utf-8"))
    b = pack["bbox"]
    bbox = (float(b[0]), float(b[1]), float(b[2]), float(b[3]))
    today = datetime.now(UTC).date().isoformat()
    print(f"Region {pack['region']} bbox {bbox}")
    new_layers = build_layers(bbox, today)
    replaced = {lyr["id"] for lyr in new_layers}
    kept = [lyr for lyr in pack["layers"] if lyr["id"] not in replaced]
    pack["layers"] = kept + new_layers
    pack["pending"] = []
    for lyr in pack["layers"]:
        n = len(lyr.get("features", []))
        size = len(json.dumps(lyr))
        print(f"  {lyr['id']:<12} {lyr['role']:<12} {n:>3} features {size / 1024:7.1f} KiB")
    if args.dry_run:
        return
    PACK.write_text(
        json.dumps(pack, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
    )
    print(f"wrote {PACK} ({PACK.stat().st_size / 1024:.0f} KiB)")


if __name__ == "__main__":
    main()
