"""
LSTM wind power forecasting with MC Dropout uncertainty quantification.

Core deep learning service for P4. Trains a 2-layer LSTM to predict
wind turbine power output from sequential SCADA + NWP features.
Produces probabilistic forecasts (P10/P50/P90) via Monte Carlo Dropout.

Physics — Temporal Dependencies in Wind Power
-----------------------------------------------
Wind power is inherently sequential — the power at time t depends on
temporal patterns that unfold over hours:
  - Diurnal cycles: sea breezes reverse direction morning/evening
  - Weather fronts: power ramps of 10+ MW over 30-60 minutes
  - Turbulence regimes: high TI periods cluster in time
  - Wake meandering: wake effects shift with slowly-changing wind direction

The cubic wind-speed dependence P = ½ρACp(λ,β)v³ means that temporal
correlations in wind speed create complex, non-linear power sequences
that tabular models (XGBoost) cannot natively capture.

Standard — IEC 61400-26-1 Uncertainty & MC Dropout
----------------------------------------------------
IEC 61400-26-1 requires uncertainty quantification for power predictions.
MC Dropout (Gal & Ghahramani, 2016) provides a principled Bayesian
approximation: running T stochastic forward passes with dropout active
produces an ensemble of predictions whose statistics estimate:
  - Mean: E[P(t)] ≈ (1/T) Σ ŷ_t  — central forecast
  - Variance: Var[P(t)] ≈ (1/T) Σ (ŷ_t - μ)²  — epistemic uncertainty
  - Quantiles: P10 = μ - 1.2816σ, P90 = μ + 1.2816σ  (Gaussian z-scores)

This maps directly to operational decision-making:
  - P90: Conservative estimate for grid commitment
  - P50: Central forecast for energy trading
  - P10: Optimistic estimate for maintenance scheduling

Maths — LSTM Cell Equations
-----------------------------
At each timestep t, the LSTM cell computes:

  Forget gate:  f_t = σ(W_f · [h_{t-1}, x_t] + b_f)
  Input gate:   i_t = σ(W_i · [h_{t-1}, x_t] + b_i)
  Cell update:  c̃_t = tanh(W_c · [h_{t-1}, x_t] + b_c)
  Cell state:   c_t = f_t ⊙ c_{t-1} + i_t ⊙ c̃_t
  Output gate:  o_t = σ(W_o · [h_{t-1}, x_t] + b_o)
  Hidden state: h_t = o_t ⊙ tanh(c_t)

The forget gate selectively retains long-range dependencies (e.g.,
a 6-hour weather front pattern), while the input gate decides what
new information to store from the current timestep.

MC Dropout quantile derivation:
  μ = (1/T) Σ_{t=1}^T ŷ_t
  σ² = (1/T) Σ_{t=1}^T (ŷ_t - μ)²
  P10 = μ - z_{0.90} × σ = μ - 1.2816σ
  P50 = μ  (median ≈ mean for symmetric distributions)
  P90 = μ + z_{0.90} × σ = μ + 1.2816σ

TimeSeriesSplit ensures no future leakage (same as XGBoost):
  Fold k: train [0..k·N/(K+1)], test [k·N/(K+1)..(k+1)·N/(K+1)]

References
----------
- Hochreiter & Schmidhuber, "Long Short-Term Memory" (Neural Computation, 1997)
- Gal & Ghahramani, "Dropout as a Bayesian Approximation" (ICML 2016)
- IEC 61400-26-1: Time-based availability for wind turbines
- Roadmap §5.8: LSTM model, §5.11: Skill score
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import torch
import torch.nn as nn
from numpy.lib.stride_tricks import sliding_window_view
from numpy.typing import NDArray
from sklearn.model_selection import TimeSeriesSplit

from app.services.p4.physical_constraints import enforce_physical_constraints

# ── Constants ─────────────────────────────────────────────────────

# Gaussian z-score for 90th percentile (P10/P90 symmetric bounds)
Z_90: float = 1.2816


# ── Data Classes ──────────────────────────────────────────────────


@dataclass(frozen=True)
class LSTMConfig:
    """Configuration for LSTM wind power forecasting model.

    Attributes
    ----------
    lookback : int
        Number of past timesteps in each input sequence.
        Default 144 = 24 hours at 10-minute resolution.
    hidden_units : tuple[int, int]
        Number of hidden units in (layer 1, layer 2).
    dropout : float
        Dropout rate between LSTM layers and for MC inference.
    learning_rate : float
        Adam optimizer learning rate.
    epochs : int
        Maximum training epochs.
    patience : int
        Early stopping patience (epochs without improvement).
    batch_size : int
        Mini-batch size for training.
    mc_samples : int
        Number of MC Dropout forward passes for uncertainty estimation.
    n_cv_splits : int
        Number of TimeSeriesSplit folds.
    seed : int
        Random seed for reproducibility.
    """

    lookback: int = 144
    hidden_units: tuple[int, int] = (64, 32)
    dropout: float = 0.2
    learning_rate: float = 0.001
    epochs: int = 100
    patience: int = 10
    batch_size: int = 64
    mc_samples: int = 100
    n_cv_splits: int = 5
    seed: int = 42


@dataclass(frozen=True)
class LSTMFoldMetrics:
    """Performance metrics for a single CV fold.

    Attributes
    ----------
    fold_index : int
        Zero-based fold number.
    rmse_mw : float
        Root Mean Square Error [MW].
    mae_mw : float
        Mean Absolute Error [MW].
    mape_pct : float
        Mean Absolute Percentage Error [%].
    r_squared : float
        Coefficient of determination R².
    training_epochs : int
        Actual number of training epochs (may be less due to early stopping).
    """

    fold_index: int
    rmse_mw: float
    mae_mw: float
    mape_pct: float
    r_squared: float
    training_epochs: int


@dataclass(frozen=True)
class LSTMCVResult:
    """Cross-validation results across all folds.

    Attributes
    ----------
    fold_metrics : list[LSTMFoldMetrics]
        Per-fold performance metrics.
    mean_rmse_mw : float
        Mean RMSE across all folds [MW].
    mean_mae_mw : float
        Mean MAE across all folds [MW].
    mean_mape_pct : float
        Mean MAPE across all folds [%].
    mean_r_squared : float
        Mean R² across all folds.
    skill_score_vs_persistence : float
        Skill score vs persistence baseline.
        SS = 1 - RMSE_model / RMSE_persistence. SS > 0 = model wins.
    architecture_summary : str
        Human-readable description of the LSTM architecture.
    """

    fold_metrics: list[LSTMFoldMetrics]
    mean_rmse_mw: float
    mean_mae_mw: float
    mean_mape_pct: float
    mean_r_squared: float
    skill_score_vs_persistence: float
    architecture_summary: str


@dataclass(frozen=True)
class LSTMForecastResult:
    """Probabilistic power forecast output from MC Dropout.

    Attributes
    ----------
    power_p10_mw : NDArray[np.float64]
        P10 (10th percentile) power forecast [MW].
    power_p50_mw : NDArray[np.float64]
        P50 (median) power forecast [MW].
    power_p90_mw : NDArray[np.float64]
        P90 (90th percentile) power forecast [MW].
    mc_mean_mw : NDArray[np.float64]
        MC Dropout mean prediction [MW].
    mc_std_mw : NDArray[np.float64]
        MC Dropout standard deviation [MW].
    wind_speed_ms : NDArray[np.float64]
        Input wind speed used for constraint enforcement [m/s].
    timestamps_utc : NDArray[np.int64]
        Timestamps for the forecast period.
    """

    power_p10_mw: NDArray[np.float64]
    power_p50_mw: NDArray[np.float64]
    power_p90_mw: NDArray[np.float64]
    mc_mean_mw: NDArray[np.float64]
    mc_std_mw: NDArray[np.float64]
    wind_speed_ms: NDArray[np.float64]
    timestamps_utc: NDArray[np.int64]


@dataclass(frozen=True)
class MCDropoutDetail:
    """Detailed MC Dropout results for uncertainty visualization.

    Attributes
    ----------
    all_passes : NDArray[np.float64]
        All MC forward passes, shape (mc_samples, n_steps).
    mean_mw : NDArray[np.float64]
        Mean across MC passes [MW].
    std_mw : NDArray[np.float64]
        Standard deviation across MC passes [MW].
    num_passes : int
        Number of MC forward passes performed.
    """

    all_passes: NDArray[np.float64]
    mean_mw: NDArray[np.float64]
    std_mw: NDArray[np.float64]
    num_passes: int


@dataclass(frozen=True)
class NormParams:
    """Min-max normalization parameters for reproducible denormalization.

    Attributes
    ----------
    feature_min : NDArray[np.float64]
        Per-feature minimum values, shape (n_features,).
    feature_max : NDArray[np.float64]
        Per-feature maximum values, shape (n_features,).
    target_min : float
        Target variable minimum.
    target_max : float
        Target variable maximum.
    """

    feature_min: NDArray[np.float64] = field(default_factory=lambda: np.array([]))
    feature_max: NDArray[np.float64] = field(default_factory=lambda: np.array([]))
    target_min: float = 0.0
    target_max: float = 1.0


# ── PyTorch Model ─────────────────────────────────────────────────


class WindPowerLSTM(nn.Module):  # type: ignore[misc]
    """2-layer LSTM for wind power forecasting with MC Dropout.

    Architecture: Input → LSTM(h1) → Dropout → LSTM(h2) → Dropout → Dense(1)

    The key for MC Dropout: dropout remains ACTIVE during inference
    by keeping the model in train() mode. Each forward pass samples
    a different sub-network, producing prediction variability that
    estimates epistemic uncertainty.
    """

    def __init__(
        self,
        n_features: int,
        hidden_units: tuple[int, int] = (64, 32),
        dropout: float = 0.2,
    ) -> None:
        super().__init__()
        h1, h2 = hidden_units

        # Layer 1: Input → LSTM with h1 units
        self.lstm1 = nn.LSTM(
            input_size=n_features,
            hidden_size=h1,
            batch_first=True,
        )
        self.dropout1 = nn.Dropout(p=dropout)

        # Layer 2: LSTM with h2 units
        self.lstm2 = nn.LSTM(
            input_size=h1,
            hidden_size=h2,
            batch_first=True,
        )
        self.dropout2 = nn.Dropout(p=dropout)

        # Output: Dense(1) — single power prediction
        self.fc = nn.Linear(h2, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass through the LSTM network.

        Parameters
        ----------
        x : torch.Tensor
            Input tensor, shape (batch, lookback, n_features).

        Returns
        -------
        torch.Tensor
            Power prediction, shape (batch, 1).
        """
        # LSTM layer 1
        out, _ = self.lstm1(x)
        out = self.dropout1(out)

        # LSTM layer 2
        out, _ = self.lstm2(out)
        out = self.dropout2(out)

        # Take the last timestep's output
        out = out[:, -1, :]

        # Dense output layer
        result: torch.Tensor = self.fc(out)
        return result


