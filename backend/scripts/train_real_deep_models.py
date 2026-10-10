"""Train the LSTM and TFT on the real DK2 day-ahead set and store their test-fold forecasts.

    cd backend && python scripts/train_real_deep_models.py

Deep sequence models take ~15 min on a CPU, too long for a request, so they are trained
here (once, after fetch_real_forecast_data.py). Their out-of-fold forecasts are written per
hour to app/services/p4/data/dk2_deep_predictions.csv.gz; ``real_data.evaluate_real_dayahead``
scores them on the same hours as XGBoost and the baselines and builds the ensemble.

Same data, same features, same 5-fold TimeSeriesSplit as XGBoost (on sequences: a window of
24 hourly NWP rows predicts its last hour). Early stopping watches the newest 20 % of each
training block, never the test fold. The TFT learns the same nine quantiles (P10 … P90).
"""

from __future__ import annotations

import csv
import gzip
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.p4.lstm_model import LSTMConfig, train_lstm
from app.services.p4.real_data import DEEP_FILE, QUANTILES, build_features, load_dataset
from app.services.p4.tft_model import TFTConfig, train_tft

LOOKBACK_H = 24


def main() -> int:
    ds = load_dataset()
    x, _ = build_features(ds)
    y = ds.power_mw
    hours = [str(t) + ":00Z" for t in ds.time_utc]
    cols: dict[str, dict[int, float]] = {}
    for name, run in (
        (
            "lstm",
            lambda: train_lstm(x, y, LSTMConfig(lookback=LOOKBACK_H, epochs=60, mc_samples=1)),
        ),
        (
            "tft",
            lambda: train_tft(x, y, TFTConfig(lookback=LOOKBACK_H, epochs=60, quantiles=QUANTILES)),
        ),
    ):
        t0 = time.perf_counter()
        cv = run()[0]
        labels = ["p50"] if name == "lstm" else [f"q{round(100 * q)}" for q in QUANTILES]
        for j, label in enumerate(labels):
            cols[f"{name}_{label}_mw"] = {
                i + LOOKBACK_H - 1: row[j]
                for i, row in zip(cv.test_index, cv.test_pred_mw, strict=True)
            }
        print(f"{name}: {(time.perf_counter() - t0) / 60:.1f} min", flush=True)

    rows = sorted(cols["lstm_p50_mw"].keys() & cols["tft_q50_mw"].keys())
    with gzip.open(DEEP_FILE, "wt", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["time_utc", *cols])
        w.writerows([hours[r], *(round(c[r], 2) for c in cols.values())] for r in rows)
    print(f"wrote {DEEP_FILE} ({len(rows)} hours)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
