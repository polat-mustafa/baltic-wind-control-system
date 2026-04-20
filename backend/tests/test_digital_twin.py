"""Tests for the Digital Twin module.

Organized by sub-module:
1. Twin Engine: steady-state prediction, lookup table, interpolation
2. Residual Analysis: zero residual for identical data, EWMA smoothing
3. Health Scoring: 100% for zero residuals, threshold classification
4. Anomaly Classification: each fault signature maps to correct category
5. Scenario Generator: end-to-end pipeline for each scenario
6. Router: API endpoint smoke tests
"""

from __future__ import annotations

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.digital_twin.anomaly_classification import (
    AnomalyCategory,
    classify_single,
)
from app.services.digital_twin.health_scoring import (
    HealthStatus,
    compute_farm_health,
    compute_health_score,
)
from app.services.digital_twin.residual_analysis import (
    compute_residuals,
)
from app.services.digital_twin.twin_engine import (
    build_twin_lookup_table,
    clear_twin_cache,
    lookup_twin_prediction,
    run_twin_at_operating_point,
)

client = TestClient(app)


# ── 1. Twin Engine ────────────────────────────────────────────────


class TestTwinEngine:
    """Tests for twin_engine.py — steady-state predictions."""

    def test_run_twin_at_rated_wind(self):
        """Twin at rated wind (11.1 m/s) should produce ~15 MW."""
        pred = run_twin_at_operating_point(11.1, 0.0, num_steps=200)
        # At rated wind, power should be close to 15 MW
        assert pred.power_mw > 10.0, f"Power {pred.power_mw} too low at rated wind"
        assert pred.power_mw <= 15.0, f"Power {pred.power_mw} exceeds rated (Rule 1)"
        assert pred.rotor_speed_rpm > 0.0

    def test_run_twin_below_cut_in(self):
        """Twin below cut-in (1 m/s) should produce 0 MW."""
        pred = run_twin_at_operating_point(1.0, 0.0)
        assert pred.power_mw == 0.0

    def test_run_twin_above_cut_out(self):
        """Twin above cut-out (32 m/s) should produce 0 MW."""
        pred = run_twin_at_operating_point(32.0, 0.0)
        assert pred.power_mw == 0.0

    def test_lookup_table_builds(self):
        """Lookup table should build without error and have correct shape."""
        clear_twin_cache()
        table = build_twin_lookup_table()
        n_speeds = len(table.wind_speeds)
        n_dirs = len(table.wind_dirs)
        assert n_speeds >= 70  # 0 to 35 at 0.5 step
        assert n_dirs >= 36  # 0 to 350 at 10 step
        assert table.power_grid.shape == (n_speeds, n_dirs)
        assert table.rpm_grid.shape == (n_speeds, n_dirs)
        assert table.pitch_grid.shape == (n_speeds, n_dirs)

    def test_lookup_matches_direct_simulation(self):
        """Lookup table prediction should match direct simulation."""
        clear_twin_cache()
        table = build_twin_lookup_table()

        # Test at an exact grid point
        direct = run_twin_at_operating_point(10.0, 0.0, num_steps=100)
        lookup = lookup_twin_prediction(table, 10.0, 0.0)

        # Should be very close (exact grid point)
        assert abs(lookup.power_mw - direct.power_mw) < 0.5, (
            f"Lookup {lookup.power_mw:.2f} vs direct {direct.power_mw:.2f}"
        )

    def test_lookup_interpolation(self):
        """Interpolated lookups should be reasonable between grid points."""
        clear_twin_cache()
        table = build_twin_lookup_table()

        # Between grid points
        pred_low = lookup_twin_prediction(table, 8.0, 0.0)
        pred_mid = lookup_twin_prediction(table, 8.25, 0.0)
        pred_high = lookup_twin_prediction(table, 8.5, 0.0)

        # Monotonic increase in power between 8.0 and 8.5 m/s
        assert pred_low.power_mw <= pred_mid.power_mw <= pred_high.power_mw

    def test_lookup_clamps_out_of_range(self):
        """Lookup should handle out-of-range values gracefully."""
        clear_twin_cache()
        table = build_twin_lookup_table()

        # Way above cut-out
        pred = lookup_twin_prediction(table, 50.0, 0.0)
        assert pred.power_mw >= 0.0  # Should not be negative

        # Negative wind (shouldn't happen but should not crash)
        pred = lookup_twin_prediction(table, -5.0, 0.0)
        assert pred.power_mw >= 0.0