# ── Helper Functions ──────────────────────────────────────────────


def create_sequences(
    features: NDArray[np.float64],
    target: NDArray[np.float64],
    lookback: int = 144,
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Create sliding window sequences for LSTM input.

    Converts 2D (n_samples, n_features) into 3D (n_sequences, lookback, n_features)
    using a sliding window. Each sequence X[i] maps to target y[i + lookback - 1].

    Parameters
    ----------
    features : NDArray[np.float64]
        Feature matrix, shape (n_samples, n_features).
    target : NDArray[np.float64]
        Target values, shape (n_samples,).
    lookback : int
        Number of past timesteps per sequence.

    Returns
    -------
    tuple of (NDArray, NDArray)
        X: shape (n_sequences, lookback, n_features)
        y: shape (n_sequences,)
    """
    n_samples = features.shape[0]

    if n_samples < lookback:
        return (
            np.empty((0, lookback, features.shape[1]), dtype=np.float64),
            np.empty((0,), dtype=np.float64),
        )

    # Vectorized sliding window — creates (n_sequences, n_features, lookback) view
    # then transpose to (n_sequences, lookback, n_features) with contiguous copy
    x = sliding_window_view(features, lookback, axis=0)  # (n_seq, n_feat, lookback)
    x = np.moveaxis(x, -1, 1).copy()  # (n_seq, lookback, n_feat) — contiguous for PyTorch
    y = target[lookback - 1 :].copy()

    return x, y


def _normalize_features(
    features: NDArray[np.float64],
    target: NDArray[np.float64],
) -> tuple[NDArray[np.float64], NDArray[np.float64], NormParams]:
    """Min-max normalize features and target to [0, 1].

    Parameters
    ----------
    features : NDArray[np.float64]
        Feature matrix, shape (n_samples, n_features).
    target : NDArray[np.float64]
        Target values, shape (n_samples,).

    Returns
    -------
    tuple of (normalized_features, normalized_target, NormParams)
    """
    f_min = features.min(axis=0)
    f_max = features.max(axis=0)

    # Avoid division by zero for constant features
    f_range = f_max - f_min
    f_range[f_range == 0] = 1.0

    norm_features = (features - f_min) / f_range

    t_min = float(target.min())
    t_max = float(target.max())
    t_range = t_max - t_min if t_max != t_min else 1.0
    norm_target = (target - t_min) / t_range

    params = NormParams(
        feature_min=f_min,
        feature_max=f_max,
        target_min=t_min,
        target_max=t_max,
    )

    return norm_features, norm_target, params


def _normalize_features_with_params(
    features: NDArray[np.float64],
    params: NormParams,
) -> NDArray[np.float64]:
    """Normalize features using pre-computed parameters.

    Parameters
    ----------
    features : NDArray[np.float64]
        Feature matrix to normalize.
    params : NormParams
        Pre-computed normalization parameters.

    Returns
    -------
    NDArray[np.float64]
        Normalized feature matrix.
    """
    f_range = params.feature_max - params.feature_min
    f_range[f_range == 0] = 1.0
    return (features - params.feature_min) / f_range


def _denormalize_power(
    normalized: NDArray[np.float64],
    params: NormParams,
) -> NDArray[np.float64]:
    """Reverse min-max normalization for power predictions.

    Parameters
    ----------
    normalized : NDArray[np.float64]
        Normalized power values in [0, 1].
    params : NormParams
        Normalization parameters with target_min and target_max.

    Returns
    -------
    NDArray[np.float64]
        Power values in original scale [MW].
    """
    t_range = params.target_max - params.target_min
    if t_range == 0:
        t_range = 1.0
    return normalized * t_range + params.target_min


def _build_lstm_model(
    n_features: int,
    config: LSTMConfig,
) -> WindPowerLSTM:
    """Construct a WindPowerLSTM model.

    Parameters
    ----------
    n_features : int
        Number of input features per timestep.
    config : LSTMConfig
        Model configuration.

    Returns
    -------
    WindPowerLSTM
        Initialized LSTM model.
    """
    torch.manual_seed(config.seed)
    model = WindPowerLSTM(
        n_features=n_features,
        hidden_units=config.hidden_units,
        dropout=config.dropout,
    )
    return model


def _compute_metrics(
    y_true: NDArray[np.float64],
    y_pred: NDArray[np.float64],
    fold_index: int,
    training_epochs: int,
) -> LSTMFoldMetrics:
    """Compute regression metrics for a single fold."""
    residuals = y_true - y_pred

    rmse = float(np.sqrt(np.mean(residuals**2)))
    mae = float(np.mean(np.abs(residuals)))

    # MAPE: avoid division by zero for near-zero actual values
    nonzero_mask = np.abs(y_true) > 0.1
    if np.any(nonzero_mask):
        mape = float(np.mean(np.abs(residuals[nonzero_mask] / y_true[nonzero_mask])) * 100.0)
    else:
        mape = 0.0

    # R²: 1 - SS_res / SS_tot
    ss_res = float(np.sum(residuals**2))
    ss_tot = float(np.sum((y_true - np.mean(y_true)) ** 2))
    r_squared = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0

    return LSTMFoldMetrics(
        fold_index=fold_index,
        rmse_mw=round(rmse, 4),
        mae_mw=round(mae, 4),
        mape_pct=round(mape, 2),
        r_squared=round(r_squared, 4),
        training_epochs=training_epochs,
    )


def _compute_persistence_rmse(target: NDArray[np.float64]) -> float:
    """Compute RMSE for persistence baseline: P(t+1) = P(t)."""
    if len(target) < 2:
        return 0.0
    return float(np.sqrt(np.mean((target[1:] - target[:-1]) ** 2)))


def _train_single_fold(
    x_train: torch.Tensor,
    y_train: torch.Tensor,
    x_val: torch.Tensor,
    y_val: torch.Tensor,
    n_features: int,
    config: LSTMConfig,
) -> tuple[WindPowerLSTM, int]:
    """Train a single LSTM model on one fold.

    Returns the trained model and the number of actual training epochs.
    """
    model = _build_lstm_model(n_features, config)
    optimizer = torch.optim.Adam(model.parameters(), lr=config.learning_rate)
    loss_fn = nn.MSELoss()

    best_val_loss = float("inf")
    patience_counter = 0
    actual_epochs = 0

    # Create DataLoader for mini-batch training
    train_dataset = torch.utils.data.TensorDataset(x_train, y_train)
    train_loader = torch.utils.data.DataLoader(
        train_dataset,
        batch_size=config.batch_size,
        shuffle=False,  # Time series: preserve order within batches
    )

    for epoch in range(config.epochs):
        # Training phase
        model.train()
        for batch_x, batch_y in train_loader:
            optimizer.zero_grad()
            pred = model(batch_x).squeeze(-1)
            loss = loss_fn(pred, batch_y)
            loss.backward()
            optimizer.step()

        actual_epochs = epoch + 1

        # Validation phase (no dropout for fair evaluation)
        model.eval()
        with torch.no_grad():
            val_pred = model(x_val).squeeze(-1)
            val_loss = loss_fn(val_pred, y_val).item()

        # Early stopping
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_counter = 0
        else:
            patience_counter += 1
            if patience_counter >= config.patience:
                break

    return model, actual_epochs


# ── Public API ────────────────────────────────────────────────────


def train_lstm(
    features: NDArray[np.float64],
    target_power_mw: NDArray[np.float64],
    config: LSTMConfig | None = None,
) -> tuple[LSTMCVResult, WindPowerLSTM, NormParams]:
    """Train LSTM model with TimeSeriesSplit cross-validation.

    Normalizes data, creates sequences, and trains across CV folds.
    Returns CV metrics, the model from the last fold, and normalization
    parameters for inference.

    Parameters
    ----------
    features : NDArray[np.float64]
        Feature matrix, shape (n_samples, n_features).
    target_power_mw : NDArray[np.float64]
        Target power values [MW], shape (n_samples,).
    config : LSTMConfig, optional
        Model configuration. Uses defaults if None.

    Returns
    -------
    tuple of (LSTMCVResult, WindPowerLSTM, NormParams)
        CV metrics, trained model (last fold), and normalization params.
    """
    if config is None:
        config = LSTMConfig()

    # Normalize before sequencing — all sliding window values on same scale
    norm_features, norm_target, norm_params = _normalize_features(features, target_power_mw)

    # Create sequences
    x_seq, y_seq = create_sequences(norm_features, norm_target, config.lookback)

    if x_seq.shape[0] == 0:
        msg = (
            f"Not enough samples ({features.shape[0]}) for lookback={config.lookback}. "
            f"Need at least {config.lookback} samples."
        )
        raise ValueError(msg)

    n_features = features.shape[1]

    # TimeSeriesSplit cross-validation
    tscv = TimeSeriesSplit(n_splits=config.n_cv_splits)
    fold_metrics_list: list[LSTMFoldMetrics] = []
    last_model: WindPowerLSTM | None = None

    for fold_idx, (train_idx, test_idx) in enumerate(tscv.split(x_seq)):
        x_train_np = x_seq[train_idx]
        y_train_np = y_seq[train_idx]
        x_test_np = x_seq[test_idx]
        y_test_np = y_seq[test_idx]

        # Convert to tensors
        x_train_t = torch.tensor(x_train_np, dtype=torch.float32)
        y_train_t = torch.tensor(y_train_np, dtype=torch.float32)
        x_test_t = torch.tensor(x_test_np, dtype=torch.float32)

        # Train
        model, actual_epochs = _train_single_fold(
            x_train_t,
            y_train_t,
            x_test_t,
            torch.tensor(y_test_np, dtype=torch.float32),
            n_features,
            config,
        )

        # Evaluate (no dropout for fair metrics)
        model.eval()
        with torch.no_grad():
            y_pred_norm = model(x_test_t).squeeze(-1).numpy()

        # Denormalize for metrics
        y_pred_mw = _denormalize_power(y_pred_norm, norm_params)
        y_true_mw = _denormalize_power(y_test_np, norm_params)

        metrics = _compute_metrics(y_true_mw, y_pred_mw, fold_idx, actual_epochs)
        fold_metrics_list.append(metrics)
        last_model = model

    assert last_model is not None

    # Aggregate metrics
    mean_rmse = float(np.mean([m.rmse_mw for m in fold_metrics_list]))
    mean_mae = float(np.mean([m.mae_mw for m in fold_metrics_list]))
    mean_mape = float(np.mean([m.mape_pct for m in fold_metrics_list]))
    mean_r2 = float(np.mean([m.r_squared for m in fold_metrics_list]))

    # Skill score vs persistence
    persistence_rmse = _compute_persistence_rmse(target_power_mw)
    skill_score = 1.0 - mean_rmse / persistence_rmse if persistence_rmse > 0 else 0.0

    h1, h2 = config.hidden_units
    arch_summary = (
        f"LSTM({h1}) → Dropout({config.dropout}) → "
        f"LSTM({h2}) → Dropout({config.dropout}) → Dense(1) | "
        f"lookback={config.lookback}, lr={config.learning_rate}, "
        f"batch={config.batch_size}"
    )

    cv_result = LSTMCVResult(
        fold_metrics=fold_metrics_list,
        mean_rmse_mw=round(mean_rmse, 4),
        mean_mae_mw=round(mean_mae, 4),
        mean_mape_pct=round(mean_mape, 2),
        mean_r_squared=round(mean_r2, 4),
        skill_score_vs_persistence=round(skill_score, 4),
        architecture_summary=arch_summary,
    )

    return cv_result, last_model, norm_params


def predict_lstm(
    model: WindPowerLSTM,
    features: NDArray[np.float64],
    wind_speed_ms: NDArray[np.float64],
    norm_params: NormParams,
    config: LSTMConfig | None = None,
    timestamps_utc: NDArray[np.int64] | None = None,
) -> LSTMForecastResult:
    """Generate probabilistic power forecast using MC Dropout.

    Runs `mc_samples` stochastic forward passes with dropout active,
    then derives P10/P50/P90 from Gaussian z-scores on the MC statistics.
    Physical constraints are applied after denormalization.

    Parameters
    ----------
    model : WindPowerLSTM
        Trained LSTM model.
    features : NDArray[np.float64]
        Feature matrix, shape (n_samples, n_features).
    wind_speed_ms : NDArray[np.float64]
        Wind speed for constraint enforcement, shape (n_samples,).
    norm_params : NormParams
        Normalization parameters from training.
    config : LSTMConfig, optional
        Configuration (for mc_samples and lookback).
    timestamps_utc : NDArray[np.int64], optional
        Timestamps for the forecast period.

    Returns
    -------
    LSTMForecastResult
        Probabilistic forecast with physical constraints applied.
    """
    if config is None:
        config = LSTMConfig()

    mc_detail = compute_mc_dropout_detail(model, features, norm_params, config)

    mc_mean = mc_detail.mean_mw
    mc_std = mc_detail.std_mw

    # Gaussian quantiles from MC statistics
    p10_raw = mc_mean - Z_90 * mc_std
    p50_raw = mc_mean.copy()
    p90_raw = mc_mean + Z_90 * mc_std

    # Wind speed for sequences: use the last value in each lookback window
    n_seq = len(mc_mean)
    if len(wind_speed_ms) >= config.lookback + n_seq - 1:
        seq_wind = wind_speed_ms[config.lookback - 1 : config.lookback - 1 + n_seq]
    else:
        seq_wind = wind_speed_ms[-n_seq:]

    # Apply physical constraints to each quantile
    p10_result = enforce_physical_constraints(power_mw=p10_raw, wind_speed_ms=seq_wind)
    p50_result = enforce_physical_constraints(power_mw=p50_raw, wind_speed_ms=seq_wind)
    p90_result = enforce_physical_constraints(power_mw=p90_raw, wind_speed_ms=seq_wind)

    p10 = p10_result.power_mw
    p50 = p50_result.power_mw
    p90 = p90_result.power_mw

    # Enforce monotonicity: P10 ≤ P50 ≤ P90
    p50 = np.maximum(p50, p10)
    p90 = np.maximum(p90, p50)

    if timestamps_utc is None:
        start = 1_704_067_200
        timestamps_utc = np.arange(start, start + n_seq * 600, 600, dtype=np.int64)
    else:
        timestamps_utc = timestamps_utc[-n_seq:]

    return LSTMForecastResult(
        power_p10_mw=p10,
        power_p50_mw=p50,
        power_p90_mw=p90,
        mc_mean_mw=mc_mean,
        mc_std_mw=mc_std,
        wind_speed_ms=seq_wind,
        timestamps_utc=timestamps_utc,
    )


def compute_mc_dropout_detail(
    model: WindPowerLSTM,
    features: NDArray[np.float64],
    norm_params: NormParams,
    config: LSTMConfig | None = None,
) -> MCDropoutDetail:
    """Run MC Dropout forward passes and return all pass details.

    Keeps model in train() mode so dropout is active during inference.
    Each forward pass samples a different dropout mask, producing an
    ensemble of predictions that estimates epistemic uncertainty.

    Parameters
    ----------
    model : WindPowerLSTM
        Trained LSTM model.
    features : NDArray[np.float64]
        Feature matrix, shape (n_samples, n_features).
    norm_params : NormParams
        Normalization parameters from training.
    config : LSTMConfig, optional
        Configuration (for mc_samples and lookback).

    Returns
    -------
    MCDropoutDetail
        All MC passes and summary statistics.
    """
    if config is None:
        config = LSTMConfig()

    # Normalize features using training parameters
    norm_features = _normalize_features_with_params(features, norm_params)

    # Create sequences (target not needed for prediction)
    dummy_target = np.zeros(features.shape[0], dtype=np.float64)
    x_seq, _ = create_sequences(norm_features, dummy_target, config.lookback)

    if x_seq.shape[0] == 0:
        return MCDropoutDetail(
            all_passes=np.empty((0, 0), dtype=np.float64),
            mean_mw=np.empty(0, dtype=np.float64),
            std_mw=np.empty(0, dtype=np.float64),
            num_passes=0,
        )

    x_tensor = torch.tensor(x_seq, dtype=torch.float32)

    # MC Dropout: keep model in train() mode for active dropout
    # Batched: process `chunk_size` passes at once by repeating the input.
    # Each copy gets an independent dropout mask because model.forward()
    # initialises hidden state to zeros (stateless LSTM).
    model.train()
    all_passes: list[NDArray[np.float64]] = []
    chunk_size = 10

    for chunk_start in range(0, config.mc_samples, chunk_size):
        chunk_n = min(chunk_size, config.mc_samples - chunk_start)
        x_repeated = x_tensor.repeat(chunk_n, 1, 1)  # (chunk_n * n_seq, lookback, n_feat)
        with torch.no_grad():
            pred_norm = model(x_repeated).squeeze(-1).numpy()  # (chunk_n * n_seq,)
        pred_norm = pred_norm.reshape(chunk_n, -1)  # (chunk_n, n_seq)
        for i in range(chunk_n):
            pred_mw = _denormalize_power(pred_norm[i], norm_params)
            all_passes.append(pred_mw)

    all_passes_array = np.array(all_passes, dtype=np.float64)  # (mc_samples, n_steps)
    mc_mean = np.mean(all_passes_array, axis=0)
    mc_std = np.std(all_passes_array, axis=0)

    return MCDropoutDetail(
        all_passes=all_passes_array,
        mean_mw=mc_mean,
        std_mw=mc_std,
        num_passes=config.mc_samples,
    )
