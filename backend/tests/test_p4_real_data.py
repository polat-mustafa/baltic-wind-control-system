"""Real-data day-ahead forecast: bundled Energinet DK2 + NWP set and the scored models."""

from __future__ import annotations

import numpy as np
from fastapi.testclient import TestClient

from app.main import app
from app.services.p4.real_data import (
    CAPACITY_MW,
    QUANTILES,
    _ensemble_weights,
    build_features,
    load_dataset,
    persistence_24h,
    power_curve_forecast,
    quantile_score,
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


def test_features_hold_no_measured_value():
    """Day-ahead leakage guard: only NWP issued the day before and the clock are inputs."""
    ds = load_dataset()
    x, names = build_features(ds)
    assert x.shape == (len(ds.power_mw), len(names))
    allowed = ("ecmwf_", "icon_", "hour_", "nwp_spread")
    assert all(n.startswith(allowed) for n in names), names
    # no column is (a shift of) the measured power
    for j in range(x.shape[1]):
        assert abs(np.corrcoef(x[:, j], ds.power_mw)[0, 1]) < 0.95


def test_quantile_score_is_mae_for_a_point_forecast_and_rewards_a_sharp_band():
    rng = np.random.default_rng(0)
    y = rng.uniform(0, 100, 5000)
    point = y + rng.normal(0, 10, y.size)
    assert np.isclose(quantile_score(y, point), np.mean(np.abs(y - point)))
    # the true conditional quantiles of y given point = y + noise beat the point forecast
    z = np.array([-1.2816, -0.8416, -0.5244, -0.2533, 0.0, 0.2533, 0.5244, 0.8416, 1.2816])
    assert len(z) == len(QUANTILES)
    band = point[:, None] + 10 * z[None, :]
    assert quantile_score(y, band) < quantile_score(y, point)


def test_ensemble_weights_use_only_earlier_hours():
    y = np.zeros(10)
    good, bad = np.full(10, 1.0), np.full(10, 3.0)
    bad[5:] = 0.0  # perfect later — must not matter for weights learnt on hours 0–4
    w = _ensemble_weights([good, bad], y, np.arange(5))
    assert np.allclose(w, [0.9, 0.1])  # 1/1 : 1/9
    assert np.allclose(_ensemble_weights([good, bad], y, np.array([], dtype=np.intp)), 0.5)


def test_endpoint_scores_every_forecast_on_the_same_hours(evidence):
    r = TestClient(app).get("/api/v1/forecast/real-data/day-ahead")
    assert r.status_code == 200
    body = r.json()
    s = {m["name"]: m for m in body["scores"]}
    xgb, tso = s["XGBoost (P50)"], s["Energinet day-ahead (TSO)"]
    assert {"TFT (P50)", "LSTM", "Ensemble (1/MSE weights)", "NWP power curve"} <= set(s)
    # day-ahead offshore nRMSE is typically 10–20 % of capacity (Giebel et al. 2011)
    assert 10.0 < xgb["nrmse_pct"] < 20.0 and 10.0 < tso["nrmse_pct"] < 20.0
    assert xgb["skill_vs_persistence"] > 0.5 and xgb["skill_vs_climatology"] > 0.5
    assert xgb["nrmse_pct"] < s["Climatology"]["nrmse_pct"] < s["Persistence 24 h"]["nrmse_pct"]
    # 2026-10-10: XGBoost 15.4 % beats the TSO's own forecast 16.9 % — may only improve
    assert xgb["nrmse_pct"] < tso["nrmse_pct"]
    hours = f"{body['source']['scored_hours']} measured DK2 hours (Energinet)"
    for name, m, metric, label, unit, limit in (
        ("XGBoost", xgb, "nrmse_pct", "nRMSE", "% of capacity", "10–20 % (Giebel 2011); < TSO"),
        ("Energinet (TSO)", tso, "nrmse_pct", "nRMSE", "% of capacity", "reference"),
        ("XGBoost", xgb, "crpss_vs_climatology", "CRPS skill vs climatology", "−", "> 0.5"),
        ("XGBoost", xgb, "skill_vs_persistence", "MSE skill vs 24 h persistence", "−", "> 0.5"),
    ):
        evidence(
            f"p4-{name.split()[0].lower()}-{metric}",
            area="P4 — forecasting",
            claim=f"Day-ahead forecast: {name}",
            against=hours,
            metric=label,
            value=m[metric],
            unit=unit,
            limit=limit,
        )
    # probabilistic: the band beats its own median on CRPS, climatology quantiles are the zero
    assert xgb["crps_pct"] < xgb["nmae_pct"] and xgb["crpss_vs_climatology"] > 0.5
    assert s["Climatology"]["crpss_vs_climatology"] == 0.0
    for m in body["scores"]:
        assert len(m["fold_nrmse_pct"]) == body["source"]["folds"] == 5
        if not m["probabilistic"]:
            assert m["crps_pct"] == m["nmae_pct"]  # CRPS of a point forecast = MAE
    assert 75.0 <= body["p10_p90_coverage_pct"] <= 90.0  # conformalised band, ideal 80 %
    evidence(
        "p4-xgboost-coverage",
        area="P4 — forecasting",
        claim="XGBoost P10–P90 band (conformalised) is calibrated",
        against=hours,
        metric="share of measured hours inside P10–P90",
        value=body["p10_p90_coverage_pct"],
        unit="%",
        limit="75–90 % (ideal 80 %)",
    )
    rel = {r["name"]: r["observed_below"] for r in body["reliability"]}
    assert all(np.diff(v).min() >= 0 for v in rel.values())  # monotone in τ
    assert (
        np.max(np.abs(np.array(rel["XGBoost (P50)"]) - np.array(QUANTILES))) < 0.1
    )  # Linux vs Windows XGBoost: 0.04–0.08
    assert body["source"]["scored_hours"] > 15_000
    assert body["feature_importance"][0]["feature"].endswith("_ws")  # wind drives power
    ser = body["series"]
    assert (
        len(ser["time_utc"]) == 14 * 24 and len(ser["tso_mw"]) == len(ser["ensemble_mw"]) == 14 * 24
    )
    bands = zip(ser["p10_mw"], ser["p50_mw"], ser["p90_mw"], strict=True)
    assert all(a <= b <= c for a, b, c in bands)
    assert max(ser["p90_mw"]) <= body["source"]["capacity_mw"]


def test_deep_model_forecasts_are_bundled_per_hour():
    from app.services.p4.real_data import DEEP_FILE, read_hourly

    ds = load_dataset()
    deep = read_hourly(DEEP_FILE, ds.time_utc)
    assert set(deep) == {"lstm_p50_mw", *(f"tft_q{round(100 * q)}_mw" for q in QUANTILES)}
    have = np.isfinite(deep["lstm_p50_mw"])
    assert have.sum() > 15_000
    tft = np.column_stack([deep[f"tft_q{round(100 * q)}_mw"] for q in QUANTILES])[have]
    assert np.all(np.diff(tft, axis=1) >= 0)  # quantiles never cross


A73_SAMPLE = b"""<?xml version="1.0" encoding="UTF-8"?>
<GL_MarketDocument xmlns="urn:iec62325.351:tc57wg16:451-6:generationloaddocument:3:0">
 <TimeSeries>
  <MktPSRType><psrType>B18</psrType>
   <PowerSystemResources><mRID codingScheme="A01">11WD7BALTIC2XXX</mRID><name>Baltic 2</name>
   </PowerSystemResources></MktPSRType>
  <Period>
   <timeInterval><start>2024-06-01T00:00Z</start><end>2024-06-01T01:00Z</end></timeInterval>
   <resolution>PT15M</resolution>
   <Point><position>1</position><quantity>100</quantity></Point>
   <Point><position>2</position><quantity>200</quantity></Point>
   <Point><position>4</position><quantity>40</quantity></Point>
  </Period>
 </TimeSeries>
</GL_MarketDocument>"""


def test_entsoe_a73_parser_fills_a03_gaps_and_averages_to_hours():
    import importlib.util
    from pathlib import Path

    path = Path(__file__).resolve().parents[1] / "scripts" / "fetch_entsoe_units.py"
    spec = importlib.util.spec_from_file_location("fetch_entsoe_units", path)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    import sys

    sys.path.insert(0, str(path.parent))
    spec.loader.exec_module(mod)
    out = mod.parse_a73(A73_SAMPLE)
    # positions 1, 2, (3 repeats 2), 4 → (100 + 200 + 200 + 40) / 4
    assert out == {"Baltic 2": {"2024-06-01T00": 135.0}}


def test_sites_endpoint_and_unknown_site():
    client = TestClient(app)
    keys = [s["key"] for s in client.get("/api/v1/forecast/real-data/sites").json()]
    assert keys[0] == "dk2"
    assert client.get("/api/v1/forecast/real-data/day-ahead?site=nope").status_code == 404


def test_single_farm_sites_from_the_file_library():
    """Kriegers Flak, Rødsand 1 / 2 per farm (ENTSO-E 16.1.A): physical and scored."""
    from app.services.p4.real_data import sites

    s = sites()
    assert {"kriegers_flak", "roedsand1", "roedsand2"} <= set(s)
    for key in ("kriegers_flak", "roedsand1", "roedsand2"):
        ds = load_dataset(key)
        assert len(ds.power_mw) > 15_000
        assert ds.power_mw.min() >= 0.0 and ds.power_mw.max() <= s[key].capacity_mw


def test_baltic_power_energisation_endpoint():
    """Poland's first offshore farm (76 × V236-15.0 MW) ramping up since first power."""
    body = TestClient(app).get("/api/v1/commissioning/real-data/baltic-power").json()
    days = body["days"]
    assert len(days) > 60 and "V236" in body["farm"]
    assert all(0 <= d["peak_mw"] <= 1140 and d["turbines_at_least"] <= 76 for d in days)
    # energisation: the last month's best is well above the first week's
    assert max(d["peak_mw"] for d in days[-30:]) > 2 * max(d["peak_mw"] for d in days[:7])
