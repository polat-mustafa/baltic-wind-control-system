"""Per-farm real production of the German Baltic offshore farms (ENTSO-E) + day-old NWP.

    set ENTSOE_API_TOKEN=<your token>        (PowerShell: $env:ENTSOE_API_TOKEN = "...")
    cd backend && python scripts/fetch_entsoe_units.py

ENTSO-E Transparency Platform, "Actual Generation per Generation Unit" (16.1.A,
documentType A73, processType A16), psrType B18 = wind offshore, control area 50Hertz
(10YDE-VE-------2). Every 50Hertz offshore unit ≥ 100 MW is in the Baltic Sea:
Baltic 2, Wikinger, Arkona, Baltic Eagle, Arcadis Ost 1. The API serves one day per
request, so ~850 requests (limit 400 / min).

Per farm writes app/services/p4/data/entsoe_<key>.csv.gz in the same format as the DK2
set (hourly power_mw + ECMWF / ICON previous-day 100 m wind at the farm), plus
entsoe_units.json listing them for ``real_data.SITES``. Terms: ENTSO-E data may be
re-used with attribution (Transparency Platform terms and conditions).
"""

from __future__ import annotations

import csv
import gzip
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fetch_real_forecast_data import MODELS, START, fetch_nwp

API = "https://web-api.tp.entsoe.eu/api"
CONTROL_AREA_50HZ = "10YDE-VE-------2"
OUT = Path(__file__).resolve().parents[1] / "app/services/p4/data"

#: name pattern → (key, title, installed MW, farm centre lat, lon). Centres are rounded
#: to ~0.05° (5 km), well inside one 0.25° NWP cell.
FARMS: list[tuple[str, str, str, float, float, float]] = [
    (r"baltic\s*2", "baltic2", "Baltic 2 (80 × SWT-3.6-120)", 288.0, 54.97, 13.17),
    (r"wikinger", "wikinger", "Wikinger (70 × AD 5-135)", 350.0, 54.83, 14.07),
    (r"arkona", "arkona", "Arkona (60 × SWT-6.0-154)", 385.0, 54.78, 14.12),
    (r"eagle", "baltic_eagle", "Baltic Eagle (50 × V174-9.5)", 476.0, 54.85, 14.20),
    (r"arcadis", "arcadis_ost1", "Arcadis Ost 1 (27 × V174-9.5)", 257.0, 54.83, 13.63),
]


def parse_a73(xml: bytes) -> dict[str, dict[str, float]]:
    """{unit name: {ISO hour: mean MW}} from one A73 GL_MarketDocument."""
    root = ET.fromstring(xml)
    sums: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    for ts in root.iterfind("{*}TimeSeries"):
        name = ts.findtext("{*}MktPSRType/{*}PowerSystemResources/{*}name") or "?"
        for period in ts.iterfind("{*}Period"):
            start = datetime.strptime(
                period.findtext("{*}timeInterval/{*}start") or "", "%Y-%m-%dT%H:%MZ"
            ).replace(tzinfo=UTC)
            end = datetime.strptime(
                period.findtext("{*}timeInterval/{*}end") or "", "%Y-%m-%dT%H:%MZ"
            ).replace(tzinfo=UTC)
            minutes = int(re.findall(r"\d+", period.findtext("{*}resolution") or "PT60M")[0])
            n = int((end - start).total_seconds() // 60 // minutes)
            pts = {
                int(p.findtext("{*}position") or 0): float(p.findtext("{*}quantity") or "nan")
                for p in period.iterfind("{*}Point")
            }
            value = float("nan")
            for pos in range(1, n + 1):  # curve type A03: a missing position repeats the last
                value = pts.get(pos, value)
                t = start + timedelta(minutes=minutes * (pos - 1))
                sums[name][t.strftime("%Y-%m-%dT%H")].append(value)
    return {u: {h: sum(v) / len(v) for h, v in hours.items()} for u, hours in sums.items()}


def fetch_day(token: str, day: date) -> bytes:
    q = {
        "securityToken": token,
        "documentType": "A73",
        "processType": "A16",
        "psrType": "B18",
        "in_Domain": CONTROL_AREA_50HZ,
        "periodStart": day.strftime("%Y%m%d0000"),
        "periodEnd": (day + timedelta(days=1)).strftime("%Y%m%d0000"),
    }
    for attempt in range(5):
        try:
            with urllib.request.urlopen(f"{API}?{urllib.parse.urlencode(q)}", timeout=120) as r:
                return bytes(r.read())
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                raise SystemExit(
                    "ENTSO-E refused the token (401/403): check ENTSOE_API_TOKEN"
                ) from e
            if e.code == 400:
                return b""  # no data for that day
            time.sleep(2 * (attempt + 1))
    return b""


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]  # Windows console
    token = os.environ.get("ENTSOE_API_TOKEN", "").strip()
    if not token:
        print(__doc__)
        return 1
    end = date.today() - timedelta(days=5)
    power: dict[str, dict[str, float]] = defaultdict(dict)
    day = START
    while day <= end:
        xml = fetch_day(token, day)
        for unit, hours in (parse_a73(xml) if xml else {}).items():
            power[unit].update(hours)
        if day.day == 1:
            print(day, sorted(power), flush=True)
        day += timedelta(days=1)
        time.sleep(0.16)  # ≤ 400 requests per minute

    manifest = []
    for unit, hours in sorted(power.items()):
        match = next((f for f in FARMS if re.search(f[0], unit, re.IGNORECASE)), None)
        if match is None:
            print(f"skip unknown unit {unit!r}")
            continue
        _, key, title, cap, lat, lon = match
        nwp = {m: fetch_nwp(model, lat, lon, START, end) for m, model in MODELS.items()}
        rows = []
        for hour in sorted(hours):
            vals = [x for m in nwp for x in nwp[m].get(hour, (None, None))]
            p = hours[hour]
            if p != p or any(v is None for v in vals):  # NaN power or missing NWP
                continue
            rows.append([hour + ":00Z", round(max(p, 0.0), 3), *vals])
        path = OUT / f"entsoe_{key}.csv.gz"
        with gzip.open(path, "wt", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(
                ["time_utc", "power_mw", *[f"{m}_site_{v}" for m in nwp for v in ("ws", "wd")]]
            )
            w.writerows(rows)
        p_max = max(r[1] for r in rows)
        print(f"{key}: {len(rows)} h, max {p_max:.0f} MW of {cap:.0f} MW installed ({unit})")
        manifest.append(
            {"key": key, "title": title, "capacity_mw": cap, "entsoe_name": unit, "file": path.name}
        )
    (OUT / "entsoe_units.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
