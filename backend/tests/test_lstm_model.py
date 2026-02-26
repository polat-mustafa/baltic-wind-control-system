"""
Tests for LSTM wind power forecasting model with MC Dropout uncertainty.

Covers:
- Sequence creation and sliding window correctness
- LSTM training with TimeSeriesSplit cross-validation
- MC Dropout variation and uncertainty estimation
- Probabilistic P10/P50/P90 prediction with physical constraints
- Physical constraint enforcement (zero power below cut-in)

Small test config for CI speed:
  lookback=24, units=(16,8), epochs=5, mc_samples=20, n_cv_splits=3
"""

from __future__ import annotations

import numpy as np
import pytest

from app.services.p4.feature_engineering import FeatureConfig, engineer_features
from app.services.p4.lstm_model import (
    LSTMConfig,
    compute_mc_dropout_detail,
    create_sequences,
    predict_lstm,
    train_lstm,
)
from app.services.p4.nwp_pipeline import (
    NWP_FEATURE_NAMES,
    NWPConfig,
    generate_nwp_dataset,
    merge_nwp_features,
)
from app.services.p4.physical_constraints import DEFAULT_RATED_POWER_MW
from app.services.p4.scada_generator import SCADAConfig, generate_scada_dataset
from app.services.p4.scada_quality_filters import apply_all_quality_filters

# ── Shared Test Fixtures ──────────────────────────────────────────

SMALL_SCADA_CONFIG = SCADAConfig(num_turbines=2, num_timesteps=500, seed=42)
TURBINE_INDEX = 0

# Small LSTM config for fast CI
SMALL_LSTM_CONFIG = LSTMConfig(
    lookback=24,
    hidden_units=(16, 8),
    dropout=0.2,
    learning_rate=0.005,
    epochs=5,
    patience=3,
    batch_size=32,
    mc_samples=20,
    n_cv_splits=3,
    seed=42,
)


@pytest.fixture(scope="module")
def scada_dataset():
    """Generate a small SCADA dataset for all tests."""
    return generate_scada_dataset(SMALL_SCADA_CONFIG)


@pytest.fixture(scope="module")
def filtered_data(scada_dataset):
    """Apply quality filters to the SCADA dataset."""
    return apply_all_quality_filters(
        wind_speed=scada_dataset.wind_speed_ms,
        power=scada_dataset.power_mw,
        status=scada_dataset.status,
        temperature=scada_dataset.temperature_c,
        humidity=scada_dataset.humidity_pct,
    )


@pytest.fixture(scope="module")
def engineered(scada_dataset, filtered_data):
    """Run feature engineering on filtered data."""
    return engineer_features(
        wind_speed=scada_dataset.wind_speed_ms,
        power=scada_dataset.power_mw,
        wind_direction=scada_dataset.wind_direction_deg,
        temperature=scada_dataset.temperature_c,
        pressure=scada_dataset.pressure_pa,
        humidity=scada_dataset.humidity_pct,
        timestamps=scada_dataset.timestamps,
        clean_mask=filtered_data.clean_mask,
        turbine_index=TURBINE_INDEX,
        config=FeatureConfig(),
    )


@pytest.fixture(scope="module")
def nwp_dataset(scada_dataset, filtered_data):
    """Generate NWP data correlated with SCADA."""
    mask = filtered_data.clean_mask[:, TURBINE_INDEX]
    scada_wind = scada_dataset.wind_speed_ms[mask, TURBINE_INDEX]
    timestamps = scada_dataset.timestamps[mask]
    nwp_config = NWPConfig(num_timesteps=len(scada_wind), seed=42)
    return generate_nwp_dataset(
        config=nwp_config,
        scada_wind_ms=scada_wind,
        timestamps=timestamps,
    )


@pytest.fixture(scope="module")
def merged_features(engineered, nwp_dataset):
    """Merge SCADA features with NWP features."""
    return merge_nwp_features(engineered.feature_matrix, nwp_dataset)


@pytest.fixture(scope="module")
def target_power(scada_dataset, filtered_data, engineered):
    """Extract target power aligned to feature matrix."""
    mask = filtered_data.clean_mask[:, TURBINE_INDEX]
    clean_power = scada_dataset.power_mw[mask, TURBINE_INDEX]
    return clean_power[-engineered.valid_timesteps:]


@pytest.fixture(scope="module")
def wind_speed(scada_dataset, filtered_data, engineered):
    """Extract wind speed aligned to feature matrix."""
    mask = filtered_data.clean_mask[:, TURBINE_INDEX]
    clean_wind = scada_dataset.wind_speed_ms[mask, TURBINE_INDEX]
    return clean_wind[-engineered.valid_timesteps:]


