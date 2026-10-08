"""Download and package the open data layers of the site-assessment region.

    cd backend && python scripts/fetch_marine_layers.py            # writes the pack
    cd backend && python scripts/fetch_marine_layers.py --dry-run  # prints a summary only

The region is the whole Polish Baltic EEZ (REGION_BBOX). Every layer is
rebuilt from its source on each run; nothing is hand-drawn.

Sources (all queried through their public web services; licences read from
each dataset's metadata when this script was written):

* EMODnet Human Activities WFS (CC BY 4.0): Natura 2000 sites (EEA data),
  maritime spatial planning zones (energy and shipping basins), offshore wind
  farm projects (points), military areas, dumped munitions, pipelines.
* EMODnet Bathymetry WCS, latest DTM (DTM 2024 at writing; not for navigation).
* Marine Regions WFS (Flanders Marine Institute, CC BY 4.0): EEZ, 12 nm and
  internal waters of every State in the box — the union is the sea mask.
* OpenStreetMap via the Overpass API (ODbL 1.0): coastline, submarine cables
  and pipelines, PSE 400 kV substations, offshore wind farm outlines.
* Offshore wind ports: the role of each port (O&M base, installation terminal)
  from the operators' and developers' announcements (URLs in the layer), the
  location from OpenStreetMap (ODbL 1.0).
* EMODnet Geology WFS (CC BY 4.0): seabed substrate 1:250 000 (Folk 5 classes;
  Polish part = PGI-NRI Geological Map of the Baltic Sea bottom 1:200 000).

Polygons are clipped to the region box (plus a margin) and simplified
(Ramer–Douglas–Peucker, ≈ 100 m); bathymetry is block-averaged to a coarse
grid, so the pack stays small enough to commit.
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

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.site_assessment.geo import points_in_polygons

PACK = (
    Path(__file__).resolve().parents[1] / "app/services/site_assessment/data/southern_baltic.json"
)

#: lon_min, lat_min, lon_max, lat_max — the Polish EEZ (Marine Regions MRGID 5687:
#: 14.20–19.81 °E, up to 55.92 °N) plus the coast from Świnoujście to the Vistula Spit.
REGION_BBOX = (14.15, 53.85, 19.85, 55.95)
REGION_TITLE = "Southern Baltic — Polish EEZ"
REGION_DESCRIPTION = (
    "The whole Polish Baltic EEZ and its coast. Open data, simplified for screening; "
    "not a legal boundary and not for navigation."
)

EMODNET_HA_WFS = "https://ows.emodnet-humanactivities.eu/wfs"
EMODNET_BATHY_WCS = "https://ows.emodnet-bathymetry.eu/wcs"
MARINE_REGIONS_WFS = "https://geo.vliz.be/geoserver/MarineRegions/wfs"
EMODNET_GEOLOGY_WFS = "https://drive.emodnet-geology.eu/geoserver/gtk/wfs"
OVERPASS = (
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
)
USER_AGENT = "OffshoreForge-data-script/1.0 (educational; scripts/fetch_marine_layers.py)"

EMODNET_HA_LICENCE = (
    "CC BY 4.0 — data downloaded from the EMODnet Portal (https://emodnet.ec.europa.eu/en/)"
)
MARINE_REGIONS_LICENCE = (
    "CC BY 4.0 — Flanders Marine Institute (VLIZ), MarineRegions.org; no legal value"
)
OSM_LICENCE = "ODbL 1.0 © OpenStreetMap contributors"
MSP_PLAN = "https://dziennikustaw.gov.pl/D2021000093501.pdf"

MARGIN_DEG = 0.15
SIMPLIFY_DEG = 0.001  # ≈ 110 m north-south, 65 m east-west at 54.8° N
BATHY_STEP_DEG = 0.01
BATHY_TILE_DEG = 1.0  # WCS requests per 1° of longitude (the full box is ≈ 80 MB as text)
#: Polish coast only for shore distances: south of Bornholm (≈ 54.98 °N), west of
#: the Polish–Russian border on the Vistula Spit (19.63 °E).
COAST_BOX = (14.15, 53.85, 19.63, 54.97)


# ── HTTP ─────────────────────────────────────────────────────────


def _open(req: urllib.request.Request | str, retries: int = 4) -> bytes:
    delay = 2.0
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:  # fixed https hosts
                return bytes(resp.read())
        except OSError as exc:
            if attempt == retries:
                url = req.full_url if isinstance(req, urllib.request.Request) else req
                raise RuntimeError(f"request failed: {url}") from exc
            print(f"  retry in {delay:.0f} s ({exc})", file=sys.stderr)
            time.sleep(delay)
            delay *= 2
    raise AssertionError("unreachable")


def http_get(url: str, params: dict[str, str] | list[tuple[str, str]], retries: int = 4) -> bytes:
    full = f"{url}?{urllib.parse.urlencode(params, safe=':,()=')}"
    return _open(urllib.request.Request(full, headers={"User-Agent": USER_AGENT}), retries)


def wfs_geojson(
    url: str, type_name: str, bbox: tuple[float, float, float, float], **extra: str
) -> dict[str, Any]:
    """All features of a WFS layer in the box (paged, so server limits cannot truncate it)."""
    lon0, lat0, lon1, lat1 = bbox
    features: list[dict[str, Any]] = []
    page = 1000
    while True:
        params = {
            "service": "WFS",
            "version": "2.0.0",
            "request": "GetFeature",
            "typeNames": type_name,
            "outputFormat": "application/json",
            "srsName": "EPSG:4326",
            "count": str(page),
            "startIndex": str(len(features)),
            **extra,
        }
        if "CQL_FILTER" not in extra:
            params["bbox"] = f"{lat0},{lon0},{lat1},{lon1},urn:ogc:def:crs:EPSG::4326"
        batch = json.loads(http_get(url, params))["features"]
        features += batch
        if len(batch) < page:
            return {"type": "FeatureCollection", "features": features}


def overpass(query: str) -> list[dict[str, Any]]:
    """Run an Overpass QL query (out geom / center) on the first mirror that answers."""
    body = urllib.parse.urlencode({"data": query}).encode()
    last: Exception | None = None
    for url in OVERPASS:
        req = urllib.request.Request(url, data=body, headers={"User-Agent": USER_AGENT})
        try:
            elements: list[dict[str, Any]] = json.loads(_open(req, retries=2))["elements"]
            return elements
        except (RuntimeError, ValueError) as exc:
            print(f"  Overpass mirror failed: {url} ({exc})", file=sys.stderr)
            last = exc
    raise RuntimeError("every Overpass mirror failed") from last


def _obox(box: tuple[float, float, float, float]) -> str:
    lon0, lat0, lon1, lat1 = box
    return f"({lat0},{lon0},{lat1},{lon1})"


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
    # Rings far outside the box (global EEZ multipolygons) are dropped before the clip.
    if (
        ring[:, 0].max() < lon0
        or ring[:, 0].min() > lon1
        or ring[:, 1].max() < lat0
        or ring[:, 1].min() > lat1
    ):
        return np.empty((0, 2))
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


def line_coords(points: list[list[float]], box: tuple[float, float, float, float]) -> list[Any]:
    """Polyline → simplified pieces inside the box (a line leaving and re-entering splits)."""
    lon0, lat0, lon1, lat1 = box
    pieces: list[list[list[float]]] = []
    cur: list[list[float]] = []
    for lon, lat in points:
        if lon0 <= lon <= lon1 and lat0 <= lat <= lat1:
            cur.append([lon, lat])
        elif cur:
            pieces.append(cur)
            cur = []
    if cur:
        pieces.append(cur)
    out = []
    for piece in pieces:
        if len(piece) < 2:
            continue
        r = rdp(np.asarray(piece, dtype=float), SIMPLIFY_DEG)
        out.append([[round(float(x), 5), round(float(y), 5)] for x, y in r])
    return out


class SeaMask:
    """Point-at-sea test on the packed sea polygons (lon/lat, no projection needed here)."""

    def __init__(self, features: list[dict[str, Any]]) -> None:
        self.polygons = [[np.asarray(r, dtype=float) for r in f["coordinates"]] for f in features]

    def share(self, coords: list[list[float]]) -> float:
        a = np.asarray(coords, dtype=float)
        if a.size == 0:
            return 0.0
        return float(points_in_polygons(a[:, 0], a[:, 1], self.polygons).mean())


def _vertices(feature: dict[str, Any]) -> list[list[float]]:
    c = feature["coordinates"]
    return [p for ring in c for p in ring] if c and isinstance(c[0][0], list) else c


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


def maritime_zones(box: tuple[float, float, float, float], today: str) -> list[dict[str, Any]]:
    """Sea mask (every State's internal waters + 12 nm + EEZ) and the Polish EEZ / 12 nm."""
    zones: dict[str, dict[str, Any]] = {}
    for type_name in ("eez_internal_waters", "eez_12nm", "eez"):
        print(f"  Marine Regions: {type_name}")
        zones[type_name] = wfs_geojson(MARINE_REGIONS_WFS, f"MarineRegions:{type_name}", box)

    sea: list[dict[str, Any]] = []
    for type_name, fc in zones.items():
        sea += polygon_features(fc, box, lambda p: p["geoname"], lambda p, t=type_name: {"zone": t})

    def polish(type_name: str) -> dict[str, Any]:
        fc = zones[type_name]
        return {
            "type": "FeatureCollection",
            "features": [f for f in fc["features"] if f["properties"].get("iso_ter1") == "POL"],
        }

    out = [
        layer(
            "sea",
            "Sea (all States' internal waters, territorial seas and EEZs)",
            "sea",
            "polygon",
            "Flanders Marine Institute (2026): MarineRegions.org, union of the 'eez', "
            "'eez_12nm' and 'eez_internal_waters' layers in the region",
            MARINE_REGIONS_LICENCE,
            today,
            features=sea,
        )
    ]
    for type_name, id_, title, role in (
        ("eez", "eez", "Polish EEZ", "eez"),
        ("eez_12nm", "territorial", "Polish territorial sea (12 nm)", "territorial"),
    ):
        fc = polish(type_name)
        out.append(
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
    return out


def coastline(today: str) -> dict[str, Any]:
    print("  OpenStreetMap: natural=coastline (Polish coast)")
    ways = overpass(
        f'[out:json][timeout:240];way["natural"="coastline"]{_obox(COAST_BOX)};out geom;'
    )
    features = []
    for w in ways:
        pts = [[g["lon"], g["lat"]] for g in w.get("geometry", [])]
        for piece in line_coords(pts, COAST_BOX):
            features.append({"name": "Coastline", "coordinates": piece})
    return layer(
        "coastline",
        "Coastline (Polish coast)",
        "shore",
        "line",
        "OpenStreetMap natural=coastline via Overpass, Świnoujście → Vistula Spit, "
        "simplified ≈ 100 m",
        OSM_LICENCE,
        today,
        features=features,
    )


def cables(box: tuple[float, float, float, float], sea: SeaMask, today: str) -> dict[str, Any]:
    print("  OpenStreetMap: submarine cables and pipelines")
    b = _obox(box)
    ways = overpass(
        "[out:json][timeout:240];("
        f'way["power"="cable"]["location"~"underwater|submarine"]{b};'
        f'way["communication"="line"]["location"~"underwater|submarine"]{b};'
        f'way["telecom"="line"]["location"~"underwater|submarine"]{b};'
        f'way["man_made"="pipeline"]["location"~"underwater|submarine"]{b};'
        f'way["seamark:type"~"cable_submarine|pipeline_submarine"]{b};'
        ");out geom;"
    )
    features = []
    for w in ways:
        t = w.get("tags", {})
        kind = (
            "pipeline"
            if t.get("man_made") == "pipeline" or "pipeline" in t.get("seamark:type", "")
            else ("power cable" if t.get("power") == "cable" else "telecom cable")
        )
        name = t.get("name") or t.get("seamark:name") or t.get("operator") or f"Unnamed {kind}"
        pts = [[g["lon"], g["lat"]] for g in w.get("geometry", [])]
        for piece in line_coords(pts, box):
            if sea.share(piece) > 0.5:
                features.append({"name": name, "coordinates": piece, "kind": kind})
    print("  EMODnet Human Activities: pipelines")
    for f in fetch_ha("pipelines", box)["features"]:
        g, p = f.get("geometry"), f["properties"]
        if not g:
            continue
        lines = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
        name = (
            p.get("name") or f"Pipeline ({p.get('country') or 'unnamed'}, {p.get('year') or '—'})"
        )
        for line in lines:
            for piece in line_coords([pt[:2] for pt in line], box):
                if sea.share(piece) > 0.5:
                    features.append(
                        {
                            "name": name,
                            "coordinates": piece,
                            "kind": "pipeline",
                            "status": p.get("status"),
                        }
                    )
    return layer(
        "cables",
        "Submarine cables and pipelines",
        "cable",
        "line",
        "OpenStreetMap submarine power/telecom cables and pipelines (Overpass), plus EMODnet "
        "Human Activities 'pipelines'",
        f"{OSM_LICENCE}; {EMODNET_HA_LICENCE}",
        today,
        features=features,
    )


def grid_nodes(today: str) -> dict[str, Any]:
    """PSE 400 kV substations near the coast (existing and planned), from OSM."""
    print("  OpenStreetMap: PSE 400 kV substations")
    box = (14.15, 53.6, 19.7, 54.95)
    b = _obox(box)
    elements = overpass(
        "[out:json][timeout:240];("
        f'nwr["power"="substation"]["voltage"~"400000"]{b};'
        f'nwr["construction:power"="substation"]["voltage"~"400000"]{b};'
        f'nwr["power"="construction"]["construction"="substation"]["voltage"~"400000"]{b};'
        f'nwr["voltage"~"400000"]["name"~"planowana"]{b};'
        ");out tags center;"
    )
    features = []
    seen: set[str] = set()
    for e in elements:
        t = e.get("tags", {})
        operator = t.get("operator", "")
        if "PSE" not in operator and "Polskie Sieci" not in operator:
            continue  # wind-farm and converter stations are not grid connection points
        c = e.get("center") or {"lat": e.get("lat"), "lon": e.get("lon")}
        name = t.get("name", "PSE substation")
        if name in seen:
            continue
        seen.add(name)
        planned = "planowan" in name.lower() or t.get("power") != "substation"
        features.append(
            {
                "name": name,
                "coordinates": [round(float(c["lon"]), 5), round(float(c["lat"]), 5)],
                "voltage_kv": sorted(
                    {int(v) // 1000 for v in t.get("voltage", "").split(";") if v.isdigit()},
                    reverse=True,
                ),
                "status": "planned" if planned else "existing",
                "osm": f"{e['type']}/{e['id']}",
            }
        )
    return layer(
        "grid_nodes",
        "PSE 400 kV substations (existing and planned)",
        "grid",
        "point",
        "OpenStreetMap power=substation, voltage 400 kV, operator PSE (Overpass); planned "
        "stations as tagged in OSM — check PSE's development plan before relying on them",
        OSM_LICENCE,
        today,
        features=features,
    )


#: Offshore wind ports of the Polish projects: (name, OSM element, use, status, basis).
#: Use and status as announced by the operators (read 2026-10-08) — check before relying on them.
PORTS: tuple[tuple[str, str, str, str, str], ...] = (
    (
        "Łeba",
        "way/767300574",
        "O&M",
        "operating",
        "O&M bases of Baltic Power (opened May 2025, balticpower.pl/news/baltic-power-opens-"
        "poland-s-first-offshore-wind-service-base/) and Bałtyk 2 / 3 (equinor.com/news/archive/"
        "20210527-leba-location-operations-maintenance-base)",
    ),
    (
        "Ustka",
        "way/766572375",
        "O&M",
        "under construction",
        "O&M base of PGE Baltica for Baltica 2 / 3 (construction agreement, offshorewindpoland.pl/"
        "en/new-milestone-for-baltic-wind-energy-pge-balticas-om-base-construction-agreement-"
        "signed/)",
    ),
    (
        "Władysławowo",
        "way/1229512469",
        "O&M",
        "under construction",
        "Service base of Ocean Winds for BC-Wind (oceanwinds.com/news/uncategorized/service-base-"
        "for-ocean-winds-offshore-wind-farm-to-be-built-in-wladyslawowo-poland/)",
    ),
    (
        "Świnoujście (ORLEN offshore terminal)",
        "way/202802684",
        "installation",
        "operating",
        "Poland's first offshore installation terminal, in operation since June 2025 "
        "(balticwind.eu/the-swinoujscie-offshore-terminal-how-polands-first-installation-port-"
        "works/)",
    ),
    (
        "Gdańsk T5",
        "way/1188598243",
        "installation",
        "under construction",
        "Installation terminal for Baltica 2, lease from Q4 2026 (baltica.energy/en/news/2024/09/"
        "pge-and-orsted-to-lease-port-space-in-gdansk-for-baltica-2)",
    ),
    (
        "Rønne (DK)",
        "way/1038343418",
        "installation",
        "operating",
        "Installation port of Baltic Power (portofroenne.com/press/polish-wind-farm-baltic-power-"
        "will-use-port-of-roenne/)",
    ),
)


def ports(today: str) -> dict[str, Any]:
    """Offshore wind ports: role from the announcements, location from OSM."""
    print("  OpenStreetMap: offshore wind ports")
    ids = "".join(f"{kind}({ref});" for kind, ref in (p[1].split("/") for p in PORTS))
    found = {
        f"{e['type']}/{e['id']}": e.get("center") or e
        for e in overpass(f"[out:json][timeout:120];({ids});out center;")
    }
    features = []
    for name, osm, use, status, basis in PORTS:
        c = found[osm]
        features.append(
            {
                "name": name,
                "coordinates": [round(float(c["lon"]), 5), round(float(c["lat"]), 5)],
                "use": use,
                "status": status,
                "basis": basis,
                "osm": osm,
            }
        )
    return layer(
        "ports",
        "Offshore wind ports (O&M bases, installation terminals)",
        "port",
        "point",
        "Role: operators' and developers' announcements (see each port's basis); location: "
        "OpenStreetMap harbour / port areas (Overpass)",
        OSM_LICENCE,
        today,
        features=features,
    )


def stitch(segments: list[list[list[float]]]) -> list[list[list[float]]]:
    """Join open way segments (multipolygon members) end to end into closed rings."""
    rings: list[list[list[float]]] = []
    pool = [seg[:] for seg in segments if len(seg) >= 2]
    while pool:
        ring = pool.pop()
        grown = True
        while ring[0] != ring[-1] and grown:
            grown = False
            for k, seg in enumerate(pool):
                if seg[0] == ring[-1]:
                    ring += seg[1:]
                elif seg[-1] == ring[-1]:
                    ring += seg[::-1][1:]
                elif seg[-1] == ring[0]:
                    ring = seg[:-1] + ring
                elif seg[0] == ring[0]:
                    ring = seg[::-1][:-1] + ring
                else:
                    continue
                pool.pop(k)
                grown = True
                break
        if ring[0] == ring[-1] and len(ring) >= 4:
            rings.append(ring)
    return rings


def wind_projects(
    box: tuple[float, float, float, float], sea: SeaMask, today: str
) -> list[dict[str, Any]]:
    """Real offshore wind projects: OSM outlines where mapped, EMODnet points for all."""
    print("  OpenStreetMap: offshore wind farm outlines (operating and under construction)")
    b = _obox(box)
    elements = overpass(
        "[out:json][timeout:240];("
        f'way["power"="plant"]["plant:source"="wind"]{b};'
        f'way["construction:power"="plant"]["plant:source"="wind"]{b};'
        f'relation["type"="multipolygon"]["power"="plant"]["plant:source"="wind"]{b};'
        f'relation["type"="multipolygon"]["construction:power"="plant"]["plant:source"="wind"]{b};'
        ");out geom;"
    )
    # Relations first: they are the complete outlines; a way that repeats one is dropped.
    elements.sort(key=lambda e: e["type"] != "relation")
    outlines: list[dict[str, Any]] = []
    kept: list[np.ndarray] = []
    for e in elements:
        t = e.get("tags", {})
        if e["type"] == "way":
            rings = stitch([[[g["lon"], g["lat"]] for g in e.get("geometry", [])]])
        else:
            rings = stitch(
                [
                    [[g["lon"], g["lat"]] for g in m["geometry"]]
                    for m in e.get("members", [])
                    if m.get("role") == "outer" and m.get("geometry")
                ]
            )
        for ring in rings:
            if sea.share(ring) < 0.9:
                continue  # onshore wind farm
            centre = np.asarray(ring, dtype=float).mean(axis=0)
            if any(points_in_polygons(centre[:1], centre[1:], [[k]])[0] for k in kept):
                continue  # same farm mapped twice (way and multipolygon)
            for poly in prepare_polygons({"type": "Polygon", "coordinates": [ring]}, box):
                kept.append(np.asarray(poly[0], dtype=float))
                outlines.append(
                    {
                        "name": t.get("name", "Offshore wind farm"),
                        "coordinates": poly,
                        "operator": t.get("operator"),
                        "power_mw": _mw(t.get("plant:output:electricity")),
                        "status": "construction" if "construction:power" in t else "operating",
                        "osm": f"{e['type']}/{e['id']}",
                    }
                )
    points = []
    for f in fetch_ha("windfarms", box)["features"]:
        p, g = f["properties"], f.get("geometry")
        if not g or g["type"] != "Point":
            continue
        points.append(
            {
                "name": p.get("name") or "Wind farm",
                "coordinates": [round(g["coordinates"][0], 5), round(g["coordinates"][1], 5)],
                "country": p.get("country"),
                "status": p.get("status"),
                "power_mw": p.get("power_mw"),
                "n_turbines": p.get("n_turbines"),
                "year": p.get("year"),
            }
        )
    return [
        layer(
            "owf_outlines",
            "Offshore wind farms (mapped outlines)",
            "owf",
            "polygon",
            "OpenStreetMap power=plant / construction:power=plant + plant:source=wind at sea "
            "(Overpass): the outlines mappers have drawn so far",
            OSM_LICENCE,
            today,
            features=outlines,
        ),
        layer(
            "owf_projects",
            "Offshore wind farm projects (locations)",
            "owf",
            "point",
            "EMODnet Human Activities 'windfarms' (status, capacity, year as reported)",
            EMODNET_HA_LICENCE,
            today,
            features=points,
        ),
    ]


def _mw(value: str | None) -> float | None:
    if not value:
        return None
    num = value.replace(",", ".").split()[0]
    try:
        mw = float(num)
    except ValueError:
        return None
    return mw / 1000 if "kW" in value else mw


def msp_layers(box: tuple[float, float, float, float], today: str) -> list[dict[str, Any]]:
    """Energy and shipping basins of the maritime spatial plans (one row per basin and use)."""
    msp = fetch_ha("mspzoningpoly", box)
    energy = {
        "type": "FeatureCollection",
        "features": [
            f
            for f in msp["features"]
            if f["properties"].get("ms") == "Poland"
            and f["properties"].get("seausename") == "Wind Farms"
            and f["properties"].get("seausefct") == "Priority"
        ],
    }
    if not energy["features"]:
        raise RuntimeError("no Polish energy ('Wind Farms', Priority) basin found in mspzoningpoly")
    traffic = {
        "type": "FeatureCollection",
        "features": [
            f
            for f in msp["features"]
            if f["properties"].get("seausename") == "Maritime Traffic flows"
            and f["properties"].get("seausefct") == "Priority"
        ],
    }
    return [
        layer(
            "msp_energy",
            "Energy basins of the maritime spatial plan (offshore wind allowed)",
            "msp_energy",
            "polygon",
            "Polish maritime spatial plan (Dz.U. 2021 poz. 935): basins with renewable energy "
            "as priority use ('E' function), via EMODnet Human Activities 'mspzoningpoly'",
            EMODNET_HA_LICENCE,
            today,
            features=polygon_features(
                energy,
                box,
                lambda p: f"{p.get('localid')} — energy basin",
                lambda p: {"basin": p.get("localid"), "plan": p.get("offsource") or MSP_PLAN},
            ),
        ),
        layer(
            "shipping",
            "Shipping priority basins (maritime spatial plans)",
            "shipping",
            "polygon",
            "Maritime spatial plans (Poland: Dz.U. 2021 poz. 935): basins with 'maritime traffic "
            "flows' as priority use, via EMODnet Human Activities 'mspzoningpoly'",
            EMODNET_HA_LICENCE,
            today,
            features=polygon_features(
                traffic,
                box,
                lambda p: f"{p.get('localid')} — shipping priority",
                lambda p: {"plan": p.get("offsource")},
            ),
        ),
    ]


def build_layers(bbox: tuple[float, float, float, float], today: str) -> list[dict[str, Any]]:
    lon0, lat0, lon1, lat1 = bbox
    box = (lon0 - MARGIN_DEG, lat0 - MARGIN_DEG, lon1 + MARGIN_DEG, lat1 + MARGIN_DEG)
    layers = maritime_zones(box, today)
    sea = SeaMask(layers[0]["features"])
    layers.append(coastline(today))
    layers.append(cables(box, sea, today))
    layers.append(grid_nodes(today))
    layers.append(ports(today))

    n2k = fetch_ha("natura2000areas", box)
    natura = [
        f
        for f in polygon_features(
            n2k,
            box,
            lambda p: f"{p['sitename']} ({p['sitecode']})",
            lambda p: {
                "sitecode": p["sitecode"],
                "sitetype": p.get("sitedesc"),
                "release": p.get("release_da"),
            },
        )
        if sea.share(_vertices(f)) > 0.0  # marine and coastal sites; inland ones never matter
    ]
    layers.append(
        layer(
            "natura2000",
            "Natura 2000 sites",
            "protected",
            "polygon",
            "EEA Natura 2000 spatial data via EMODnet Human Activities 'natura2000areas' "
            "(marine and coastal sites)",
            EMODNET_HA_LICENCE,
            today,
            features=natura,
        )
    )
    layers += wind_projects(box, sea, today)
    layers += msp_layers(box, today)

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
            features=[f for f in restricted if sea.share(_vertices(f)) > 0.0],
        )
    )
    layers.append(fetch_bathymetry(bbox, today))
    layers.append(fetch_seabed(bbox, today))
    return layers


def rebuild_group(group: str, pack: dict[str, Any], today: str) -> list[dict[str, Any]]:
    """Fresh layers of one group; the rest of the pack is kept."""
    lon0, lat0, lon1, lat1 = REGION_BBOX
    box = (lon0 - MARGIN_DEG, lat0 - MARGIN_DEG, lon1 + MARGIN_DEG, lat1 + MARGIN_DEG)
    if group == "wind":
        sea = SeaMask(next(lyr for lyr in pack["layers"] if lyr["id"] == "sea")["features"])
        return wind_projects(box, sea, today)
    if group == "ports":
        return [ports(today)]
    return [fetch_seabed(REGION_BBOX, today)]


#: EMODnet Geology Folk 5-class substrate codes kept in the pack (6 = no data, 9 = restricted).
SEABED_CLASSES = {
    1: "Mud to muddy sand",
    2: "Sand",
    3: "Coarse-grained sediment",
    4: "Mixed sediment",
    5: "Rock and boulders",
}


def fetch_seabed(bbox: tuple[float, float, float, float], today: str) -> dict[str, Any]:
    """Seabed substrate class at the centre of every bathymetry block (same 0.01° grid).

    One digit per cell (Folk 5 class, "0" = no data), one string per row: the
    class map is categorical, so the pack keeps the class under each cell centre
    instead of interpolating between classes.
    """
    print("  EMODnet Geology: seabed_substrate_250k")
    lon0, lat0, lon1, lat1 = bbox
    box = (lon0 - MARGIN_DEG, lat0 - MARGIN_DEG, lon1 + MARGIN_DEG, lat1 + MARGIN_DEG)
    fc = wfs_geojson(EMODNET_GEOLOGY_WFS, "gtk:seabed_substrate_250k", box, sortBy="objectid")
    nx = math.ceil((lon1 - lon0) / BATHY_STEP_DEG)
    ny = math.ceil((lat1 - lat0) / BATHY_STEP_DEG)
    lon = lon0 + BATHY_STEP_DEG / 2 + BATHY_STEP_DEG * np.arange(nx)
    lat = lat0 + BATHY_STEP_DEG / 2 + BATHY_STEP_DEG * np.arange(ny)
    gx, gy = np.meshgrid(lon, lat)
    px, py = gx.ravel(), gy.ravel()
    cls = np.zeros(px.size, dtype=int)
    holders: set[str] = set()
    for f in fc["features"]:
        code = int(f["properties"].get("folk_5cl") or 0)
        g = f.get("geometry")
        if code not in SEABED_CLASSES or not g:
            continue
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        rings = [[np.asarray(r, dtype=float)[:, :2] for r in poly] for poly in polys]
        free = cls == 0  # overlapping national maps: the first one wins
        hit = np.zeros(px.size, dtype=bool)
        hit[free] = points_in_polygons(px[free], py[free], rings)
        if hit.any():
            cls[hit] = code
            holders.add(str(f["properties"].get("data_holder") or "").strip())
    grid = cls.reshape(ny, nx)
    counts = {SEABED_CLASSES[k]: int((grid == k).sum()) for k in SEABED_CLASSES}
    print(f"    → {ny}×{nx} cells, classes {counts}")
    return layer(
        "seabed",
        "Seabed substrate (Folk 5 classes)",
        "seabed",
        "raster",
        "EMODnet Geology seabed substrate 1:250 000 (gtk:seabed_substrate_250k), Folk 5-class "
        "scheme; Polish waters from PGI-NRI, Geological Map of the Baltic Sea bottom 1:200 000 "
        f"(Mojski ed., 1988–1995); data holders {', '.join(sorted(h for h in holders if h))}. "
        f"Class at the centre of each {BATHY_STEP_DEG}° cell",
        "CC BY 4.0 — EMODnet Geology (https://emodnet.ec.europa.eu/en/geology)",
        today,
        features=[],
        raster={
            "lon0": lon0 + BATHY_STEP_DEG / 2,
            "lat0": lat0 + BATHY_STEP_DEG / 2,
            "dlon": BATHY_STEP_DEG,
            "dlat": BATHY_STEP_DEG,
            "classes": {str(k): v for k, v in SEABED_CLASSES.items()},
            "rows": ["".join(str(v) for v in row) for row in grid],
        },
    )


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
    """Mean depth on the native 1/16′ grid, block-averaged to BATHY_STEP_DEG cells.

    The box is requested in 1° longitude tiles; each native cell is added to the
    block that contains its centre, so tiles combine exactly.
    """
    lon0, lat0, lon1, lat1 = bbox
    nx = math.ceil((lon1 - lon0) / BATHY_STEP_DEG)
    ny = math.ceil((lat1 - lat0) / BATHY_STEP_DEG)
    total = np.zeros((ny, nx))
    count = np.zeros((ny, nx))
    cells = np.zeros((ny, nx))
    t0 = lon0
    while t0 < lon1 - 1e-9:
        t1 = min(lon1, t0 + BATHY_TILE_DEG)
        print(f"  EMODnet Bathymetry: emodnet__mean {t0:.2f}–{t1:.2f} °E")
        raw = http_get(
            EMODNET_BATHY_WCS,
            [
                ("service", "WCS"),
                ("version", "2.0.1"),
                ("request", "GetCoverage"),
                ("coverageId", "emodnet__mean"),
                ("format", "text/plain"),
                ("subset", f"Long({t0},{t1})"),
                ("subset", f"Lat({lat0},{lat1})"),
            ],
        )
        elev, x0, dx, y0, dy = parse_wcs_text(raw.decode("utf-8"))
        nrow, ncol = elev.shape
        lon = x0 + dx * np.arange(ncol)
        lat = y0 + dy * np.arange(nrow)
        # A tile edge cell can come back from both neighbours: keep each centre once.
        keep_col = (lon >= t0) & (lon < t1) if t1 < lon1 else (lon >= t0)
        lon, elev = lon[keep_col], elev[:, keep_col]
        with np.errstate(invalid="ignore"):
            depth = np.where(elev < 0, -elev, np.nan)  # positive down; land and no-data → NaN
        ci = np.clip(((lon - lon0) / BATHY_STEP_DEG).astype(int), 0, nx - 1)
        rj = np.clip(((lat - lat0) / BATHY_STEP_DEG).astype(int), 0, ny - 1)
        jj, ii = np.meshgrid(rj, ci, indexing="ij")
        np.add.at(cells, (jj, ii), 1)
        ok = np.isfinite(depth)
        np.add.at(total, (jj[ok], ii[ok]), depth[ok])
        np.add.at(count, (jj[ok], ii[ok]), 1)
        t0 = t1
    with np.errstate(invalid="ignore", divide="ignore"):
        mean = np.where(count >= 0.5 * cells, total / count, np.nan)  # mostly-land blocks → no data
    values = [[None if not math.isfinite(v) else round(float(v), 1) for v in row] for row in mean]
    print(f"    → {ny}×{nx} blocks, depth {np.nanmin(mean):.1f}–{np.nanmax(mean):.1f} m")
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
    parser.add_argument(
        "--only",
        choices=("wind", "seabed", "ports"),
        help="rebuild one group of layers and keep the rest of the pack (needs a full pack)",
    )
    args = parser.parse_args()
    pack = json.loads(PACK.read_text(encoding="utf-8"))
    today = datetime.now(UTC).date().isoformat()
    print(f"Region {pack['region']} bbox {REGION_BBOX}")
    if args.only:
        fresh = {lyr["id"]: lyr for lyr in rebuild_group(args.only, pack, today)}
        layers = [fresh.pop(lyr["id"], lyr) for lyr in pack["layers"]] + list(fresh.values())
    else:
        layers = build_layers(REGION_BBOX, today)
        # The wind climate comes from scripts/fetch_wind_climate.py: keep it.
        layers += [lyr for lyr in pack["layers"] if lyr["role"] in ("wind", "wind_rose")]
    pack.update(
        bbox=list(REGION_BBOX),
        title=REGION_TITLE,
        description=REGION_DESCRIPTION,
        layers=layers,
        pending=[],
    )
    for lyr in pack["layers"]:
        n = len(lyr.get("features", []))
        size = len(json.dumps(lyr))
        print(f"  {lyr['id']:<13} {lyr['role']:<11} {n:>4} features {size / 1024:7.1f} KiB")
    if args.dry_run:
        return
    PACK.write_text(
        json.dumps(pack, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
    )
    print(f"wrote {PACK} ({PACK.stat().st_size / 1024:.0f} KiB)")


if __name__ == "__main__":
    main()