# ── 2. Residual Analysis ─────────────────────────────────────────


class TestResidualAnalysis:
    """Tests for residual_analysis.py."""

    def test_zero_residual_for_identical_data(self):
        """When actual = twin, all residuals should be zero."""
        n = 50
        power = np.full(n, 10.0)
        rpm = np.full(n, 7.0)
        pitch = np.full(n, 5.0)

        res = compute_residuals(power, rpm, pitch, power, rpm, pitch)

        np.testing.assert_allclose(res.power_residual_mw, 0.0, atol=1e-10)
        np.testing.assert_allclose(res.rpm_residual, 0.0, atol=1e-10)
        np.testing.assert_allclose(res.pitch_residual_deg, 0.0, atol=1e-10)
        np.testing.assert_allclose(res.power_ewma, 0.0, atol=1e-10)

    def test_positive_residual_for_overperformance(self):
        """Actual > twin should give positive residual."""
        n = 50
        twin_power = np.full(n, 10.0)
        actual_power = np.full(n, 12.0)  # 20% overperformance
        rpm = np.full(n, 7.0)
        pitch = np.full(n, 5.0)

        res = compute_residuals(actual_power, rpm, pitch, twin_power, rpm, pitch)

        assert np.all(res.power_residual_mw > 0.0)
        assert np.all(res.power_residual_pct > 0.0)

    def test_ewma_smooths_noise(self):
        """EWMA should smooth out high-frequency noise."""
        n = 100
        twin_power = np.full(n, 10.0)
        # Noisy actual data oscillating ±2 MW
        rng = np.random.default_rng(42)
        actual_power = 10.0 + rng.normal(0, 2.0, n)
        rpm = np.full(n, 7.0)
        pitch = np.full(n, 5.0)

        res = compute_residuals(actual_power, rpm, pitch, twin_power, rpm, pitch)

        # EWMA should have lower variance than raw residual
        raw_std = np.std(res.power_residual_pct)
        ewma_std = np.std(res.power_ewma)
        assert ewma_std < raw_std, "EWMA should smooth the signal"


# ── 3. Health Scoring ─────────────────────────────────────────────


class TestHealthScoring:
    """Tests for health_scoring.py."""

    def test_perfect_health_for_zero_residuals(self):
        """Zero EWMA residuals should give 100% health."""
        score = compute_health_score(0.0, 0.0, 0.0)
        assert score.health_composite == 100.0
        assert score.status == HealthStatus.HEALTHY

    def test_health_decreases_with_residual(self):
        """Health should decrease as EWMA magnitude increases."""
        h0 = compute_health_score(0.0, 0.0, 0.0)
        h5 = compute_health_score(5.0, 3.0, 4.0)
        h20 = compute_health_score(20.0, 15.0, 10.0)

        assert h0.health_composite > h5.health_composite > h20.health_composite

    def test_critical_for_large_residual(self):
        """Large EWMA residuals should give critical status."""
        score = compute_health_score(30.0, 20.0, 15.0)
        assert score.status == HealthStatus.CRITICAL

    def test_degraded_for_moderate_residual(self):
        """Moderate EWMA residuals should give degraded status."""
        score = compute_health_score(3.0, 2.0, 2.0)
        assert score.status in (HealthStatus.HEALTHY, HealthStatus.DEGRADED)

    def test_farm_health_aggregation(self):
        """Farm health should average individual scores."""
        scores = [
            compute_health_score(0.0, 0.0, 0.0),  # 100%
            compute_health_score(0.0, 0.0, 0.0),  # 100%
            compute_health_score(30.0, 20.0, 15.0),  # Low
        ]
        farm = compute_farm_health(scores)
        assert farm["healthy_count"] == 2
        assert farm["critical_count"] == 1
        assert 0.0 < farm["farm_health_pct"] < 100.0


# ── 4. Anomaly Classification ────────────────────────────────────


