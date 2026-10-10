"""
Day-ahead wind power forecast trained and scored on REAL data: Baltic offshore production +
archived NWP. P4 has no synthetic data path — every number on the Forecast page comes from here.

Data: measured output of the three Danish Baltic offshore farms in price area DK2 — Kriegers
Flak 604.8 MW, Rødsand II 207 MW, Nysted 165.6 MW = 977.4 MW — (or one farm from ENTSO-E)
and the wind the ECMWF IFS and DWD ICON runs of the previous day predicted for each hour
(``scripts/fetch_real_forecast_data.py``).

Framing — day-ahead, as a farm bids it
---------------------------------------
The bid for day D closes at 12:00 on D−1, so the only wind known for hour t is a forecast
24–47 h old (Open-Meteo ``previous_day1``). Measured power is not a feature: at the bid
it is 13–36 h old and nearly useless. Forecasts scored:

  - XGBoost, nine quantiles P10 … P90 (conformalised, see below)
  - LSTM, and TFT with the same nine quantiles, trained offline
    (``scripts/train_real_deep_models.py``)
  - ensemble of the XGBoost / LSTM / TFT P50, weights 1/MSE on the earlier test folds only
  - NWP power curve: mean P in the 1 m/s bin of the mean NWP wind (physics only)
  - Energinet's own day-ahead forecast (DK2 only, the TSO benchmark). It is issued ~17:50 D−1,
    after the bid gate, and covers a wider set of farms (it averages ~18 % above the three-farm
    metering), so it is rescaled by mean(P)/mean(forecast) of each training block.
  - climatology: the training mean (its quantiles for the probabilistic scores)
  - persistence 24 h: P̂(t) = P(t − 24 h)

Scores, all on the same hours: nRMSE / nMAE / bias in % of capacity; skill vs persistence
and vs climatology, SS = 1 − MSE/MSE_ref; CRPS ≈ quantile score (2/9)·Σ pinball over
τ = 0.1 … 0.9 in % of capacity (it equals the MAE for a point forecast) and CRPSS vs
climatology; P10–P90 coverage and a reliability table (observed share below each quantile).

Validation: 5-fold ``TimeSeriesSplit`` (domain rule 6) — every fold trains on the past
and is tested on the next block, never shuffled. The quantile band is conformalised
(CQR) on the newest 20 % of each training block: the P10–P90 miss margin m is added to
P90, subtracted from P10 and scaled linearly in between (q_τ + m·(τ − 0.5)/0.4).
Output is clipped to 0 ≤ P ≤ capacity (``enforce_physical_constraints``; rule 1).
Feature attribution: mean |SHAP| of the P50 output (XGBoost TreeSHAP, ``pred_contribs``).

References
----------
- Energinet Energi Data Service, ProductionConsumptionSettlement and Forecasts_Hour (CC BY 4.0)
- Open-Meteo Previous Runs API: ECMWF IFS 0.25°, DWD ICON (CC BY 4.0)
- Giebel et al. (2011) "The state of the art in short-term prediction of wind power",
  ANEMOS.plus — day-ahead nRMSE typically 10–20 % of capacity
- Gneiting & Raftery (2007) "Strictly proper scoring rules, prediction, and estimation", JASA
- Romano, Patterson & Candès (2019) "Conformalized quantile regression", NeurIPS
- Hong et al. (2016) GEFCom2014 probabilistic wind track (quantile / pinball loss)
- Lundberg et al. (2020) "From local explanations to global understanding with explainable
  AI for trees", Nature Machine Intelligence (TreeSHAP)
"""

from __future__ import annotations

import csv
import gzip
import json
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any

import numpy as np
import xgboost as xgb
from numpy.typing import NDArray
from sklearn.model_selection import TimeSeriesSplit

from app.services.p4.physical_constraints import enforce_physical_constraints

