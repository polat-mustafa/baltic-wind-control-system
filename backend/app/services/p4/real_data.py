"""
Day-ahead wind power forecast trained on REAL data: Baltic offshore production + archived NWP.

The other P4 modules train on synthetic SCADA (SB-510 is a case study, not a built farm).
This one answers "does the method work on real data?" with measured output of the three
Danish Baltic offshore farms in price area DK2 — Kriegers Flak 604.8 MW, Rødsand II 207 MW,
Nysted 165.6 MW = 977.4 MW — and the wind the ECMWF IFS and DWD ICON runs of the
previous day predicted for each hour (see ``scripts/fetch_real_forecast_data.py``).

Framing — day-ahead, as a farm bids it
---------------------------------------
The bid for day D closes at 12:00 on D−1, so the only wind known for hour t is a forecast
24–47 h old (Open-Meteo ``previous_day1``). Measured power is not a feature: at the bid
it is 13–36 h old and nearly useless. Baselines a model must beat:

  - persistence (24 h):  P̂(t) = P(t − 24 h)          — the TSO textbook baseline
  - climatology:         P̂(t) = mean P (training)   — what you know with no forecast
  - NWP power curve:     P̂(t) = mean P in the 1 m/s bin of the mean NWP wind — the
                         physics-only forecast (farm power curve learnt from data)

Score: nRMSE = RMSE / installed capacity [%] (the TSO convention, e.g. ENTSO-E), and the
skill score vs persistence SS = 1 − MSE_model / MSE_persistence.

Validation: 5-fold ``TimeSeriesSplit`` (domain rule 6) — every fold trains on the past
and is tested on the next block, never shuffled. The P10–P90 band is conformalised
(CQR) on the newest 20 % of each training block, so it covers ~80 % out of sample.
Output is clipped to 0 ≤ P ≤ capacity
(``enforce_physical_constraints``; rule 1 at farm level).

References
----------
- Energinet Energi Data Service, ProductionConsumptionSettlement (CC BY 4.0)
- Open-Meteo Previous Runs API: ECMWF IFS 0.25°, DWD ICON (CC BY 4.0)
- Giebel et al. (2011) "The state of the art in short-term prediction of wind power",
  ANEMOS.plus — day-ahead nRMSE typically 10–20 % of capacity
- Romano, Patterson & Candès (2019) "Conformalized quantile regression", NeurIPS
- Hong et al. (2016) GEFCom2014 probabilistic wind track (quantile / pinball loss)
"""

from __future__ import annotations

import csv
import gzip
import json
from dataclasses import dataclass
from functools import cache
from pathlib import Path

import numpy as np
import xgboost as xgb
from numpy.typing import NDArray
from sklearn.model_selection import TimeSeriesSplit

from app.services.p4.physical_constraints import enforce_physical_constraints

DATA_FILE = Path(__file__).parent / "data" / "dk2_offshore_dayahead.csv.gz"
# LSTM / TFT scores, trained offline (scripts/train_real_deep_models.py: tens of minutes)
DEEP_FILE = Path(__file__).parent / "data" / "dk2_deep_models.json"
CAPACITY_MW = 604.8 + 207.0 + 165.6  # Kriegers Flak + Rødsand II + Nysted
FARMS = ("Kriegers Flak 604.8 MW", "Rødsand II 207 MW", "Nysted 165.6 MW")
QUANTILES = (0.1, 0.5, 0.9)
N_SPLITS = 5
SERIES_HOURS = 14 * 24  # last two weeks of the last test fold, for the chart
WS_BIN_MS = 1.0
CALIBRATION_SHARE = 0.2  # newest part of each training block, for the band


ENTSOE_MANIFEST = Path(__file__).parent / "data" / "entsoe_units.json"
DK2_PRODUCTION = (
    "Energinet Energi Data Service — ProductionConsumptionSettlement, "
    "DK2 OffshoreWindGe100MW_MWh (CC BY 4.0)"
)


@dataclass(frozen=True)
class Site:
    """A real production series with its NWP: the DK2 aggregate or one ENTSO-E farm."""

    key: str
    title: str
    file: Path
    capacity_mw: float
    farms: tuple[str, ...]
    production: str
    deep_file: Path | None = None


def sites() -> dict[str, Site]:
    """DK2 always; German Baltic farms once scripts/fetch_entsoe_units.py has run."""
    out = {
        "dk2": Site(
            "dk2",
            "DK2 Baltic offshore (3 farms)",
            DATA_FILE,
            CAPACITY_MW,
            FARMS,
            DK2_PRODUCTION,
            DEEP_FILE,
        )
    }
    if ENTSOE_MANIFEST.exists():
        for u in json.loads(ENTSOE_MANIFEST.read_text(encoding="utf-8")):
            out[u["key"]] = Site(
                u["key"],
                u["title"],
                DATA_FILE.parent / u["file"],
                float(u["capacity_mw"]),
                (u["title"],),
                f"ENTSO-E Transparency Platform — Actual Generation per Generation Unit "
                f"(16.1.A), {u['entsoe_name']}",
            )
    return out


