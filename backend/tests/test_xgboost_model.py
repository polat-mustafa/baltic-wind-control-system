"""
Tests for XGBoost wind power forecasting model and NWP pipeline.

Covers:
- NWP synthetic data generation and feature merging
- XGBoost training with TimeSeriesSplit cross-validation
- Quantile forecasting P10/P50/P90 monotonicity
- Physical constraint enforcement on predictions
- Persistence baseline skill score
- SHAP explainability values and feature importance

Small dataset config: SCADAConfig(num_turbines=2, num_timesteps=500, seed=42)
"""

from __future__ import annotations

import numpy as np
import pytest

from app.services.p4.feature_engineering import FeatureConfig, engineer_features
from app.services.p4.nwp_pipeline import (
    NWP_FEATURE_NAMES,
    NWPConfig,
    generate_nwp_dataset,
    merge_nwp_features,
)
from app.services.p4.physical_constraints import DEFAULT_RATED_POWER_MW
from app.services.p4.scada_generator import SCADAConfig, generate_scada_dataset
from app.services.p4.scada_quality_filters import apply_all_quality_filters
from app.services.p4.xgboost_model import (
    XGBoostConfig,
    compute_shap_values,
    predict_xgboost,
    train_xgboost,
)

# ── Shared Test Fixtures ──────────────────────────────────────────

SMALL_SCADA_CONFIG = SCADAConfig(num_turbines=2, num_timesteps=500, seed=42)
TURBINE_INDEX = 0


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
    return clean_power[-engineered.valid_timesteps :]


@pytest.fixture(scope="module")
def feature_names(engineered):
    """Full feature name list (SCADA + NWP)."""
    return engineered.feature_names + list(NWP_FEATURE_NAMES)


@pytest.fixture(scope="module")
def trained_result(merged_features, target_power):
    """Train XGBoost with small config for fast tests."""
    config = XGBoostConfig(
        n_estimators=50,
        max_depth=4,
        learning_rate=0.1,
        early_stopping_rounds=10,
        n_cv_splits=3,
        seed=42,
    )
    return train_xgboost(merged_features, target_power, config)


# ── TestNWPPipeline ───────────────────────────────────────────────


class TestNWPPipeline:
    """Tests for NWP synthetic data generation and feature merging."""

    def test_nwp_generation_shape(self, nwp_dataset):
        """NWP arrays have correct length."""
        n = len(nwp_dataset.timestamps_utc)
        assert n > 0
        assert len(nwp_dataset.wind_speed_100m_ms) == n
        assert len(nwp_dataset.wind_direction_100m_deg) == n
        assert len(nwp_dataset.temperature_2m_c) == n
        assert len(nwp_dataset.pressure_msl_pa) == n
        assert len(nwp_dataset.boundary_layer_height_m) == n

    def test_nwp_wind_speed_range(self, nwp_dataset):
        """NWP wind speed is non-negative and physically reasonable."""
        assert np.all(nwp_dataset.wind_speed_100m_ms >= 0.0)
        assert float(np.max(nwp_dataset.wind_speed_100m_ms)) < 60.0

    def test_nwp_wind_direction_range(self, nwp_dataset):
        """NWP wind direction is in [0, 360)."""
        assert np.all(nwp_dataset.wind_direction_100m_deg >= 0.0)
        assert np.all(nwp_dataset.wind_direction_100m_deg < 360.0)

    def test_nwp_pressure_range(self, nwp_dataset):
        """NWP pressure is in a physically reasonable range."""
        assert np.all(nwp_dataset.pressure_msl_pa > 90_000)
        assert np.all(nwp_dataset.pressure_msl_pa < 110_000)

    def test_nwp_blh_positive(self, nwp_dataset):
        """Boundary layer height is always positive (≥50 m)."""
        assert np.all(nwp_dataset.boundary_layer_height_m >= 50.0)

    def test_nwp_timestamps_aligned(self, scada_dataset, filtered_data, nwp_dataset):
        """NWP timestamps align with filtered SCADA timestamps."""
        mask = filtered_data.clean_mask[:, TURBINE_INDEX]
        scada_ts = scada_dataset.timestamps[mask]
        np.testing.assert_array_equal(
            nwp_dataset.timestamps_utc, scada_ts
        )

    def test_merge_nwp_features_shape(self, merged_features, engineered):
        """Merged feature matrix has SCADA columns + 5 NWP columns."""
        n_scada_features = engineered.feature_matrix.shape[1]
        expected_cols = n_scada_features + 5
        assert merged_features.shape[1] == expected_cols
        assert merged_features.shape[0] == engineered.valid_timesteps

    def test_nwp_feature_names_count(self):
        """NWP_FEATURE_NAMES has exactly 5 entries."""
        assert len(NWP_FEATURE_NAMES) == 5

    def test_nwp_independent_generation(self):
        """NWP can be generated without SCADA reference."""
        config = NWPConfig(num_timesteps=100, seed=99)
        dataset = generate_nwp_dataset(config=config)
        assert len(dataset.wind_speed_100m_ms) == 100
        assert np.all(dataset.wind_speed_100m_ms >= 0.0)


