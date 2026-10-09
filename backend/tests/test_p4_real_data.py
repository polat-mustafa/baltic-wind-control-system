"""Real-data day-ahead forecast: bundled Energinet DK2 + NWP set and the scored models."""

from __future__ import annotations

import numpy as np
from fastapi.testclient import TestClient

from app.main import app
from app.services.p4.real_data import (
    CAPACITY_MW,
    load_dataset,
    persistence_24h,
    power_curve_forecast,
)


def test_dataset_is_physical_and_hourly():
    ds = load_dataset()
    assert len(ds.power_mw) > 15_000  # ≥ ~2 years of hours
    assert np.all(np.diff(ds.time_utc.astype(np.int64)) >= 1)  # strictly increasing
    assert ds.power_mw.min() >= 0.0
    assert ds.power_mw.max() <= CAPACITY_MW
    assert 0.25 < ds.power_mw.mean() / CAPACITY_MW < 0.55  # Baltic offshore CF
    assert np.all((ds.nwp_ws >= 0) & (ds.nwp_ws < 45))


def test_persistence_is_the_same_hour_yesterday():
    ds = load_dataset()
    pers = persistence_24h(ds)
    i = int(np.flatnonzero(~np.isnan(pers))[0])
    j = int(np.flatnonzero(ds.time_utc == ds.time_utc[i] - np.timedelta64(24, "h"))[0])
    assert pers[i] == ds.power_mw[j]


def test_power_curve_is_monotonic_enough():
    ws = np.linspace(0, 25, 2000)
    p = np.clip((ws - 3) ** 3, 0, 900)
    out = power_curve_forecast(ws, p, np.array([2.0, 8.0, 20.0]))
    assert out[0] < out[1] < out[2] <= 900


def test_endpoint_beats_every_baseline():
    r = TestClient(app).get("/api/v1/forecast/real-data/day-ahead")
    assert r.status_code == 200
    body = r.json()
    s = {m["name"]: m for m in body["scores"]}
    xgb = s["XGBoost (P50)"]
    # day-ahead offshore nRMSE is typically 10–20 % of capacity (Giebel et al. 2011)
    assert 10.0 < xgb["nrmse_pct"] < 20.0
    assert xgb["skill_vs_persistence"] > 0.5
    assert xgb["nrmse_pct"] < s["Climatology"]["nrmse_pct"] < s["Persistence 24 h"]["nrmse_pct"]
    assert len(xgb["fold_nrmse_pct"]) == body["source"]["folds"] == 5
    assert 75.0 <= body["p10_p90_coverage_pct"] <= 90.0  # conformalised band, ideal 80 %
    ser = body["series"]
    assert len(ser["time_utc"]) == 14 * 24
    bands = zip(ser["p10_mw"], ser["p50_mw"], ser["p90_mw"], strict=True)
    assert all(a <= b <= c for a, b, c in bands)
    assert max(ser["p90_mw"]) <= body["source"]["capacity_mw"]


def test_deep_models_are_scored_on_real_data():
    import json

    from app.services.p4.real_data import DEEP_FILE

    deep = {m["name"]: m for m in json.loads(DEEP_FILE.read_text(encoding="utf-8"))["models"]}
    assert set(deep) == {"LSTM", "TFT (P50)"}
    for m in deep.values():
        assert len(m["fold_nrmse_pct"]) == 5
        assert 10.0 < m["nrmse_pct"] < 25.0 and m["skill_vs_persistence"] > 0.5