@dataclass(frozen=True)
class RealDataset:
    time_utc: NDArray[np.datetime64]
    power_mw: NDArray[np.float64]
    nwp_ws: NDArray[np.float64]  # (hours, model×site) 100 m wind [m/s]
    nwp_wd: NDArray[np.float64]  # (hours, model×site) direction [°]
    nwp_names: list[str]  # e.g. "ecmwf_kf"


@cache
def load_dataset(site: str = "dk2") -> RealDataset:
    with gzip.open(sites()[site].file, "rt", encoding="utf-8") as f:
        rows = list(csv.reader(f))
    header, body = rows[0], rows[1:]
    values = np.array([[float(x) for x in r[1:]] for r in body])
    return RealDataset(
        time_utc=np.array([r[0].rstrip("Z") for r in body], dtype="datetime64[h]"),
        power_mw=values[:, 0],
        nwp_ws=values[:, 1::2],
        nwp_wd=values[:, 2::2],
        nwp_names=[h.removesuffix("_ws") for h in header[2::2]],
    )


def build_features(ds: RealDataset) -> tuple[NDArray[np.float64], list[str]]:
    """NWP wind per model × site, direction as sin/cos, hour of day, model spread."""
    hour = ds.time_utc.astype(np.int64) % 24
    wd = np.radians(ds.nwp_wd)
    cols = [ds.nwp_ws, np.sin(wd), np.cos(wd)]
    names = [f"{n}_ws" for n in ds.nwp_names]
    names += [f"{n}_wd_sin" for n in ds.nwp_names] + [f"{n}_wd_cos" for n in ds.nwp_names]
    extra = np.column_stack(
        [
            np.sin(2 * np.pi * hour / 24),
            np.cos(2 * np.pi * hour / 24),
            ds.nwp_ws.max(axis=1) - ds.nwp_ws.min(axis=1),  # disagreement = uncertainty
        ]
    )
    names += ["hour_sin", "hour_cos", "nwp_spread_ms"]
    return np.column_stack([*cols, extra]), names


def persistence_24h(ds: RealDataset) -> NDArray[np.float64]:
    """P(t − 24 h) where that hour exists in the set, else NaN (gaps are not filled)."""
    index = {t: i for i, t in enumerate(ds.time_utc.tolist())}
    day = np.timedelta64(24, "h")
    return np.array(
        [ds.power_mw[index[t]] if (t := v - day) in index else np.nan for v in ds.time_utc]
    )


def power_curve_forecast(
    ws_train: NDArray[np.float64], p_train: NDArray[np.float64], ws_test: NDArray[np.float64]
) -> NDArray[np.float64]:
    """Farm power curve learnt from data: mean power per 1 m/s bin of the mean NWP wind."""
    bins = np.floor(ws_train / WS_BIN_MS).astype(int)
    curve = np.full(bins.max() + 2, np.nan)
    for b in np.unique(bins):
        curve[b] = p_train[bins == b].mean()
    # empty bins: carry the neighbour below (above the last bin = the last bin)
    for i in range(1, len(curve)):
        if np.isnan(curve[i]):
            curve[i] = curve[i - 1]
    out: NDArray[np.float64] = curve[
        np.clip(np.floor(ws_test / WS_BIN_MS).astype(int), 0, len(curve) - 1)
    ]
    return out


def _clip(p: NDArray[np.float64], capacity_mw: float) -> NDArray[np.float64]:
    return enforce_physical_constraints(p, None, rated_power_mw=capacity_mw).power_mw


@dataclass(frozen=True)
class ModelScore:
    name: str
    nrmse_pct: float
    nmae_pct: float
    bias_pct: float | None
    skill_vs_persistence: float
    fold_nrmse_pct: list[float]


@dataclass(frozen=True)
class RealForecastResult:
    scores: list[ModelScore]
    p10_p90_coverage_pct: float
    feature_importance: list[tuple[str, float]]
    series: dict[str, list[object]]
    period: tuple[str, str]
    hours: int


