"""Real-data validation of the digital twin's detector on CARE to Compare, Wind Farm B.

The live twin runs on simulated SCADA (SB-510 is not built). This module answers "does
the detector find real faults?" on the CARE to Compare benchmark (Gück et al. 2024):
real 10-minute SCADA of an offshore wind farm in Germany (Wind Farm B, anonymised),
15 data sets — 6 end in a recorded fault (3 × high temperature, 2 × rotor bearing
damage, 1 × main bearing damage), 9 are normal operation.

Method — the twin's state detection, unchanged
-----------------------------------------------
1. Normal-behaviour model (NBM) per temperature channel: gradient-boosted trees learn
   the channel from the operating point (active power, wind, ambient temperature, rotor
   speed, 1 h and 6 h mean power for thermal lag) on the training year, normal
   production only (status 0). A data-driven NBM replaces the physics twin because the
   turbines are anonymised; the residual r = T_meas − T_NBM is what the twin charts.
   (Tautz-Weinert & Watson 2017, IET Renew. Power Gener. 11(4) — NBM for SCADA CM.)
2. Phase I (Montgomery): Phase I data must cover every operating condition, so the
   training year is cut into 4 time blocks and each is scored by an NBM fitted on the
   other three; these out-of-block residuals (all seasons) give the mean / σ per
   active-power decile and the autocorrelation factor κ (EWMAST, Zhang 1998). The NBM
   that charts the prediction period is then fitted on the whole year. (v1 calibrated
   on the newest 20 % only — one season — and alarmed in 6 of 9 normal periods of
   Wind Farm B; v2 was designed on Farm B and tested untouched on Farm C.)
3. EWMA chart with the live twin's own settings — λ, L, persistence imported from
   ``detection`` — so nothing is tuned on the benchmark's fault labels.
4. Phase I verification: the training year is normal by definition, so each channel's
   limit is widened until its out-of-block chart raises no confirmed alarm (the live
   twin checks its L = 5 the same way on fault-free data). Training data only.
5. Turbine alarm = first channel beyond its limit for ``PERSISTENCE`` samples.

Scores (CARE terms, simplified): an anomaly event is *detected* if an alarm is
confirmed inside its window before the fault (event end); a normal event with any
confirmed alarm is a *false alarm*; warning time = event end − first alarm.

Data: CARE to Compare v6, Zenodo 10.5281/zenodo.14006163, CC BY-SA 4.0 — results built
by ``scripts/build_care_benchmark.py`` and bundled in ``data/care_farm_b.json``.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any, Literal

import numpy as np
import xgboost as xgb
from numpy.typing import NDArray

from app.services.digital_twin.detection import (
    EWMA_LAMBDA,
    PERSISTENCE,
    _pooled_acf,
    ewma_limit,
    health_from_u,
)

FloatArray = NDArray[np.float64]
RESULT_FILE = Path(__file__).parent / "data" / "care_farm_b.json"
CALIBRATION_SHARE = 0.2
OOF_BLOCKS = 4  # Phase I: each quarter of the year scored by a model of the other three
POWER_BINS = 10
SAMPLES_PER_HOUR = 6


@dataclass(frozen=True)
class ChannelChart:
    first_alarm: int | None  # index into the prediction rows
    health: FloatArray  # 0–100 per prediction row (NaN where not valid)
    residual: FloatArray  # T_meas − T_NBM [K]
    limit_factor: float  # Phase I widening of the twin's limit (≥ 1)
    first_alarm_live_limit: int | None  # same chart without the widening


def thermal_inputs(power: FloatArray, *operating: FloatArray) -> FloatArray:
    """Operating point + 1 h / 6 h mean power (a bearing heats with a lag of hours)."""

    def mean(n: int) -> FloatArray:
        c = np.cumsum(np.insert(np.nan_to_num(power), 0, 0.0))
        out = np.empty_like(power)
        idx = np.arange(len(power))
        lo = np.maximum(0, idx - n + 1)
        out[:] = (c[idx + 1] - c[lo]) / (idx - lo + 1)
        return out

    return np.column_stack([power, *operating, mean(SAMPLES_PER_HOUR), mean(6 * SAMPLES_PER_HOUR)])


def chart_channel(
    x: FloatArray,
    y: FloatArray,
    valid: NDArray[np.bool_],
    train: NDArray[np.bool_],
    power: FloatArray,
    seed: int = 0,
    calibration: Literal["newest", "oof"] = "oof",
) -> ChannelChart:
    """NBM + Phase I + EWMA chart for one channel; returns the prediction-period chart."""
    train_rows = np.flatnonzero(train & valid & np.isfinite(y))

    def nbm() -> xgb.XGBRegressor:
        return xgb.XGBRegressor(
            n_estimators=150, max_depth=4, learning_rate=0.1, random_state=seed, n_jobs=4
        )

    if calibration == "newest":  # v1: the newest 20 % only — one season
        n_fit = int(len(train_rows) * (1 - CALIBRATION_SHARE))
        fit, cal = train_rows[:n_fit], train_rows[n_fit:]
        model = nbm()
        model.fit(x[fit], y[fit])
        resid_cal = y[cal] - model.predict(x[cal])
    else:  # v2: out-of-block residuals over the whole year — every season
        cal = train_rows
        parts = np.array_split(train_rows, OOF_BLOCKS)
        resid_parts = []
        for k, block in enumerate(parts):
            others = np.concatenate([b for j, b in enumerate(parts) if j != k])
            m = nbm()
            m.fit(x[others], y[others])
            resid_parts.append(y[block] - m.predict(x[block]))
        resid_cal = np.concatenate(resid_parts)
        model = nbm()
        model.fit(x[train_rows], y[train_rows])

    pred_rows = np.flatnonzero(~train)
    resid = y[pred_rows] - model.predict(x[pred_rows])
    ok = valid[pred_rows] & np.isfinite(resid)

    # Phase I: μ, σ per active-power decile (residual scatter is heteroscedastic)
    edges = np.quantile(power[cal], np.linspace(0, 1, POWER_BINS + 1)[1:-1])
    b_cal, b_pred = np.digitize(power[cal], edges), np.digitize(power[pred_rows], edges)
    mu = np.array([resid_cal[b_cal == b].mean() for b in range(POWER_BINS)])
    sd = np.array([resid_cal[b_cal == b].std() for b in range(POWER_BINS)])
    sd = np.maximum(sd, 0.1)  # floor: 0.1 K sensor resolution
    z_cal = (resid_cal - mu[b_cal]) / sd[b_cal]
    rho = _pooled_acf(z_cal[:, None], np.ones((len(z_cal), 1), dtype=bool))
    kappa = 1.0 + 2.0 * float(np.sum((1.0 - EWMA_LAMBDA) ** np.arange(1, len(rho) + 1) * rho))

    # Phase I verification (as the live twin's L = 5 check on fault-free data): the
    # calibration slice is normal by definition, so the limit is widened until it
    # raises no confirmed alarm there. Uses training data only — no fault labels.
    widen = max(1.0, _worst_run(_ewma_u(z_cal, np.ones(len(z_cal), dtype=bool), kappa)))
    u = _ewma_u((resid - mu[b_pred]) / sd[b_pred], ok, kappa) / widen
    first = _first_alarm(u)
    first_live = _first_alarm(u * widen)  # the live twin's limit, for comparison
    health = np.where(np.isfinite(u), health_from_u(np.nan_to_num(u)), np.nan)
    return ChannelChart(first, health, np.where(ok, resid, np.nan), widen, first_live)


def _ewma_u(z: FloatArray, ok: NDArray[np.bool_], kappa: float) -> FloatArray:
    """|EWMA| / exact limit (twin settings, EWMAST-widened); NaN where not valid."""
    limit = ewma_limit(np.cumsum(ok).astype(np.float64)) * np.sqrt(max(kappa, 1.0))
    e = 0.0
    u = np.full(len(z), np.nan)
    for k in np.flatnonzero(ok):  # invalid samples hold the chart (IEC 61400-25 validity)
        e = EWMA_LAMBDA * z[k] + (1 - EWMA_LAMBDA) * e
        u[k] = abs(e) / limit[k]
    return u


def _worst_run(u: FloatArray) -> float:
    """Largest level held for ``PERSISTENCE`` consecutive valid samples."""
    v = u[np.isfinite(u)]
    if len(v) < PERSISTENCE:
        return 0.0
    win = np.lib.stride_tricks.sliding_window_view(v, PERSISTENCE)
    return float(win.min(axis=1).max())


def _first_alarm(u: FloatArray) -> int | None:
    """Index where u ≥ 1 has held for ``PERSISTENCE`` consecutive valid samples."""
    run = 0
    for k in np.flatnonzero(np.isfinite(u)):
        run = run + 1 if u[k] >= 1.0 else 0
        if run >= PERSISTENCE:
            return int(k)
    return None


def available_farms() -> list[str]:
    """Farms with a bundled result: 'b' (development set), 'c' (held-out test set)."""
    return sorted(
        f.stem.removeprefix("care_farm_") for f in RESULT_FILE.parent.glob("care_farm_*.json")
    )


@cache
def load_results(farm: str = "b") -> dict[str, Any]:
    """Bundled benchmark result (built offline from the CSVs by build_care_benchmark.py)."""
    path = RESULT_FILE.with_name(f"care_farm_{farm}.json")
    data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    return data
