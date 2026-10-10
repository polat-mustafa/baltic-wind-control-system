"""Build the real-data forecasting set: Baltic offshore production + archived day-ahead NWP.

    cd backend && python scripts/fetch_real_forecast_data.py            # writes the file
    cd backend && python scripts/fetch_real_forecast_data.py --dry-run  # prints a summary only

Writes app/services/p4/data/dk2_offshore_dayahead.csv.gz, one row per UTC hour:

* ``power_mw`` — measured hourly production of the offshore wind farms ≥ 100 MW in the
  Danish price area DK2 (Energinet Energi Data Service, dataset
  ProductionConsumptionSettlement, column OffshoreWindGe100MW_MWh; settlement metering,
  MWh in one hour = mean MW). In DK2 these are three Baltic farms: Kriegers Flak
  (604.8 MW, 2021), Rødsand II (207 MW, 2010) and Nysted / Rødsand I (165.6 MW, 2003).
  Licence: Energinet open data, CC BY 4.0.
* ``{model}_{site}_ws`` / ``_wd`` — the 100 m wind speed [m/s] and direction [°] that
  the ECMWF IFS 0.25° and DWD ICON runs issued one day earlier predicted for that hour
  (Open-Meteo Previous Runs API, ``*_previous_day1``: lead 24–47 h, i.e. what a
  day-ahead bid at 12:00 D−1 can know). Sites: Kriegers Flak and Rødsand.
  Licence: Open-Meteo CC BY 4.0 (ECMWF and DWD data, CC BY 4.0).

With ``--tso-only`` it writes app/services/p4/data/dk2_tso_dayahead.csv.gz instead: Energinet's
own day-ahead forecast for DK2 offshore wind (dataset Forecasts_Hour, ForecastType "Offshore
Wind", column ForecastDayAhead [MW], CC BY 4.0) — the TSO benchmark. It is issued around
17:50 D−1, after the 12:00 bid gate, so it knows ~6 h more weather than our models.

The archive of earlier runs starts in 2024 (ECMWF from 2024-03 … 06), so the set
starts 2024-06-01. Hours with a missing value are dropped, not filled.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import json
import sys
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "app/services/p4/data"
OUT = DATA / "dk2_offshore_dayahead.csv.gz"
TSO_OUT = DATA / "dk2_tso_dayahead.csv.gz"
START = date(2024, 6, 1)
SITES = {"kf": (55.03, 12.93), "rs": (54.56, 11.60)}  # Kriegers Flak, Rødsand
MODELS = {"ecmwf": "ecmwf_ifs025", "icon": "icon_seamless"}
ENERGINET = "https://api.energidataservice.dk/dataset/ProductionConsumptionSettlement"
FORECASTS = "https://api.energidataservice.dk/dataset/Forecasts_Hour"
PREVIOUS_RUNS = "https://previous-runs-api.open-meteo.com/v1/forecast"


def _get(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=120) as r:
        return json.load(r)


def fetch_power(start: date, end: date) -> dict[str, float]:
    q = {
        "start": start.isoformat(),
        "end": (end + timedelta(days=1)).isoformat(),
        "filter": json.dumps({"PriceArea": ["DK2"]}),
        "columns": "HourUTC,OffshoreWindGe100MW_MWh",
        "limit": 0,
    }
    recs = _get(f"{ENERGINET}?{urllib.parse.urlencode(q)}")["records"]
    return {
        r["HourUTC"][:13]: float(r["OffshoreWindGe100MW_MWh"])
        for r in recs
        if r["OffshoreWindGe100MW_MWh"] is not None
    }


def fetch_tso(start: date, end: date) -> dict[str, float]:
    q = {
        "start": start.isoformat(),
        "end": (end + timedelta(days=1)).isoformat(),
        "filter": json.dumps({"PriceArea": ["DK2"], "ForecastType": ["Offshore Wind"]}),
        "columns": "HourUTC,ForecastDayAhead",
        "limit": 0,
    }
    recs = _get(f"{FORECASTS}?{urllib.parse.urlencode(q)}")["records"]
    return {
        r["HourUTC"][:13]: float(r["ForecastDayAhead"])
        for r in recs
        if r["ForecastDayAhead"] is not None
    }


def fetch_nwp(model: str, lat: float, lon: float, start: date, end: date) -> dict[str, tuple]:
    out: dict[str, tuple] = {}
    chunk = start
    while chunk <= end:  # half-year chunks keep each response small
        stop = min(end, chunk + timedelta(days=182))
        q = {
            "latitude": lat,
            "longitude": lon,
            "start_date": chunk.isoformat(),
            "end_date": stop.isoformat(),
            "hourly": "wind_speed_100m_previous_day1,wind_direction_100m_previous_day1",
            "wind_speed_unit": "ms",
            "models": model,
        }
        h = _get(f"{PREVIOUS_RUNS}?{urllib.parse.urlencode(q)}")["hourly"]
        ws, wd = h["wind_speed_100m_previous_day1"], h["wind_direction_100m_previous_day1"]
        for t, s, d in zip(h["time"], ws, wd, strict=True):
            out[t[:13]] = (s, d)
        chunk = stop + timedelta(days=1)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--tso-only", action="store_true", help="write only the TSO benchmark")
    args = ap.parse_args()
    end = date.today() - timedelta(days=10)  # settlement data lags ~1 week

    if args.tso_only:
        tso = fetch_tso(START, end)
        print(f"{len(tso)} TSO day-ahead hours {min(tso)} … {max(tso)}")
        if not args.dry_run:
            with gzip.open(TSO_OUT, "wt", newline="", encoding="utf-8") as f:
                w = csv.writer(f)
                w.writerow(["time_utc", "tso_dayahead_mw"])
                w.writerows([h + ":00Z", round(v, 3)] for h, v in sorted(tso.items()))
            print(f"wrote {TSO_OUT} ({TSO_OUT.stat().st_size / 1e3:.0f} kB)")
        return 0

    power = fetch_power(START, end)
    nwp = {
        (m, s): fetch_nwp(model, lat, lon, START, end)
        for m, model in MODELS.items()
        for s, (lat, lon) in SITES.items()
    }
    cols = [f"{m}_{s}_{v}" for (m, s) in nwp for v in ("ws", "wd")]
    rows = []
    for hour in sorted(power):
        vals = [x for key in nwp for x in nwp[key].get(hour, (None, None))]
        if any(v is None for v in vals):
            continue
        rows.append([hour + ":00Z", round(power[hour], 3), *vals])

    p = [r[1] for r in rows]
    print(f"{len(rows)} hours {rows[0][0]} … {rows[-1][0]}, power max {max(p):.0f} MW,")
    print(f"mean {sum(p) / len(p):.0f} MW (of {len(power)} metered hours)")
    if args.dry_run:
        return 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(OUT, "wt", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["time_utc", "power_mw", *cols])
        w.writerows(rows)
    print(f"wrote {OUT} ({OUT.stat().st_size / 1e3:.0f} kB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
