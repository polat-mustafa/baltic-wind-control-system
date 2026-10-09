"""Run the digital twin's detector on CARE to Compare Wind Farm B and bundle the result.

    cd backend && python scripts/build_care_benchmark.py <dir with "Wind Farm B">

Get the data (CC BY-SA 4.0, Zenodo 10.5281/zenodo.14006163, 5.5 GB zip): only the
"Wind Farm B.zip" member (396 MB) is needed — the script prints the byte range to
download with ``curl -r`` if run with ``--range``. Writes
app/services/digital_twin/data/care_farm_b.json (~50 kB): per event the verdict,
warning time, the channel that alarmed first and daily health / residual series.
"""

from __future__ import annotations

import argparse
import io
import json
import struct
import sys
import time
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.digital_twin.care_benchmark import (
    RESULT_FILE,
    SAMPLES_PER_HOUR,
    chart_channel,
    thermal_inputs,
)
from app.services.digital_twin.detection import (
    EWMA_L,
    EWMA_LAMBDA,
    PERSISTENCE,
)

ZIP_URL = "https://zenodo.org/api/records/14006163/files/CARE_To_Compare.zip/content"
#: operating-point inputs, found by their sensor description (names differ per farm)
INPUTS = {  # priority order: Farm B's name first, then Farm C's
    "power": ("active power", "active power hv grid"),
    "wind": ("wind speed", "wind speed 1+2"),
    "ambient": ("outside temperature", "ambient temperature"),
    "rotor": ("rotor speed", "rotor speed 1"),
}


def resolve_inputs(feats: pd.DataFrame) -> dict[str, str]:
    """Role → '<sensor>_avg' column by exact description, in priority order (no guessing)."""
    desc = feats.description.str.strip().str.lower()
    out = {}
    for role, names in INPUTS.items():
        name = next((n for n in names if (desc == n).any()), None)
        if name is None:
            raise SystemExit(f"no {role} sensor ({names}) in feature_description.csv")
        out[role] = f"{feats.sensor_name[desc == name].iloc[0]}_avg"
    return out


SAMPLES_PER_DAY = 24 * SAMPLES_PER_HOUR


def print_range() -> None:
    """Byte range of 'Wind Farm B.zip' (stored, not deflated) inside the outer zip."""
    with urllib.request.urlopen(urllib.request.Request(ZIP_URL, method="HEAD")) as r:
        size, url = int(r.headers["Content-Length"]), r.url

    def get(a: int, b: int) -> bytes:
        req = urllib.request.Request(url, headers={"Range": f"bytes={a}-{b}"})
        with urllib.request.urlopen(req) as r:
            return bytes(r.read())

    tail = get(size - 65_536, size - 1)
    outer = zipfile.ZipFile(io.BytesIO(b"\0" * (size - 65_536) + tail))  # central dir only
    info = outer.getinfo("Wind Farm B.zip")
    head = get(info.header_offset, info.header_offset + 29)
    n, m = struct.unpack("<HH", head[26:30])
    start = info.header_offset + 30 + n + m
    print(f'curl -L -r {start}-{start + info.file_size - 1} -o farm_b.zip "{ZIP_URL}"')