@pytest.fixture(scope="module")
def feature_names(engineered):
    """Full feature name list (SCADA + NWP)."""
    return engineered.feature_names + list(NWP_FEATURE_NAMES)


@pytest.fixture(scope="module")
def trained_result(merged_features, target_power):
    """Train LSTM with small config for fast tests."""
    return train_lstm(merged_features, target_power, SMALL_LSTM_CONFIG)


# ── TestSequenceCreation ─────────────────────────────────────────


class TestSequenceCreation:
    """Tests for sliding window sequence creation."""

    def test_sequence_shape(self, merged_features, target_power):
        """Output sequences have correct 3D shape."""
        lookback = 24
        x, y = create_sequences(merged_features, target_power, lookback)

        expected_n_seq = merged_features.shape[0] - lookback + 1
        n_features = merged_features.shape[1]

        assert x.shape == (expected_n_seq, lookback, n_features)
        assert y.shape == (expected_n_seq,)

    def test_no_future_leakage(self, merged_features, target_power):
        """Each target y[i] corresponds to features at time i+lookback-1 (no future data)."""
        lookback = 24
        _x, y = create_sequences(merged_features, target_power, lookback)

        # y[0] should equal target_power[lookback-1] (last timestep in first window)
        assert y[0] == pytest.approx(target_power[lookback - 1])

        # y[-1] should equal target_power[-1] (last timestep in dataset)
        assert y[-1] == pytest.approx(target_power[-1])

    def test_sequence_continuity(self, merged_features, target_power):
        """Consecutive sequences overlap by lookback-1 timesteps."""
        lookback = 24
        x, _ = create_sequences(merged_features, target_power, lookback)

        # x[1] should overlap with x[0] shifted by 1
        np.testing.assert_array_almost_equal(x[0, 1:, :], x[1, :-1, :])

    def test_empty_for_short_data(self):
        """Returns empty arrays when data is shorter than lookback."""
        features = np.random.default_rng(42).random((10, 5))
        target = np.random.default_rng(42).random(10)

        x, y = create_sequences(features, target, lookback=50)

        assert x.shape[0] == 0
        assert y.shape[0] == 0


# ── TestLSTMTraining ─────────────────────────────────────────────


class TestLSTMTraining:
    """Tests for LSTM model training and cross-validation."""

    def test_training_completes(self, trained_result):
        """Model trains without error and returns results."""
        cv_result, model, norm_params = trained_result
        assert cv_result is not None
        assert model is not None
        assert norm_params is not None

    def test_cv_folds_count(self, trained_result):
        """CV produces the expected number of folds."""
        cv_result, _, _ = trained_result
        assert len(cv_result.fold_metrics) == SMALL_LSTM_CONFIG.n_cv_splits

    def test_early_stopping_respected(self, trained_result):
        """Training epochs are ≤ max configured epochs."""
        cv_result, _, _ = trained_result
        for fold in cv_result.fold_metrics:
            assert fold.training_epochs <= SMALL_LSTM_CONFIG.epochs

    def test_rmse_finite(self, trained_result):
        """RMSE values are finite (not NaN or Inf)."""
        cv_result, _, _ = trained_result
        assert np.isfinite(cv_result.mean_rmse_mw)
        for fold in cv_result.fold_metrics:
            assert np.isfinite(fold.rmse_mw)

    def test_norm_params_populated(self, trained_result):
        """Normalization parameters are computed and stored."""
        _, _, norm_params = trained_result
        assert len(norm_params.feature_min) > 0
        assert len(norm_params.feature_max) > 0
        assert norm_params.target_max > norm_params.target_min

    def test_architecture_summary(self, trained_result):
        """Architecture summary contains expected components."""
        cv_result, _, _ = trained_result
        summary = cv_result.architecture_summary
        assert "LSTM" in summary
        assert "Dropout" in summary
        assert "Dense(1)" in summary


# ── TestMCDropout ────────────────────────────────────────────────


