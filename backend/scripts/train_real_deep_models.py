"""Train the LSTM and TFT on the real DK2 day-ahead set and store their test-fold scores.

    cd backend && python scripts/train_real_deep_models.py

Deep sequence models take tens of minutes on a CPU, too long for a request, so they are
trained here (once, after fetch_real_forecast_data.py) and their scores are written to
app/services/p4/data/dk2_deep_models.json, which ``real_data.evaluate_real_dayahead``
adds to the XGBoost / baseline table.

Same data, same features, same 5-fold TimeSeriesSplit blocks as XGBoost (shifted by the
24 h lookback: a sequence of 24 hourly NWP rows predicts its last hour). Early stopping
watches the newest 20 % of each training block, never the test fold.
"""

from __future__ import annotations

import json
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
from sklearn.model_selection import TimeSeriesSplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.p4.lstm_model import LSTMConfig, train_lstm
from app.services.p4.real_data import (
    CAPACITY_MW,
    DATA_FILE,
    N_SPLITS,
    build_features,
    load_dataset,
    persistence_24h,
)
from app.services.p4.tft_model import TFTConfig, train_tft

OUT = DATA_FILE.parent / "dk2_deep_models.json"
LOOKBACK_H = 24


def main() -> int:
    ds = load_dataset()
    x_all, _ = build_features(ds)
    pers_all = persistence_24h(ds)
    ok = ~np.isnan(pers_all)
    x, y, pers = x_all[ok], ds.power_mw[ok], pers_all[ok]

    # persistence MSE on exactly the hours each deep-model test fold scores
    n_seq = len(y) - LOOKBACK_H + 1
    blocks = [
        test + LOOKBACK_H - 1 for _, test in TimeSeriesSplit(N_SPLITS).split(np.arange(n_seq))
    ]
    pers_mse = float(np.mean(np.concatenate([(y[b] - pers[b]) ** 2 for b in blocks])))

    out: dict[str, object] = {
        "trained_utc": datetime.now(UTC).strftime("%Y-%m-%dT%H:%MZ"),
        "lookback_h": LOOKBACK_H,
        "models": [],
    }
    runs = (
        (
            "LSTM",
            lambda: train_lstm(x, y, LSTMConfig(lookback=LOOKBACK_H, epochs=60, mc_samples=1)),
        ),
        ("TFT (P50)", lambda: train_tft(x, y, TFTConfig(lookback=LOOKBACK_H, epochs=60))),
    )
    for name, run in runs:
        t0 = time.perf_counter()
        cv = run()[0]
        rmse = np.array([f.rmse_mw for f in cv.fold_metrics])
        mae = np.array([f.mae_mw for f in cv.fold_metrics])
        mse = float(np.mean(rmse**2))  # equal-size folds → pooled MSE
        entry = {
            "name": name,
            "nrmse_pct": round(100 * float(np.sqrt(mse)) / CAPACITY_MW, 2),
            "nmae_pct": round(100 * float(mae.mean()) / CAPACITY_MW, 2),
            "bias_pct": None,
            "skill_vs_persistence": round(1 - mse / pers_mse, 3),
            "fold_nrmse_pct": [round(100 * float(r) / CAPACITY_MW, 2) for r in rmse],
            "train_minutes": round((time.perf_counter() - t0) / 60, 1),
        }
        out["models"].append(entry)  # type: ignore[attr-defined]
        print(entry, flush=True)

    OUT.write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