def daily(values: np.ndarray, how: str) -> list[float | None]:
    out: list[float | None] = []
    for d in range(0, len(values), SAMPLES_PER_DAY):
        chunk = values[d : d + SAMPLES_PER_DAY]
        chunk = chunk[np.isfinite(chunk)]
        out.append(round(float(getattr(np, how)(chunk)), 2) if chunk.size else None)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("root", nargs="?", type=Path)
    ap.add_argument("--range", action="store_true", help="print the curl command and stop")
    ap.add_argument("--farm", default="B", choices=["B", "C"])
    args = ap.parse_args()
    if args.range:
        print_range()
        return 0
    farm = args.root / f"Wind Farm {args.farm}"
    result_file = RESULT_FILE.with_name(f"care_farm_{args.farm.lower()}.json")
    info = pd.read_csv(farm / "event_info.csv", sep=";")
    feats = pd.read_csv(farm / "feature_description.csv", sep=";", encoding="latin-1")
    cols = resolve_inputs(feats)
    print("inputs:", cols, flush=True)
    temps = feats[
        feats.description.str.contains("temperature", case=False)
        & (feats.sensor_name + "_avg" != cols["ambient"])
    ]
    channels = {f"{r.sensor_name}_avg": r.description.strip() for r in temps.itertuples()}

    events = []
    for ev in info.sort_values("event_id").itertuples():
        t0 = time.perf_counter()
        d = pd.read_csv(farm / "datasets" / f"{ev.event_id}.csv", sep=";").sort_values("id")
        train = (d.train_test == "train").to_numpy()
        valid = (d.status_type_id == 0).to_numpy()
        power = d[cols["power"]].to_numpy(float)
        x = thermal_inputs(
            power, *(d[cols[r]].to_numpy(float) for r in ("wind", "ambient", "rotor"))
        )
        ids = d.id.to_numpy()[~train]

        first: dict[str, int] = {}
        first_live: dict[str, int] = {}
        factors: list[float] = []
        health, resid = {}, {}
        for col, desc in channels.items():
            if col not in d or d[col].isna().all():
                continue
            ch = chart_channel(
                x, d[col].to_numpy(float), valid, train, power, seed=int(ev.event_id)
            )
            health[desc], resid[desc] = ch.health, ch.residual
            factors.append(ch.limit_factor)
            if ch.first_alarm is not None:
                first[desc] = ch.first_alarm
            if ch.first_alarm_live_limit is not None:
                first_live[desc] = ch.first_alarm_live_limit

        in_window = {
            k: v for k, v in first.items() if ev.event_start_id <= ids[v] <= ev.event_end_id
        }
        lead = min(in_window, key=in_window.__getitem__) if in_window else None
        window = (ev.event_start_id, ev.event_end_id)
        live_alarm = any(window[0] <= ids[v] <= window[1] for v in first_live.values())
        with np.errstate(all="ignore"):  # days with no valid sample stay NaN
            hi = np.nanmin(np.vstack(list(health.values())), axis=0)
        start = int(np.searchsorted(ids, ev.event_start_id))
        end = int(np.searchsorted(ids, ev.event_end_id))
        rec = {
            "event_id": int(ev.event_id),
            "label": ev.event_label,
            "description": ev.event_description if isinstance(ev.event_description, str) else "",
            "window_days": round((end - start) / SAMPLES_PER_DAY, 1),
            "prediction_days": round(len(ids) / SAMPLES_PER_DAY, 1),
            "channels_charted": len(health),
            "median_limit_factor": round(float(np.median(factors)), 2),
            "alarm_at_live_limit": live_alarm,
            "alarm": lead is not None,
            "first_channel": lead,
            "first_alarm_day": round((in_window[lead] - start) / SAMPLES_PER_DAY, 1)
            if lead
            else None,
            "warning_days": round((end - in_window[lead]) / SAMPLES_PER_DAY, 1) if lead else None,
            "channels_in_alarm": sorted(in_window, key=in_window.__getitem__),
            "daily_health_min": daily(hi, "min"),
            "daily_residual_k": daily(resid[lead], "mean") if lead else None,
        }
        events.append(rec)
        print(
            f"{ev.event_id:>3} {ev.event_label:<8} alarm={rec['alarm']!s:<5} "
            f"warn={rec['warning_days']} d via {lead}  ({time.perf_counter() - t0:.0f} s)",
            flush=True,
        )

    anomalies = [e for e in events if e["label"] == "anomaly"]
    normals = [e for e in events if e["label"] == "normal"]
    warn = [e["warning_days"] for e in anomalies if e["alarm"]]
    out = {
        "farm": args.farm,
        "role": "development set (method designed here)"
        if args.farm == "B"
        else "held-out test set (method fixed on Farm B, run once)",
        "source": f"CARE to Compare v6 (Gück et al. 2024), Wind Farm {args.farm} — offshore, "
        "Germany, anonymised; Zenodo 10.5281/zenodo.14006163, CC BY-SA 4.0",
        "settings": {
            "ewma_lambda": EWMA_LAMBDA,
            "ewma_L": EWMA_L,
            "persistence_samples": PERSISTENCE,
            "nbm": "XGBoost 150 trees depth 4 on power, wind, ambient T, rotor speed, "
            "1 h / 6 h mean power; status 0 only",
            "calibration": "v2: out-of-block residuals over the whole training year (4 time "
            "blocks), per active-power decile; limit widened until that year has no "
            "confirmed alarm",
        },
        "summary": {
            "anomaly_events": len(anomalies),
            "detected": sum(e["alarm"] for e in anomalies),
            "normal_events": len(normals),
            "false_alarms": sum(e["alarm"] for e in normals),
            "median_warning_days": round(float(np.median(warn)), 1) if warn else None,
        },
        # the same charts at the live twin's limit, before the Phase I widening
        "summary_live_limit": {
            "detected": sum(e["alarm_at_live_limit"] for e in anomalies),
            "false_alarms": sum(e["alarm_at_live_limit"] for e in normals),
        },
        "events": events,
    }
    if args.farm == "B":  # v1 (newest-20 % calibration) result on the same farm, for the record
        out["summary_v1"] = {"detected": 5, "false_alarms": 6, "median_warning_days": 25.1}
    result_file.parent.mkdir(parents=True, exist_ok=True)
    result_file.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(out["summary"], f"-> {result_file}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