class TestMCDropout:
    """Tests for MC Dropout uncertainty estimation."""

    def test_mc_variation_across_passes(self, trained_result, merged_features):
        """Different MC passes produce different predictions (dropout active)."""
        _, model, norm_params = trained_result

        # Use a small subset for speed
        subset = merged_features[:50]
        mc_detail = compute_mc_dropout_detail(model, subset, norm_params, SMALL_LSTM_CONFIG)

        if mc_detail.num_passes > 1 and mc_detail.all_passes.shape[1] > 0:
            # Standard deviation across passes should be > 0 for at least some steps
            pass_std = np.std(mc_detail.all_passes, axis=0)
            assert np.any(pass_std > 0), (
                "MC Dropout passes are identical — dropout may not be active"
            )

    def test_mc_std_non_negative(self, trained_result, merged_features):
        """MC Dropout standard deviation is non-negative everywhere."""
        _, model, norm_params = trained_result

        subset = merged_features[:50]
        mc_detail = compute_mc_dropout_detail(model, subset, norm_params, SMALL_LSTM_CONFIG)

        assert np.all(mc_detail.std_mw >= 0.0)

    def test_mc_correct_pass_count(self, trained_result, merged_features):
        """Number of MC passes matches configuration."""
        _, model, norm_params = trained_result

        subset = merged_features[:50]
        mc_detail = compute_mc_dropout_detail(model, subset, norm_params, SMALL_LSTM_CONFIG)

        assert mc_detail.num_passes == SMALL_LSTM_CONFIG.mc_samples
        assert mc_detail.all_passes.shape[0] == SMALL_LSTM_CONFIG.mc_samples


# ── TestLSTMPrediction ───────────────────────────────────────────


class TestLSTMPrediction:
    """Tests for probabilistic P10/P50/P90 LSTM forecasting."""

    def test_quantile_monotonicity(self, trained_result, merged_features, wind_speed):
        """P10 ≤ P50 ≤ P90 for all timesteps."""
        _, model, norm_params = trained_result

        forecast = predict_lstm(
            model, merged_features, wind_speed, norm_params, SMALL_LSTM_CONFIG,
        )

        assert np.all(forecast.power_p10_mw <= forecast.power_p50_mw + 1e-9), (
            "P10 exceeds P50 at some timesteps"
        )
        assert np.all(forecast.power_p50_mw <= forecast.power_p90_mw + 1e-9), (
            "P50 exceeds P90 at some timesteps"
        )

    def test_no_negative_predictions(self, trained_result, merged_features, wind_speed):
        """No prediction is below 0 MW after constraint enforcement."""
        _, model, norm_params = trained_result

        forecast = predict_lstm(
            model, merged_features, wind_speed, norm_params, SMALL_LSTM_CONFIG,
        )

        assert np.all(forecast.power_p10_mw >= 0.0)
        assert np.all(forecast.power_p50_mw >= 0.0)
        assert np.all(forecast.power_p90_mw >= 0.0)

    def test_no_above_rated(self, trained_result, merged_features, wind_speed):
        """No prediction exceeds 15.0 MW (V236 rated power)."""
        _, model, norm_params = trained_result

        forecast = predict_lstm(
            model, merged_features, wind_speed, norm_params, SMALL_LSTM_CONFIG,
        )

        assert np.all(forecast.power_p10_mw <= DEFAULT_RATED_POWER_MW + 1e-9)
        assert np.all(forecast.power_p50_mw <= DEFAULT_RATED_POWER_MW + 1e-9)
        assert np.all(forecast.power_p90_mw <= DEFAULT_RATED_POWER_MW + 1e-9)

    def test_forecast_lengths_consistent(self, trained_result, merged_features, wind_speed):
        """All forecast arrays have the same length."""
        _, model, norm_params = trained_result

        forecast = predict_lstm(
            model, merged_features, wind_speed, norm_params, SMALL_LSTM_CONFIG,
        )

        n = len(forecast.power_p50_mw)
        assert n > 0
        assert len(forecast.power_p10_mw) == n
        assert len(forecast.power_p90_mw) == n
        assert len(forecast.mc_mean_mw) == n
        assert len(forecast.mc_std_mw) == n
        assert len(forecast.wind_speed_ms) == n
        assert len(forecast.timestamps_utc) == n


# ── TestLSTMPhysicalConstraints ──────────────────────────────────


class TestLSTMPhysicalConstraints:
    """Tests for physical constraint enforcement on LSTM predictions."""

    def test_zero_power_below_cut_in(self, trained_result, merged_features):
        """Power is zero when wind speed is below cut-in (3.0 m/s)."""
        _, model, norm_params = trained_result

        # Create fake low wind speed array
        n = merged_features.shape[0]
        low_wind = np.full(n, 1.5, dtype=np.float64)  # Below cut-in

        forecast = predict_lstm(
            model, merged_features, low_wind, norm_params, SMALL_LSTM_CONFIG,
        )

        # All predictions should be zero for below-cut-in wind
        assert np.all(forecast.power_p10_mw == 0.0)
        assert np.all(forecast.power_p50_mw == 0.0)
        assert np.all(forecast.power_p90_mw == 0.0)