@cache
def evaluate_real_dayahead(site: str = "dk2", seed: int = 42) -> RealForecastResult:
    """Train XGBoost (P10/P50/P90) per TimeSeriesSplit fold and score it against the baselines."""
    st = sites()[site]
    cap = st.capacity_mw
    ds = load_dataset(site)
    x_all, names = build_features(ds)
    pers_all = persistence_24h(ds)
    ok = ~np.isnan(pers_all)  # first day + gaps: no persistence → not scored
    x, y, pers, ws_mean = x_all[ok], ds.power_mw[ok], pers_all[ok], ds.nwp_ws[ok].mean(axis=1)
    t = ds.time_utc[ok]

    preds: dict[str, list[NDArray[np.float64]]] = {
        "XGBoost (P50)": [],
        "NWP power curve": [],
        "Climatology": [],
        "Persistence 24 h": [],
    }
    actuals: list[NDArray[np.float64]] = []
    inside = 0
    gain: dict[str, float] = dict.fromkeys(names, 0.0)
    last: dict[str, NDArray[np.float64]] = {}
    last_t = t[:0]

    for train, test in TimeSeriesSplit(n_splits=N_SPLITS).split(x):
        model = xgb.XGBRegressor(
            objective="reg:quantileerror",
            quantile_alpha=np.array(QUANTILES),
            n_estimators=400,
            max_depth=5,
            learning_rate=0.05,
            subsample=0.8,
            random_state=seed,
            n_jobs=4,
        )
        # Conformalised quantile regression (Romano et al. 2019): fit on the older 80 %
        # of the training block, measure how far the band misses on the newest 20 %,
        # widen the test band by that margin → P10–P90 holds ~80 % out of sample. The
        # forecast itself comes from a refit on the whole block (the oldest fold is short).
        fit, cal = np.array_split(train, [int(len(train) * (1 - CALIBRATION_SHARE))])
        model.fit(x[fit], y[fit])
        q_cal = np.sort(model.predict(x[cal]), axis=1)
        miss = np.maximum(q_cal[:, 0] - y[cal], y[cal] - q_cal[:, 2])
        margin = float(np.quantile(miss, QUANTILES[2] - QUANTILES[0]))
        model.fit(x[train], y[train])  # refit on the whole block for the forecast itself
        q = np.sort(model.predict(x[test]), axis=1)  # sort: quantiles never cross
        p10, p50, p90 = (
            _clip(q[:, 0] - margin, cap),
            _clip(q[:, 1], cap),
            _clip(q[:, 2] + margin, cap),
        )
        preds["XGBoost (P50)"].append(p50)
        preds["NWP power curve"].append(
            _clip(power_curve_forecast(ws_mean[train], y[train], ws_mean[test]), cap)
        )
        preds["Climatology"].append(np.full(len(test), y[train].mean()))
        preds["Persistence 24 h"].append(pers[test])
        actuals.append(y[test])
        inside += int(np.sum((y[test] >= p10) & (y[test] <= p90)))
        for k, v in model.get_booster().get_score(importance_type="gain").items():
            gain[names[int(k[1:])] if k.startswith("f") and k[1:].isdigit() else k] += float(
                v  # type: ignore[arg-type]  # gain is a float per feature
            )
        last = {"y": y[test], "p10": p10, "p50": p50, "p90": p90, "pers": pers[test]}
        last["ws"] = ws_mean[test]
        last_t = t[test]

    def mse(a: NDArray[np.float64], b: NDArray[np.float64]) -> float:
        return float(np.mean((a - b) ** 2))

    a_all = np.concatenate(actuals)
    mse_pers = mse(a_all, np.concatenate(preds["Persistence 24 h"]))
    scores = []
    for name, folds in preds.items():
        p_all = np.concatenate(folds)
        scores.append(
            ModelScore(
                name=name,
                nrmse_pct=round(100 * float(np.sqrt(mse(a_all, p_all))) / cap, 2),
                nmae_pct=round(100 * float(np.mean(np.abs(a_all - p_all))) / cap, 2),
                bias_pct=round(100 * float(np.mean(p_all - a_all)) / cap, 2),
                skill_vs_persistence=round(1 - mse(a_all, p_all) / mse_pers, 3),
                fold_nrmse_pct=[
                    round(100 * float(np.sqrt(mse(a, p))) / cap, 2)
                    for a, p in zip(actuals, folds, strict=True)
                ],
            )
        )

    if st.deep_file is not None and st.deep_file.exists():
        deep = json.loads(st.deep_file.read_text(encoding="utf-8"))["models"]
        scores[1:1] = [
            ModelScore(**{k: m[k] for k in ModelScore.__dataclass_fields__}) for m in deep
        ]

    total_gain = sum(gain.values()) or 1.0
    importance = sorted(
        ((k, round(v / total_gain, 4)) for k, v in gain.items()), key=lambda kv: -kv[1]
    )
    n = SERIES_HOURS
    series = {
        "time_utc": [str(v) + ":00Z" for v in last_t[-n:]],
        "actual_mw": np.round(last["y"][-n:], 1).tolist(),
        "p10_mw": np.round(last["p10"][-n:], 1).tolist(),
        "p50_mw": np.round(last["p50"][-n:], 1).tolist(),
        "p90_mw": np.round(last["p90"][-n:], 1).tolist(),
        "persistence_mw": np.round(last["pers"][-n:], 1).tolist(),
        "nwp_wind_ms": np.round(last["ws"][-n:], 2).tolist(),
    }
    return RealForecastResult(
        scores=scores,
        p10_p90_coverage_pct=round(100 * inside / len(a_all), 1),
        feature_importance=importance[:10],
        series=series,
        period=(str(ds.time_utc[0]) + ":00Z", str(ds.time_utc[-1]) + ":00Z"),
        hours=len(ds.time_utc),
    )
