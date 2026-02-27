"""Tests for P4 horizon-dependent ensemble forecasting model.

Covers: horizon band selection, weight sums, quantile monotonicity,
physical constraints, uniform model identity, and full ensemble computation.
"""

from __future__ import annotations

import numpy as np
import pytest

from app.services.p4.ensemble_model import (
    MEDIUM_HORIZON_STEPS,
    SHORT_HORIZON_STEPS,
    EnsembleConfig,
    EnsembleForecastResult,
    HorizonWeights,
    ModelForecasts,
    compute_ensemble_forecast,
    compute_ensemble_simple,
    get_horizon_weights,
)

# ── Horizon Weight Selection ─────────────────────────────────────


class TestHorizonWeights:
    """Horizon-dependent weight selection tests."""

    def test_short_horizon(self) -> None:
        """Steps 0–35 (< 6h) → short weights."""
        config = EnsembleConfig()
        hw = get_horizon_weights(0, config)
        assert hw.label == "short_0_6h"
        assert hw.xgb_weight == 0.50

    def test_medium_horizon(self) -> None:
        """Steps 36–143 (6–24h) → medium weights."""
        config = EnsembleConfig()
        hw = get_horizon_weights(SHORT_HORIZON_STEPS, config)
        assert hw.label == "medium_6_24h"
        assert hw.lstm_weight == 0.40

    def test_long_horizon(self) -> None:
        """Steps 144+ (24–48h) → long weights."""
        config = EnsembleConfig()
        hw = get_horizon_weights(MEDIUM_HORIZON_STEPS, config)
        assert hw.label == "long_24_48h"
        assert hw.tft_weight == 0.60

    def test_all_weights_sum_to_one(self) -> None:
        """All horizon bands have weights summing to 1.0."""
        config = EnsembleConfig()
        for step in [0, SHORT_HORIZON_STEPS, MEDIUM_HORIZON_STEPS, 200]:
            hw = get_horizon_weights(step, config)
            total = hw.xgb_weight + hw.lstm_weight + hw.tft_weight
            assert total == pytest.approx(1.0, abs=1e-6)

    def test_invalid_weights_raise(self) -> None:
        """Weights not summing to 1.0 should raise ValueError."""
        with pytest.raises(ValueError, match=r"sum to 1\.0"):
            HorizonWeights(label="bad", xgb_weight=0.5, lstm_weight=0.5, tft_weight=0.5)


# ── Ensemble Computation ─────────────────────────────────────────


def _make_forecasts(n_steps: int, value: float = 5.0) -> ModelForecasts:
    """Create uniform test forecasts where all models agree."""
    arr = np.full(n_steps, value, dtype=np.float64)
    wind = np.full(n_steps, 10.0, dtype=np.float64)
    ts = np.arange(1_704_067_200, 1_704_067_200 + n_steps * 600, 600, dtype=np.int64)
    return ModelForecasts(
        xgb_p10=arr * 0.8,
        xgb_p50=arr.copy(),
        xgb_p90=arr * 1.2,
        lstm_p10=arr * 0.8,
        lstm_p50=arr.copy(),
        lstm_p90=arr * 1.2,
        tft_p10=arr * 0.8,
        tft_p50=arr.copy(),
        tft_p90=arr * 1.2,
        wind_speed_ms=wind,
        timestamps_utc=ts,
    )