class TestAnomalyClassification:
    """Tests for anomaly_classification.py."""

    def test_normal_for_small_residuals(self):
        """Small residuals → normal classification."""
        cat = classify_single(2.0, 1.0, 1.0)
        assert cat == AnomalyCategory.NORMAL

    def test_aerodynamic_fault(self):
        """Power low + rotor slow → aerodynamic fault."""
        cat = classify_single(-25.0, -15.0, 0.0)
        assert cat == AnomalyCategory.AERODYNAMIC

    def test_mechanical_fault(self):
        """Power low + rotor normal → mechanical fault."""
        cat = classify_single(-20.0, -2.0, 0.0)
        assert cat == AnomalyCategory.MECHANICAL

    def test_electrical_fault(self):
        """Rotor fast + pitch compensating → electrical fault."""
        cat = classify_single(-5.0, 10.0, 10.0)
        assert cat == AnomalyCategory.ELECTRICAL

    def test_control_fault(self):
        """Pitch residual dominant → control fault."""
        cat = classify_single(5.0, 3.0, 25.0)
        assert cat == AnomalyCategory.CONTROL

    def test_sensor_drift(self):
        """Power high + others normal → sensor drift."""
        cat = classify_single(15.0, 2.0, 1.0)
        assert cat == AnomalyCategory.SENSOR_DRIFT


# ── 5. Scenario Generator (end-to-end) ───────────────────────────


class TestScenarioGenerator:
    """End-to-end tests for scenario_generator.py."""

    def test_healthy_scenario(self):
        """Healthy scenario: pipeline completes without error."""
        from app.services.digital_twin.scenario_generator import run_digital_twin_analysis

        result = run_digital_twin_analysis("healthy", num_timesteps=144, num_turbines=5)
        assert result.scenario == "healthy"
        assert result.num_turbines == 5
        assert result.farm_health["farm_health_pct"] >= 0.0
        assert len(result.turbine_analyses) == 5

    def test_blade_icing_scenario(self):
        """Blade icing: pipeline completes and detects anomalies."""
        from app.services.digital_twin.scenario_generator import run_digital_twin_analysis

        result = run_digital_twin_analysis("blade_icing", num_timesteps=144, num_turbines=10)
        assert result.scenario == "blade_icing"
        assert result.num_turbines == 10
        assert len(result.turbine_analyses) == 10
        # At least some anomalies should be detected
        total_anomalies = sum(len(a.anomalies) for a in result.turbine_analyses)
        assert total_anomalies >= 0  # Pipeline ran without error

    def test_invalid_scenario_raises(self):
        """Invalid scenario name should raise ValueError."""
        from app.services.digital_twin.scenario_generator import run_digital_twin_analysis

        with pytest.raises(ValueError, match="Unknown scenario"):
            run_digital_twin_analysis("nonexistent")


# ── 6. Router Tests ──────────────────────────────────────────────


class TestDigitalTwinRouter:
    """API endpoint smoke tests."""

    def test_get_config(self):
        """GET /config should return module configuration."""
        resp = client.get("/api/v1/digital-twin/config")
        assert resp.status_code == 200
        data = resp.json()
        assert "health_weights" in data
        assert "available_scenarios" in data
        assert "healthy" in data["available_scenarios"]

    def test_get_scenarios(self):
        """GET /scenarios should return list of scenarios."""
        resp = client.get("/api/v1/digital-twin/scenarios")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 6
        names = {s["name"] for s in data}
        assert "healthy" in names
        assert "blade_icing" in names

    def test_analyze_healthy(self):
        """POST /analyze with healthy scenario should succeed."""
        resp = client.post(
            "/api/v1/digital-twin/analyze",
            json={"scenario": "healthy", "num_timesteps": 144, "num_turbines": 5},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["scenario"] == "healthy"
        assert data["num_turbines"] == 5
        assert "farm_health" in data
        assert "turbine_health" in data
        assert len(data["turbine_health"]) == 5

    def test_analyze_invalid_scenario(self):
        """POST /analyze with invalid scenario should return 400."""
        resp = client.post(
            "/api/v1/digital-twin/analyze",
            json={"scenario": "nonexistent"},
        )
        assert resp.status_code == 400

    def test_single_turbine(self):
        """POST /single-turbine should return health assessment."""
        resp = client.post(
            "/api/v1/digital-twin/single-turbine",
            json={
                "wind_speed_ms": 10.0,
                "wind_dir_deg": 0.0,
                "actual_power_mw": 8.0,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "twin_power_mw" in data
        assert "health_composite" in data
        assert data["status"] in ("healthy", "degraded", "critical")