DATA_FILE = Path(__file__).parent / "data" / "dk2_offshore_dayahead.csv.gz"
# LSTM / TFT out-of-fold forecasts per hour, trained offline (scripts/train_real_deep_models.py)
DEEP_FILE = Path(__file__).parent / "data" / "dk2_deep_predictions.csv.gz"
TSO_FILE = Path(__file__).parent / "data" / "dk2_tso_dayahead.csv.gz"
CAPACITY_MW = 604.8 + 207.0 + 165.6  # Kriegers Flak + Rødsand II + Nysted
FARMS = ("Kriegers Flak 604.8 MW", "Rødsand II 207 MW", "Nysted 165.6 MW")
QUANTILES = tuple(round(0.1 * k, 1) for k in range(1, 10))  # P10 … P90
I10, I50, I90 = 0, 4, 8
N_SPLITS = 5
SERIES_HOURS = 14 * 24  # last two weeks of the last test fold, for the chart
WS_BIN_MS = 1.0
CALIBRATION_SHARE = 0.2  # newest part of each training block, for the band

XGB, LSTM, TFT = "XGBoost (P50)", "LSTM", "TFT (P50)"
ENSEMBLE, CURVE, TSO = "Ensemble (1/MSE weights)", "NWP power curve", "Energinet day-ahead (TSO)"
CLIM, PERS = "Climatology", "Persistence 24 h"
ORDER = (XGB, TFT, LSTM, ENSEMBLE, CURVE, TSO, CLIM, PERS)


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
    tso_file: Path | None = None


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
            TSO_FILE,
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


def read_hourly(path: Path | None, time_utc: NDArray[np.datetime64]) -> dict[str, Any]:
    """Columns of an hourly ``time_utc,…`` gz CSV aligned to ``time_utc`` (NaN = missing)."""
    if path is None or not path.exists():
        return {}
    with gzip.open(path, "rt", encoding="utf-8") as f:
        rows = list(csv.reader(f))
    hours = np.array([r[0].rstrip("Z") for r in rows[1:]], dtype="datetime64[h]")
    pos = {h: i for i, h in enumerate(hours.tolist())}
    idx = np.array([pos.get(h, -1) for h in time_utc.tolist()])
    vals = np.array([[float(v) for v in r[1:]] for r in rows[1:]])
    return {
        name: np.where(idx >= 0, vals[np.maximum(idx, 0), j], np.nan)
        for j, name in enumerate(rows[0][1:])
    }


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


def quantile_score(y: NDArray[np.float64], q: NDArray[np.float64]) -> float:
    """CRPS approximation (2/9)·Σ_τ pinball_τ over QUANTILES [MW]. ``q`` is (n, 9), or (n,)
    for a point forecast — then it equals the MAE, because the τ average to 0.5."""
    q2 = q[:, None] if q.ndim == 1 else q
    tau = np.array(QUANTILES)[None, :]
    d = y[:, None] - q2
    return float(np.mean(2 * np.maximum(tau * d, (tau - 1) * d)))


def _clip(p: NDArray[np.float64], capacity_mw: float) -> NDArray[np.float64]:
    return enforce_physical_constraints(p, None, rated_power_mw=capacity_mw).power_mw


@dataclass(frozen=True)
class ModelScore:
    name: str
    nrmse_pct: float
    nmae_pct: float
    bias_pct: float
    skill_vs_persistence: float
    skill_vs_climatology: float
    crps_pct: float
    crpss_vs_climatology: float
    probabilistic: bool
    fold_nrmse_pct: list[float]


@dataclass(frozen=True)
class Reliability:
    name: str
    observed_below: list[float]  # share of hours at or below each quantile; ideal = τ
    p10_p90_coverage_pct: float


@dataclass(frozen=True)
class RealForecastResult:
    scores: list[ModelScore]
    reliability: list[Reliability]
    p10_p90_coverage_pct: float
    feature_importance: list[tuple[str, float]]
    series: dict[str, list[object]]
    period: tuple[str, str]
    hours: int
    scored_hours: int


