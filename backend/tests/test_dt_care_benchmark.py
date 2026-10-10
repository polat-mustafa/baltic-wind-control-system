"""Digital twin detector on real data: CARE to Compare Wind Farm B (bundled result + method)."""

from __future__ import annotations

import numpy as np
from fastapi.testclient import TestClient

from app.main import app
from app.services.digital_twin.care_benchmark import chart_channel, thermal_inputs


def _plant(n: int, drift_from: int | None, seed: int = 1):
    """Bearing temperature = f(power, ambient) + lagged noise; optional +K/day drift."""
    rng = np.random.default_rng(seed)
    power = np.clip(0.5 + 0.3 * np.sin(np.arange(n) / 300) + 0.1 * rng.standard_normal(n), 0, 1)
    ambient = 10 + 5 * np.sin(np.arange(n) / 4000)
    temp = 30 + 25 * power + 0.5 * ambient + 0.3 * rng.standard_normal(n)
    if drift_from is not None:
        temp[drift_from:] += np.arange(n - drift_from) / 144 * 0.5  # +0.5 K per day
    x = thermal_inputs(power, ambient, ambient * 0, power * 10)
    train = np.arange(n) < int(n * 0.8)
    return x, temp, np.ones(n, dtype=bool), train, power


def test_quiet_on_normal_data():
    x, y, valid, train, power = _plant(20_000, None)
    assert chart_channel(x, y, valid, train, power).first_alarm is None


def test_detects_a_bearing_drift_within_days():
    x, y, valid, train, power = _plant(20_000, drift_from=17_000)
    ch = chart_channel(x, y, valid, train, power)
    pred_start = int(20_000 * 0.8)
    assert ch.first_alarm is not None
    # +0.5 K/day: alarm before ~5 K offset, well under a typical 10 K OEM SCADA limit
    assert 0 < (ch.first_alarm - (17_000 - pred_start)) / 144 < 10


def test_endpoint_serves_the_bundled_benchmark(evidence):
    body = TestClient(app).get("/api/v1/digital-twin/real-data/care").json()
    s = body["summary"]
    assert s["anomaly_events"] == 6 and s["normal_events"] == 9
    assert len(body["events"]) == 15
    assert s["detected"] >= 4  # the published finding: 5 / 6 faults before failure
    for e in body["events"]:
        assert e["median_limit_factor"] >= 1.0
        if e["alarm"] and e["label"] == "anomaly":
            assert e["warning_days"] > 0
    # widening can only remove alarms; whole-year calibration (v2) halves v1's false alarms
    assert s["false_alarms"] <= body["summary_live_limit"]["false_alarms"]
    assert s["false_alarms"] < body["summary_v1"]["false_alarms"]
    assert "b" in body["available_farms"]
    for key, metric, unit, limit in (
        ("detected", "faults detected before failure (of 6)", "−", "≥ 4"),
        ("false_alarms", "false alarms (of 9 normal periods)", "−", "fewer than v1"),
    ):
        evidence(
            f"dt-care-b-{key}",
            area="Digital twin",
            claim="Physics-residual detector on real turbine SCADA (CARE Farm B, tuning set)",
            against="labelled fault and normal periods, CARE to Compare (Gück et al. 2024)",
            metric=metric,
            value=s[key],
            unit=unit,
            limit=limit,
        )


def test_farm_c_is_the_held_out_set(evidence):
    """Farm C was run once with the method fixed on Farm B — its numbers are reported as-is."""
    body = TestClient(app).get("/api/v1/digital-twin/real-data/care?farm=c").json()
    assert "held-out" in body["role"]
    s = body["summary"]
    assert s["anomaly_events"] == 27
    assert len(body["events"]) == s["anomaly_events"] + s["normal_events"]
    evidence(
        "dt-care-c-detected",
        area="Digital twin",
        claim="Same detector, method frozen on Farm B, run once on Farm C (held out)",
        against="27 labelled fault periods, CARE Farm C",
        metric="faults detected before failure",
        value=s["detected"],
        unit="−",
        limit="reported as-is",
    )
    assert TestClient(app).get("/api/v1/digital-twin/real-data/care?farm=x").status_code == 404