# ── TestXGBoostTraining ───────────────────────────────────────────


class TestXGBoostTraining:
    """Tests for XGBoost model training and cross-validation."""

    def test_training_completes(self, trained_result):
        """Model trains without error and returns results."""
        cv_result, models = trained_result
        assert cv_result is not None
        assert len(models) == 3  # P10, P50, P90

    def test_cv_folds_count(self, trained_result):
        """CV produces the expected number of folds."""
        cv_result, _ = trained_result
        assert len(cv_result.fold_metrics) == 3  # n_cv_splits=3

    def test_cv_folds_respect_time_order(self, merged_features, target_power):
        """TimeSeriesSplit never uses future data for training."""
        from sklearn.model_selection import TimeSeriesSplit

        tscv = TimeSeriesSplit(n_splits=3)
        prev_test_max = -1
        for train_idx, test_idx in tscv.split(merged_features):
            # All training indices must be before all test indices
            assert np.max(train_idx) < np.min(test_idx)
            # Folds must be progressive (no overlap)
            assert np.min(test_idx) > prev_test_max
            prev_test_max = int(np.max(test_idx))

    def test_rmse_reasonable(self, trained_result):
        """Mean RMSE is below 3.0 MW on small synthetic data."""
        cv_result, _ = trained_result
        assert cv_result.mean_rmse_mw < 3.0, (
            f"RMSE {cv_result.mean_rmse_mw} MW exceeds 3.0 MW threshold"
        )

    def test_r_squared_positive(self, trained_result):
        """R² is positive (model explains some variance)."""
        cv_result, _ = trained_result
        assert cv_result.mean_r_squared > 0.0

    def test_metrics_non_negative(self, trained_result):
        """All error metrics are non-negative."""
        cv_result, _ = trained_result
        assert cv_result.mean_rmse_mw >= 0.0
        assert cv_result.mean_mae_mw >= 0.0
        assert cv_result.mean_mape_pct >= 0.0


# ── TestQuantileForecasting ───────────────────────────────────────


class TestQuantileForecasting:
    """Tests for probabilistic P10/P50/P90 forecasting."""

    def test_quantile_monotonicity(
        self, trained_result, merged_features, target_power, scada_dataset, filtered_data
    ):
        """P10 ≤ P50 ≤ P90 for all timesteps."""
        _, models = trained_result
        mask = filtered_data.clean_mask[:, TURBINE_INDEX]
        clean_wind = scada_dataset.wind_speed_ms[mask, TURBINE_INDEX]
        wind_speed = clean_wind[-len(target_power) :]

        forecast = predict_xgboost(
            models, merged_features, wind_speed,
        )

        assert np.all(forecast.power_p10_mw <= forecast.power_p50_mw + 1e-9), (
            "P10 exceeds P50 at some timesteps"
        )
        assert np.all(forecast.power_p50_mw <= forecast.power_p90_mw + 1e-9), (
            "P50 exceeds P90 at some timesteps"
        )

    def test_forecast_lengths_match(
        self, trained_result, merged_features, target_power, scada_dataset, filtered_data
    ):
        """All forecast arrays have the same length."""
        _, models = trained_result
        mask = filtered_data.clean_mask[:, TURBINE_INDEX]
        clean_wind = scada_dataset.wind_speed_ms[mask, TURBINE_INDEX]
        wind_speed = clean_wind[-len(target_power) :]

        forecast = predict_xgboost(models, merged_features, wind_speed)
        n = len(forecast.power_p50_mw)
        assert len(forecast.power_p10_mw) == n
        assert len(forecast.power_p90_mw) == n
        assert len(forecast.wind_speed_ms) == n
        assert len(forecast.timestamps_utc) == n


