"""
Tests for Temporal Fusion Transformer (TFT) wind power forecasting model.

Covers:
- Gated Residual Network (GRN) forward pass and skip connection
- Variable Selection Network (VSN) weight normalization
- Multi-Head Attention shape and weight extraction
- TFT training with TimeSeriesSplit cross-validation
- Native quantile regression (P10/P50/P90) monotonicity
- Probabilistic prediction with physical constraints
- Attention weight and variable importance extraction

Small test config for CI speed:
  lookback=24, hidden=16, heads=2, epochs=5, n_cv_splits=3
"""

from __future__ import annotations

import numpy as np
import pytest
import torch

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
from app.services.p4.tft_model import (
    GatedResidualNetwork,
    InterpretableMultiHeadAttention,
    TFTConfig,
    VariableSelectionNetwork,
    compute_attention_weights,
    predict_tft,
    train_tft,
)

# ── Shared Test Fixtures ──────────────────────────────────────────

SMALL_SCADA_CONFIG = SCADAConfig(num_turbines=2, num_timesteps=500, seed=42)
TURBINE_INDEX = 0

# Small TFT config for fast CI
SMALL_TFT_CONFIG = TFTConfig(
    lookback=24,
    hidden_size=16,
    num_attention_heads=2,
    dropout=0.1,
    learning_rate=0.005,
    epochs=5,
    patience=3,
    batch_size=32,
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
    return clean_power[-engineered.valid_timesteps :]


@pytest.fixture(scope="module")
def wind_speed(scada_dataset, filtered_data, engineered):
    """Extract wind speed aligned to feature matrix."""
    mask = filtered_data.clean_mask[:, TURBINE_INDEX]
    clean_wind = scada_dataset.wind_speed_ms[mask, TURBINE_INDEX]
    return clean_wind[-engineered.valid_timesteps :]


@pytest.fixture(scope="module")
def feature_names(engineered):
    """Full feature name list (SCADA + NWP)."""
    return engineered.feature_names + list(NWP_FEATURE_NAMES)


@pytest.fixture(scope="module")
def trained_result(merged_features, target_power):
    """Train TFT with small config for fast tests."""
    return train_tft(merged_features, target_power, SMALL_TFT_CONFIG)


# ── TestGRN ──────────────────────────────────────────────────────


class TestGRN:
    """Tests for Gated Residual Network building block."""

    def test_grn_output_shape(self):
        """GRN output has correct hidden_size dimension."""
        grn = GatedResidualNetwork(input_size=10, hidden_size=16)
        x = torch.randn(8, 10)
        out = grn(x)
        assert out.shape == (8, 16)

    def test_grn_skip_connection_same_dim(self):
        """GRN with same input/hidden dims uses identity skip."""
        grn = GatedResidualNetwork(input_size=16, hidden_size=16)
        assert grn.skip_proj is None

    def test_grn_skip_connection_diff_dim(self):
        """GRN with different input/hidden dims uses linear skip projection."""
        grn = GatedResidualNetwork(input_size=10, hidden_size=16)
        assert grn.skip_proj is not None


# ── TestVariableSelection ─────────────────────────────────────────


class TestVariableSelection:
    """Tests for Variable Selection Network."""

    def test_vsn_output_shape(self):
        """VSN output has correct hidden_size dimension."""
        vsn = VariableSelectionNetwork(n_features=5, hidden_size=16)
        x = torch.randn(8, 5)
        combined, weights = vsn(x)
        assert combined.shape == (8, 16)
        assert weights.shape == (8, 5)

    def test_vsn_weights_sum_to_one(self):
        """VSN softmax weights sum to 1.0 for each sample."""
        vsn = VariableSelectionNetwork(n_features=5, hidden_size=16)
        x = torch.randn(8, 5)
        _, weights = vsn(x)
        weight_sums = weights.sum(dim=-1)
        torch.testing.assert_close(weight_sums, torch.ones(8), atol=1e-5, rtol=1e-5)

    def test_vsn_weights_non_negative(self):
        """VSN weights are non-negative (softmax guarantees this)."""
        vsn = VariableSelectionNetwork(n_features=5, hidden_size=16)
        x = torch.randn(8, 5)
        _, weights = vsn(x)
        assert torch.all(weights >= 0.0)


# ── TestMultiHeadAttention ───────────────────────────────────────


class TestMultiHeadAttention:
    """Tests for Interpretable Multi-Head Attention."""

    def test_attention_output_shape(self):
        """Attention output preserves input shape."""
        attn = InterpretableMultiHeadAttention(d_model=16, n_heads=2)
        x = torch.randn(4, 10, 16)  # (batch, seq, d_model)
        out = attn(x, x, x)
        assert out.shape == (4, 10, 16)

    def test_attention_weights_stored(self):
        """Attention weights are stored for extraction after forward pass."""
        attn = InterpretableMultiHeadAttention(d_model=16, n_heads=2)
        x = torch.randn(4, 10, 16)
        attn(x, x, x)
        weights = attn.get_attention_weights()
        assert weights is not None
        assert weights.shape == (4, 10, 10)  # (batch, seq, seq)

    def test_attention_weights_sum_to_one(self):
        """Attention weights sum to ~1.0 along the key dimension.

        Note: weights are averaged across heads after dropout, so we allow
        a small tolerance for dropout-induced deviation during training mode.
        """
        attn = InterpretableMultiHeadAttention(d_model=16, n_heads=2, dropout=0.0)
        x = torch.randn(4, 10, 16)
        attn.eval()  # No dropout for this test
        attn(x, x, x)
        weights = attn.get_attention_weights()
        assert weights is not None
        row_sums = weights.sum(dim=-1)
        torch.testing.assert_close(row_sums, torch.ones_like(row_sums), atol=1e-5, rtol=1e-5)


# ── TestTFTTraining ──────────────────────────────────────────────


class TestTFTTraining:
    """Tests for TFT model training and cross-validation."""

    def test_training_completes(self, trained_result):
        """Model trains without error and returns results."""
        cv_result, model, norm_params = trained_result
        assert cv_result is not None
        assert model is not None
        assert norm_params is not None

    def test_cv_folds_count(self, trained_result):
        """CV produces the expected number of folds."""
        cv_result, _, _ = trained_result
        assert len(cv_result.fold_metrics) == SMALL_TFT_CONFIG.n_cv_splits

    def test_early_stopping_respected(self, trained_result):
        """Training epochs are <= max configured epochs."""
        cv_result, _, _ = trained_result
        for fold in cv_result.fold_metrics:
            assert fold.training_epochs <= SMALL_TFT_CONFIG.epochs

    def test_rmse_finite(self, trained_result):
        """RMSE values are finite (not NaN or Inf)."""
        cv_result, _, _ = trained_result
        assert np.isfinite(cv_result.mean_rmse_mw)
        for fold in cv_result.fold_metrics:
            assert np.isfinite(fold.rmse_mw)

    def test_architecture_summary(self, trained_result):
        """Architecture summary contains expected components."""
        cv_result, _, _ = trained_result
        summary = cv_result.architecture_summary
        assert "VSN" in summary
        assert "LSTM" in summary
        assert "MultiHeadAttn" in summary
        assert "Quantile" in summary


# ── TestTFTPrediction ────────────────────────────────────────────


class TestTFTPrediction:
    """Tests for probabilistic P10/P50/P90 TFT forecasting."""

    def test_quantile_monotonicity(self, trained_result, merged_features, wind_speed):
        """P10 <= P50 <= P90 for all timesteps."""
        _, model, norm_params = trained_result

        forecast = predict_tft(
            model,
            merged_features,
            wind_speed,
            norm_params,
            SMALL_TFT_CONFIG,
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

        forecast = predict_tft(
            model,
            merged_features,
            wind_speed,
            norm_params,
            SMALL_TFT_CONFIG,
        )

        assert np.all(forecast.power_p10_mw >= 0.0)
        assert np.all(forecast.power_p50_mw >= 0.0)
        assert np.all(forecast.power_p90_mw >= 0.0)

    def test_no_above_rated(self, trained_result, merged_features, wind_speed):
        """No prediction exceeds 15.0 MW (V236 rated power)."""
        _, model, norm_params = trained_result

        forecast = predict_tft(
            model,
            merged_features,
            wind_speed,
            norm_params,
            SMALL_TFT_CONFIG,
        )

        assert np.all(forecast.power_p10_mw <= DEFAULT_RATED_POWER_MW + 1e-9)
        assert np.all(forecast.power_p50_mw <= DEFAULT_RATED_POWER_MW + 1e-9)
        assert np.all(forecast.power_p90_mw <= DEFAULT_RATED_POWER_MW + 1e-9)

    def test_forecast_lengths_consistent(self, trained_result, merged_features, wind_speed):
        """All forecast arrays have the same length."""
        _, model, norm_params = trained_result

        forecast = predict_tft(
            model,
            merged_features,
            wind_speed,
            norm_params,
            SMALL_TFT_CONFIG,
        )

        n = len(forecast.power_p50_mw)
        assert n > 0
        assert len(forecast.power_p10_mw) == n
        assert len(forecast.power_p90_mw) == n
        assert len(forecast.wind_speed_ms) == n
        assert len(forecast.timestamps_utc) == n


# ── TestTFTPhysicalConstraints ──────────────────────────────────


class TestTFTPhysicalConstraints:
    """Tests for physical constraint enforcement on TFT predictions."""

    def test_zero_power_below_cut_in(self, trained_result, merged_features):
        """Power is zero when wind speed is below cut-in (3.0 m/s)."""
        _, model, norm_params = trained_result

        n = merged_features.shape[0]
        low_wind = np.full(n, 1.5, dtype=np.float64)

        forecast = predict_tft(
            model,
            merged_features,
            low_wind,
            norm_params,
            SMALL_TFT_CONFIG,
        )

        assert np.all(forecast.power_p10_mw == 0.0)
        assert np.all(forecast.power_p50_mw == 0.0)
        assert np.all(forecast.power_p90_mw == 0.0)


# ── TestTFTAttention ─────────────────────────────────────────────


class TestTFTAttention:
    """Tests for attention weight and variable importance extraction."""

    def test_attention_weights_shape(self, trained_result, merged_features, feature_names):
        """Temporal attention weights have correct shape."""
        _, model, norm_params = trained_result

        attn = compute_attention_weights(
            model,
            merged_features,
            norm_params,
            SMALL_TFT_CONFIG,
            feature_names,
        )

        assert attn.temporal_weights.ndim == 2
        assert attn.temporal_weights.shape[1] == SMALL_TFT_CONFIG.lookback

    def test_variable_importance_sums_to_one(self, trained_result, merged_features, feature_names):
        """Variable importance weights approximately sum to 1.0."""
        _, model, norm_params = trained_result

        attn = compute_attention_weights(
            model,
            merged_features,
            norm_params,
            SMALL_TFT_CONFIG,
            feature_names,
        )

        total = sum(attn.variable_importance.values())
        assert abs(total - 1.0) < 0.01, f"Variable importance sums to {total}, expected ~1.0"

    def test_variable_importance_has_all_features(
        self,
        trained_result,
        merged_features,
        feature_names,
    ):
        """Variable importance dict contains all feature names."""
        _, model, norm_params = trained_result

        attn = compute_attention_weights(
            model,
            merged_features,
            norm_params,
            SMALL_TFT_CONFIG,
            feature_names,
        )

        assert set(attn.variable_importance.keys()) == set(feature_names)

    def test_num_heads_matches_config(self, trained_result, merged_features, feature_names):
        """Reported number of heads matches configuration."""
        _, model, norm_params = trained_result

        attn = compute_attention_weights(
            model,
            merged_features,
            norm_params,
            SMALL_TFT_CONFIG,
            feature_names,
        )

        assert attn.num_heads == SMALL_TFT_CONFIG.num_attention_heads