def _xgb_fold(
    x: NDArray[np.float64],
    y: NDArray[np.float64],
    train: NDArray[np.intp],
    test: NDArray[np.intp],
    seed: int,
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Conformalised quantiles (n_test, 9) [MW] and Σ|SHAP| of the P50 output per feature."""
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
    # Conformalised quantile regression (Romano et al. 2019): fit on the older 80 % of the
    # training block, measure how far P10–P90 misses on the newest 20 %, widen the test band
    # by that margin. The forecast itself comes from a refit on the whole block.
    fit, cal = np.array_split(train, [int(len(train) * (1 - CALIBRATION_SHARE))])
    model.fit(x[fit], y[fit])
    q_cal = np.sort(model.predict(x[cal]), axis=1)
    miss = np.maximum(q_cal[:, I10] - y[cal], y[cal] - q_cal[:, I90])
    margin = float(np.quantile(miss, QUANTILES[I90] - QUANTILES[I10]))
    model.fit(x[train], y[train])
    q = np.sort(model.predict(x[test]), axis=1)  # sort: quantiles never cross
    q = q + margin * (np.array(QUANTILES) - 0.5) / 0.4
    contribs = model.get_booster().predict(xgb.DMatrix(x[test]), pred_contribs=True)
    shap: NDArray[np.float64] = np.abs(contribs[:, I50, :-1]).sum(axis=0)  # last = bias
    return q, shap


def _ensemble_weights(
    members: list[NDArray[np.float64]], y: NDArray[np.float64], past: NDArray[np.intp]
) -> NDArray[np.float64]:
    """1/MSE of each member on earlier test hours (all members present); equal if none."""
    past = past[np.all([np.isfinite(m[past]) for m in members], axis=0)]
    if past.size == 0:
        return np.full(len(members), 1 / len(members))
    w = np.array([1 / np.mean((m[past] - y[past]) ** 2) for m in members])
    return np.asarray(w / w.sum(), dtype=np.float64)


@cache
def evaluate_real_dayahead(site: str = "dk2", seed: int = 42) -> RealForecastResult:
    """Train XGBoost per TimeSeriesSplit fold and score every forecast on the same hours."""
    st = sites()[site]
    cap = st.capacity_mw
    ds = load_dataset(site)
    x_all, names = build_features(ds)
    pers_all = persistence_24h(ds)
    ok = ~np.isnan(pers_all)  # first day + gaps: no persistence → not scored
    x, y, pers, ws_mean = x_all[ok], ds.power_mw[ok], pers_all[ok], ds.nwp_ws[ok].mean(axis=1)
    t = ds.time_utc[ok]
    deep = read_hourly(st.deep_file, t)
    tso = read_hourly(st.tso_file, t).get("tso_dayahead_mw")

    n = len(y)
    nan = np.full(n, np.nan)
    quant = {XGB: np.full((n, len(QUANTILES)), np.nan), CLIM: np.full((n, len(QUANTILES)), np.nan)}
    point = {CURVE: nan.copy(), CLIM: nan.copy(), PERS: pers}
    if deep:
        quant[TFT] = np.column_stack([deep[f"tft_q{round(100 * q)}_mw"] for q in QUANTILES])
        point[LSTM] = deep["lstm_p50_mw"]
        point[ENSEMBLE] = nan.copy()
    if tso is not None:
        point[TSO] = nan.copy()
    shap = np.zeros(len(names))
    folds = list(TimeSeriesSplit(n_splits=N_SPLITS).split(x))

    for k, (train, test) in enumerate(folds):
        q, s = _xgb_fold(x, y, train, test, seed)
        quant[XGB][test] = np.column_stack([_clip(c, cap) for c in q.T])
        shap += s
        point[CURVE][test] = _clip(
            power_curve_forecast(ws_mean[train], y[train], ws_mean[test]), cap
        )
        point[CLIM][test] = y[train].mean()
        quant[CLIM][test] = np.quantile(y[train], QUANTILES)
        if tso is not None:
            seen = train[np.isfinite(tso[train])]
            point[TSO][test] = _clip(tso[test] * y[seen].mean() / tso[seen].mean(), cap)
        if deep:
            members = [quant[XGB][:, I50], point[LSTM], quant[TFT][:, I50]]
            past = np.concatenate([f[1] for f in folds[:k]]) if k else np.array([], dtype=np.intp)
            w = _ensemble_weights(members, y, past)
            point[ENSEMBLE][test] = sum(wi * m[test] for wi, m in zip(w, members, strict=True))

    point[XGB] = quant[XGB][:, I50]
    if deep:
        point[TFT] = quant[TFT][:, I50]
    # score every forecast on the same hours: test folds where all of them exist
    scored = np.zeros(n, dtype=bool)
    scored[folds[0][1][0] :] = True
    for v in [*point.values(), *(q[:, I10] for q in quant.values())]:
        scored &= np.isfinite(v)
    yy = y[scored]

    def mse(p: NDArray[np.float64]) -> float:
        return float(np.mean((p[scored] - yy) ** 2))

    def crps(name: str) -> float:
        return quantile_score(yy, quant[name][scored] if name in quant else point[name][scored])

    mse_pers, mse_clim, crps_clim = mse(pers), mse(point[CLIM]), crps(CLIM)
    scores = [
        ModelScore(
            name=name,
            nrmse_pct=round(100 * float(np.sqrt(mse(point[name]))) / cap, 2),
            nmae_pct=round(100 * float(np.mean(np.abs(point[name][scored] - yy))) / cap, 2),
            bias_pct=round(100 * float(np.mean(point[name][scored] - yy)) / cap, 2),
            skill_vs_persistence=round(1 - mse(point[name]) / mse_pers, 3),
            skill_vs_climatology=round(1 - mse(point[name]) / mse_clim, 3),
            crps_pct=round(100 * crps(name) / cap, 2),
            crpss_vs_climatology=round(1 - crps(name) / crps_clim, 3),
            probabilistic=name in quant,
            fold_nrmse_pct=[
                round(100 * float(np.sqrt(np.mean((point[name][f] - y[f]) ** 2))) / cap, 2)
                for f in (test[scored[test]] for _, test in folds)
                if f.size
            ],
        )
        for name in ORDER
        if name in point
    ]

    reliability = [
        Reliability(
            name,
            np.round((yy[:, None] <= q[scored]).mean(axis=0), 3).tolist(),
            round(100 * float(np.mean((yy >= q[scored][:, I10]) & (yy <= q[scored][:, I90]))), 1),
        )
        for name, q in quant.items()
    ]

    total = float(shap.sum()) or 1.0
    importance = sorted(
        ((nm, round(float(v) / total, 4)) for nm, v in zip(names, shap, strict=True)),
        key=lambda kv: -kv[1],
    )
    last = folds[-1][1][-SERIES_HOURS:]

    def ser(v: NDArray[np.float64], nd: int = 1) -> list[object]:
        return [round(float(a), nd) if np.isfinite(a) else None for a in v[last]]

    series: dict[str, list[object]] = {
        "time_utc": [str(v) + ":00Z" for v in t[last]],
        "actual_mw": ser(y),
        "p10_mw": ser(quant[XGB][:, I10]),
        "p50_mw": ser(quant[XGB][:, I50]),
        "p90_mw": ser(quant[XGB][:, I90]),
        "persistence_mw": ser(pers),
        "nwp_wind_ms": ser(ws_mean, 2),
    }
    if tso is not None:
        series["tso_mw"] = ser(point[TSO])
    if deep:
        series["ensemble_mw"] = ser(point[ENSEMBLE])
    return RealForecastResult(
        scores=scores,
        reliability=reliability,
        p10_p90_coverage_pct=reliability[0].p10_p90_coverage_pct,
        feature_importance=importance[:10],
        series=series,
        period=(str(ds.time_utc[0]) + ":00Z", str(ds.time_utc[-1]) + ":00Z"),
        hours=len(ds.time_utc),
        scored_hours=int(scored.sum()),
    )