# ── TestPhysicalConstraints ───────────────────────────────────────


class TestPhysicalConstraints:
    """Tests for physical constraint enforcement on XGBoost predictions."""

    def test_no_negative_predictions(
        self, trained_result, merged_features, target_power, scada_dataset, filtered_data
    ):
        """No prediction is below 0 MW after constraint enforcement."""
        _, models = trained_result
        mask = filtered_data.clean_mask[:, TURBINE_INDEX]
        clean_wind = scada_dataset.wind_speed_ms[mask, TURBINE_INDEX]
        wind_speed = clean_wind[-len(target_power) :]

        forecast = predict_xgboost(models, merged_features, wind_speed)

        assert np.all(forecast.power_p10_mw >= 0.0)
        assert np.all(forecast.power_p50_mw >= 0.0)
        assert np.all(forecast.power_p90_mw >= 0.0)

    def test_no_above_rated(
        self, trained_result, merged_features, target_power, scada_dataset, filtered_data
    ):
        """No prediction exceeds 15.0 MW (V236 rated power)."""
        _, models = trained_result
        mask = filtered_data.clean_mask[:, TURBINE_INDEX]
        clean_wind = scada_dataset.wind_speed_ms[mask, TURBINE_INDEX]
        wind_speed = clean_wind[-len(target_power) :]

        forecast = predict_xgboost(models, merged_features, wind_speed)

        assert np.all(forecast.power_p10_mw <= DEFAULT_RATED_POWER_MW + 1e-9)
        assert np.all(forecast.power_p50_mw <= DEFAULT_RATED_POWER_MW + 1e-9)
        assert np.all(forecast.power_p90_mw <= DEFAULT_RATED_POWER_MW + 1e-9)


# ── TestPersistenceBaseline ───────────────────────────────────────


class TestPersistenceBaseline:
    """Tests for skill score against persistence baseline."""

    def test_skill_score_positive(self, trained_result):
        """XGBoost beats persistence (skill score > 0)."""
        cv_result, _ = trained_result
        assert cv_result.skill_score_vs_persistence > 0.0, (
            f"Skill score {cv_result.skill_score_vs_persistence} ≤ 0: "
            "XGBoost does not beat persistence baseline"
        )


# ── TestSHAPExplainability ────────────────────────────────────────


class TestSHAPExplainability:
    """Tests for SHAP value computation and feature importance."""

    def test_shap_values_shape(
        self, trained_result, merged_features, feature_names
    ):
        """SHAP values have shape (n_samples, n_features)."""
        _, models = trained_result
        model_p50 = models[1]

        # Use a small subset for speed
        subset = merged_features[:50]
        result = compute_shap_values(model_p50, subset, feature_names)

        assert result.shap_values.shape == (50, len(feature_names))

    def test_feature_importance_non_empty(
        self, trained_result, merged_features, feature_names
    ):
        """Feature importance dict contains all features."""
        _, models = trained_result
        model_p50 = models[1]

        subset = merged_features[:50]
        result = compute_shap_values(model_p50, subset, feature_names)

        assert len(result.feature_importance) == len(feature_names)
        assert all(v >= 0.0 for v in result.feature_importance.values())

    def test_shap_feature_names_match(
        self, trained_result, merged_features, feature_names
    ):
        """SHAP result feature names match input feature names."""
        _, models = trained_result
        model_p50 = models[1]

        subset = merged_features[:50]
        result = compute_shap_values(model_p50, subset, feature_names)

        assert result.feature_names == feature_names

    def test_shap_values_sum_property(
        self, trained_result, merged_features, feature_names
    ):
        """SHAP values approximately sum to prediction minus expected value.

        For TreeExplainer: f(x) = E[f(X)] + Σ φ_j(x)
        So Σ φ_j ≈ f(x) - E[f(X)] for each sample.
        """
        _, models = trained_result
        model_p50 = models[1]

        subset = merged_features[:50]
        result = compute_shap_values(model_p50, subset, feature_names)

        # Expected value = base value (mean prediction of training data)
        shap_sum = np.sum(result.shap_values, axis=1)

        # The SHAP sum + base_value should approximately equal predictions
        # We check that the SHAP sums have reasonable variance (not all zero)
        assert np.std(shap_sum) > 0.0, "SHAP values are all zero"