class TestEnsembleForecast:
    """Full ensemble forecast computation tests."""

    def test_uniform_models_identity(self) -> None:
        """When all models agree, ensemble = individual models."""
        forecasts = _make_forecasts(50, value=7.0)
        result = compute_ensemble_forecast(forecasts)

        assert isinstance(result, EnsembleForecastResult)
        np.testing.assert_allclose(result.power_p50_mw, 7.0, atol=1e-6)

    def test_quantile_monotonicity(self) -> None:
        """P10 ≤ P50 ≤ P90 enforced at every step."""
        forecasts = _make_forecasts(100)
        result = compute_ensemble_forecast(forecasts)

        assert np.all(result.power_p10_mw <= result.power_p50_mw + 1e-10)
        assert np.all(result.power_p50_mw <= result.power_p90_mw + 1e-10)

    def test_physical_constraints_enforced(self) -> None:
        """Power capped at rated (15 MW) and ≥ 0."""
        n = 20
        forecasts = ModelForecasts(
            xgb_p10=np.full(n, -1.0),
            xgb_p50=np.full(n, 20.0),  # Above rated
            xgb_p90=np.full(n, 25.0),
            lstm_p10=np.full(n, -1.0),
            lstm_p50=np.full(n, 20.0),
            lstm_p90=np.full(n, 25.0),
            tft_p10=np.full(n, -1.0),
            tft_p50=np.full(n, 20.0),
            tft_p90=np.full(n, 25.0),
            wind_speed_ms=np.full(n, 12.0),
            timestamps_utc=np.arange(1_704_067_200, 1_704_067_200 + n * 600, 600, dtype=np.int64),
        )
        result = compute_ensemble_forecast(forecasts)

        assert np.all(result.power_p50_mw <= 15.0 + 1e-10)
        assert np.all(result.power_p10_mw >= 0.0 - 1e-10)

    def test_cut_in_wind_enforced(self) -> None:
        """Power = 0 when wind < cut-in (3 m/s)."""
        n = 10
        forecasts = ModelForecasts(
            xgb_p10=np.full(n, 1.0),
            xgb_p50=np.full(n, 5.0),
            xgb_p90=np.full(n, 8.0),
            lstm_p10=np.full(n, 1.0),
            lstm_p50=np.full(n, 5.0),
            lstm_p90=np.full(n, 8.0),
            tft_p10=np.full(n, 1.0),
            tft_p50=np.full(n, 5.0),
            tft_p90=np.full(n, 8.0),
            wind_speed_ms=np.full(n, 1.5),  # Below cut-in
            timestamps_utc=np.arange(1_704_067_200, 1_704_067_200 + n * 600, 600, dtype=np.int64),
        )
        result = compute_ensemble_forecast(forecasts)
        np.testing.assert_allclose(result.power_p50_mw, 0.0, atol=1e-10)

    def test_weights_applied_labels(self) -> None:
        """weights_applied contains correct horizon band labels."""
        # 50 steps: first 36 → short, remaining 14 → medium
        forecasts = _make_forecasts(50)
        result = compute_ensemble_forecast(forecasts)

        assert len(result.weights_applied) == 50
        assert result.weights_applied[0] == "short_0_6h"
        assert result.weights_applied[35] == "short_0_6h"
        assert result.weights_applied[36] == "medium_6_24h"

    def test_length_mismatch_raises(self) -> None:
        """Mismatched array lengths raise ValueError."""
        forecasts = ModelForecasts(
            xgb_p10=np.zeros(10),
            xgb_p50=np.zeros(10),
            xgb_p90=np.zeros(10),
            lstm_p10=np.zeros(10),
            lstm_p50=np.zeros(10),
            lstm_p90=np.zeros(10),
            tft_p10=np.zeros(10),
            tft_p50=np.zeros(10),
            tft_p90=np.zeros(10),
            wind_speed_ms=np.zeros(5),  # Wrong length!
            timestamps_utc=np.zeros(10, dtype=np.int64),
        )
        with pytest.raises(ValueError, match="must have length"):
            compute_ensemble_forecast(forecasts)

    def test_short_horizon_xgb_dominates(self) -> None:
        """At short horizons, XGBoost has highest weight (0.50)."""
        n = 10  # All short horizon
        forecasts = ModelForecasts(
            xgb_p10=np.full(n, 8.0),
            xgb_p50=np.full(n, 10.0),
            xgb_p90=np.full(n, 12.0),
            lstm_p10=np.full(n, 3.0),
            lstm_p50=np.full(n, 5.0),
            lstm_p90=np.full(n, 7.0),
            tft_p10=np.full(n, 1.0),
            tft_p50=np.full(n, 3.0),
            tft_p90=np.full(n, 5.0),
            wind_speed_ms=np.full(n, 10.0),
            timestamps_utc=np.arange(1_704_067_200, 1_704_067_200 + n * 600, 600, dtype=np.int64),
        )
        result = compute_ensemble_forecast(forecasts)

        # Ensemble P50 should be closer to XGBoost (10) than TFT (3)
        # Expected: 0.5*10 + 0.3*5 + 0.2*3 = 5 + 1.5 + 0.6 = 7.1
        np.testing.assert_allclose(result.power_p50_mw, 7.1, atol=0.1)


# ── Simple Ensemble ───────────────────────────────────────────────


class TestEnsembleSimple:
    """Tests for compute_ensemble_simple()."""

    def test_uniform_values(self) -> None:
        """Uniform inputs → output = input."""
        arr = np.full(20, 5.0)
        result = compute_ensemble_simple(arr, arr, arr)
        np.testing.assert_allclose(result, 5.0, atol=1e-10)

    def test_weighted_average(self) -> None:
        """Short horizon: 0.5*XGB + 0.3*LSTM + 0.2*TFT."""
        n = 10
        xgb = np.full(n, 10.0)
        lstm = np.full(n, 5.0)
        tft = np.full(n, 3.0)
        result = compute_ensemble_simple(xgb, lstm, tft)
        expected = 0.5 * 10 + 0.3 * 5 + 0.2 * 3  # = 7.1
        np.testing.assert_allclose(result, expected, atol=1e-10)

    def test_long_horizon_tft_dominates(self) -> None:
        """At step 200 (long horizon), TFT weight = 0.60."""
        n = 201  # step 200 is in long horizon band
        xgb = np.full(n, 10.0)
        lstm = np.full(n, 5.0)
        tft = np.full(n, 3.0)
        result = compute_ensemble_simple(xgb, lstm, tft)
        # Step 200: 0.1*10 + 0.3*5 + 0.6*3 = 1 + 1.5 + 1.8 = 4.3
        assert result[200] == pytest.approx(4.3, abs=1e-10)
