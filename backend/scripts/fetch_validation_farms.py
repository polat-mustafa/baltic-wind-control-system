"""Inputs for the AEP-chain validation on Rødsand II (evidence programme A1).

    cd backend && python scripts/fetch_validation_farms.py

Writes app/services/p1/validation_data/roedsand2/:

- ``layout.csv`` — the 90 Siemens SWT-2.3-93 positions from OpenStreetMap
  (Overpass API, ``generator:source=wind`` west of 11.64° E; Nysted / Rødsand 1 lies east
  of it). © OpenStreetMap contributors, ODbL 1.0.
- ``era5_2025.csv.gz`` — ERA5 hourly 100 m wind speed and direction for 2025 at the farm
  centroid (Open-Meteo archive API, ``models=era5``; Copernicus C3S, CC BY 4.0).

The measured output of the same farm is the ENTSO-E 16.1.A series already bundled for
P4 (``app/services/p4/data/entsoe_roedsand2.csv.gz``).
"""

from __future__ import annotations

import csv
import gzip
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "app/services/p1/validation_data/roedsand2"
OVERPASS = "https://overpass-api.de/api/interpreter"
ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
#: Overpass answers 406 without a User-Agent.
HEADERS = {"User-Agent": "OffshoreForge-validation/1.0 (educational)", "Accept": "application/json"}
BBOX = (54.50, 11.35, 54.62, 11.64)  # S, W, N, E — Rødsand II only
N_TURBINES = 90


def _get(url: str, data: bytes | None = None, timeout: int = 180) -> bytes:
    """GET / POST with three tries: the public Overpass servers often answer 429 / 504."""
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, data=data, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return bytes(r.read())
        except urllib.error.HTTPError as exc:
            if exc.code not in (429, 502, 503, 504) or attempt == 2:
                raise
            time.sleep(30 * (attempt + 1))
    raise RuntimeError("unreachable")


def fetch_layout() -> list[tuple[int, float, float]]:
    s, w, n, e = BBOX
    query = f'[out:json][timeout:60];node["generator:source"="wind"]({s},{w},{n},{e});out;'
    body = urllib.parse.urlencode({"data": query}).encode()
    nodes = json.loads(_get(OVERPASS, body))["elements"]
    rows = sorted((el["id"], el["lat"], el["lon"]) for el in nodes)
    models = {el["tags"].get("model") for el in nodes}
    if len(rows) != N_TURBINES or models != {"SWT-2.3-93"}:
        raise RuntimeError(f"expected {N_TURBINES} × SWT-2.3-93, got {len(rows)} ({models})")
    return rows


def fetch_era5(lat: float, lon: float) -> dict[str, list]:
    q = {
        "latitude": f"{lat:.4f}",
        "longitude": f"{lon:.4f}",
        "start_date": "2025-01-01",
        "end_date": "2025-12-31",
        "hourly": "wind_speed_100m,wind_direction_100m",
        "wind_speed_unit": "ms",
        "timezone": "GMT",
        "models": "era5",
    }
    data = json.loads(_get(f"{ARCHIVE}?{urllib.parse.urlencode(q)}"))
    print(f"ERA5 grid point {data['latitude']} N {data['longitude']} E")
    return dict(data["hourly"])


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    layout = fetch_layout()
    with (OUT / "layout.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["osm_id", "lat", "lon"])
        w.writerows(layout)
    lat = sum(r[1] for r in layout) / len(layout)
    lon = sum(r[2] for r in layout) / len(layout)
    h = fetch_era5(lat, lon)
    with gzip.open(OUT / "era5_2025.csv.gz", "wt", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["time_utc", "ws100", "wd100"])
        w.writerows(zip(h["time"], h["wind_speed_100m"], h["wind_direction_100m"], strict=True))
    print(f"wrote {len(layout)} turbines, {len(h['time'])} hours to {OUT}")


if __name__ == "__main__":
    main()
