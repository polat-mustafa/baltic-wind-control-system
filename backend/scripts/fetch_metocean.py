"""Build the SB-510 met-ocean hindcast: 30 years of real waves, wind and sea ice.

    cd backend && python scripts/fetch_metocean.py

Writes app/services/lifecycle/data/
* ``sb510_metocean_6h.csv.gz`` — 6-hourly ``hs_m`` (significant wave height) and
  ``v10_ms`` (10 m wind speed), 1995–2024, at PZP_44 (55.06 °N 16.54 °E). Each 6 h value
  is the WORST hour of the block (max), so a step is workable only if every hour is.
    - Hs: ERA5 ocean-wave model (ECMWF WAM, 0.5°) via the Open-Meteo Marine API
      (``models=era5_ocean``), CC BY 4.0.
    - Wind: ERA5 10 m wind via the Open-Meteo archive API, CC BY 4.0.
* ``sb510_ice.json`` — days per winter with sea ice at the site cell: NOAA OISST v2.1
  daily sea-ice concentration (0.25°, AMSR/SSMIS passive microwave), via NOAA
  CoastWatch ERDDAP (``ncdcOisst21Agg_LonPM180``), public domain. Read with care: a
  passive-microwave cell near a coast can show false ice; PZP_44 is 37 km offshore.
"""

from __future__ import annotations

import csv
import gzip
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np

OUT = Path(__file__).resolve().parents[1] / "app/services/lifecycle/data"
LAT, LON = 55.06, 16.54
START, END = "1995-01-01", "2024-12-31"
ICE_CELL = (55.125, 16.625)  # OISST 0.25° cell centre containing the site
ERDDAP = "https://coastwatch.pfeg.noaa.gov/erddap/griddap/ncdcOisst21Agg_LonPM180.csv"


def _get(url: str) -> bytes:
    for attempt in range(6):  # ERDDAP answers 503 now and then under load
        try:
            with urllib.request.urlopen(url, timeout=600) as r:
                return bytes(r.read())
        except urllib.error.HTTPError as e:
            if e.code < 500 or attempt == 5:
                raise
            time.sleep(10 * (attempt + 1))
    raise RuntimeError("unreachable")


def hourly(base: str, var: str, **extra: str) -> tuple[list[str], np.ndarray]:
    q = {"latitude": LAT, "longitude": LON, "start_date": START, "end_date": END}
    q |= {"hourly": var, **extra}
    h = json.loads(_get(f"{base}?{urllib.parse.urlencode(q)}"))["hourly"]
    return h["time"], np.array([np.nan if v is None else v for v in h[var]], dtype=float)


def ice_days() -> dict[str, int]:
    """Days with ice concentration > 0 per winter (Jul–Jun, labelled by its January)."""
    days: dict[str, int] = {}
    for year in range(1995, 2025):
        q = f"ice[({year - 1}-07-01):1:({year}-06-30)][(0.0)][({ICE_CELL[0]})][({ICE_CELL[1]})]"
        rows = _get(f"{ERDDAP}?{urllib.parse.quote(q, safe='():,')}").decode().splitlines()[2:]
        conc = [float(r.split(",")[-1]) for r in rows if r.split(",")[-1] != "NaN"]
        days[str(year)] = sum(c > 0 for c in conc)
    return days


def main() -> int:
    if "--ice-only" not in sys.argv:
        write_hindcast()
    write_ice()
    return 0


def write_hindcast() -> None:
    t, hs = hourly(
        "https://marine-api.open-meteo.com/v1/marine", "wave_height", models="era5_ocean"
    )
    t2, v10 = hourly(
        "https://archive-api.open-meteo.com/v1/archive",
        "wind_speed_10m",
        models="era5",
        wind_speed_unit="ms",
    )
    assert t == t2, "wave and wind hours differ"
    n = len(t) // 6 * 6
    hs6 = np.nanmax(hs[:n].reshape(-1, 6), axis=1)
    v6 = np.nanmax(v10[:n].reshape(-1, 6), axis=1)
    OUT.mkdir(parents=True, exist_ok=True)
    with gzip.open(OUT / "sb510_metocean_6h.csv.gz", "wt", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["time_utc", "hs_m", "v10_ms"])
        w.writerows(
            [t[i * 6] + "Z", round(float(a), 2), round(float(b), 2)]
            for i, (a, b) in enumerate(zip(hs6, v6, strict=True))
        )
    print(
        f"{len(hs6)} 6-h steps, Hs mean {np.nanmean(hs6):.2f} m, v10 mean {np.nanmean(v6):.2f} m/s"
    )


def write_ice() -> None:
    ice = ice_days()
    (OUT / "sb510_ice.json").write_text(
        json.dumps(
            {
                "source": "NOAA OISST v2.1 daily sea-ice concentration, cell "
                f"{ICE_CELL[0]} °N {ICE_CELL[1]} °E, via CoastWatch ERDDAP (public domain)",
                "ice_days_by_winter": ice,
            },
            indent=1,
        ),
        encoding="utf-8",
    )
    print("ice days per winter:", {k: v for k, v in ice.items() if v}, "(others 0)")


if __name__ == "__main__":
    sys.exit(main())
