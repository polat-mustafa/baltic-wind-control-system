"""
Temporal Fusion Transformer (TFT) for multi-horizon wind power forecasting.

Core deep learning service for P4. Builds a simplified TFT that predicts
wind turbine power output across multiple horizons with native quantile
regression (P10/P50/P90) and interpretable attention weights.

Physics — Multi-Horizon Temporal Patterns in Wind Power
---------------------------------------------------------
Wind power forecasting requires different strategies at different horizons:
  - 1–6 hours: Persistence + local SCADA features dominate (autocorrelation)
  - 6–24 hours: Synoptic-scale weather (NWP) becomes critical
  - 24–48 hours: Regime shifts (frontal passages) drive forecast skill

The cubic wind-speed dependence P = ½ρACp(λ,β)v³ means that forecast
errors grow non-linearly with horizon. A model that natively handles
multiple horizons avoids the error accumulation of recursive single-step
models (like vanilla LSTM).

The TFT architecture addresses this by:
  1. Variable Selection Network: learns which features matter per horizon
  2. LSTM Encoder: captures local temporal context
  3. Multi-Head Attention: detects long-range patterns (fronts, diurnal)
  4. Quantile Outputs: native P10/P50/P90 without MC sampling

Standard — IEC 61400-26-1 & TFT Architecture
----------------------------------------------
IEC 61400-26-1 requires uncertainty quantification for power predictions.
TFT uses quantile regression (pinball loss) directly in the loss function,
producing calibrated prediction intervals without post-hoc approximation.

The TFT architecture (Lim et al., 2021) combines:
  - Gated Residual Networks (GRN) for non-linear processing with skip connections
  - Variable Selection Networks (VSN) for per-feature importance gating
  - Interpretable Multi-Head Attention for temporal pattern detection
  - Direct multi-horizon output (no autoregressive decoding)

Maths — TFT Component Equations
---------------------------------
Gated Residual Network (GRN):
  η₁ = W₁x + b₁
  η₂ = W₂·ELU(η₁) + b₂
  GRN(x) = LayerNorm(x + GLU(η₂))

  where GLU(a,b) = a ⊙ σ(b) is the Gated Linear Unit.

Variable Selection Network (VSN):
  v_j = GRN_j(ξ_j)           for each feature j
  weights = Softmax(GRN_w(Flatten(ξ)))
  VSN(ξ) = Σ_j weights_j × v_j

Multi-Head Attention:
  Attention(Q,K,V) = softmax(QKᵀ/√d_k)V
  MultiHead(Q,K,V) = Concat(head₁,...,headₕ)W^O
  where head_i = Attention(QW_i^Q, KW_i^K, VW_i^V)

Quantile Loss (Pinball):
  L_τ(y, ŷ) = τ × max(y-ŷ, 0) + (1-τ) × max(ŷ-y, 0)
  L_total = Σ_τ∈{0.1,0.5,0.9} L_τ(y, ŷ_τ)

TimeSeriesSplit ensures no future leakage (same as XGBoost/LSTM):
  Fold k: train [0..k·N/(K+1)], test [k·N/(K+1)..(k+1)·N/(K+1)]

References
----------
- Lim et al., "Temporal Fusion Transformers for Interpretable Multi-horizon
  Time Series Forecasting" (Int. J. Forecasting, 2021)
- Vaswani et al., "Attention Is All You Need" (NeurIPS 2017)
- IEC 61400-26-1: Time-based availability for wind turbines
- Roadmap §5.6: TFT model, §5.7: Quantile regression, §5.10: Attention
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np
import torch
import torch.nn as nn
from numpy.typing import NDArray
from sklearn.model_selection import TimeSeriesSplit

from app.services.p4.lstm_model import (
    NormParams,
    _denormalize_power,
    _normalize_features,
    _normalize_features_with_params,
    create_sequences,
)
from app.services.p4.physical_constraints import enforce_physical_constraints

# ── Constants ─────────────────────────────────────────────────────

DEFAULT_QUANTILES: tuple[float, ...] = (0.10, 0.50, 0.90)


# ── Data Classes ──────────────────────────────────────────────────


@dataclass(frozen=True)
class TFTConfig:
    """Configuration for TFT wind power forecasting model.

    Attributes
    ----------
    lookback : int
        Number of past timesteps in each input sequence.
        Default 72 = 12 hours at 10-minute resolution.
    hidden_size : int
        Hidden dimension for GRN, attention, and LSTM layers.
    num_attention_heads : int
        Number of parallel attention heads.
    dropout : float
        Dropout rate for GRN and attention layers.
    learning_rate : float
        Adam optimizer learning rate.
    epochs : int
        Maximum training epochs.
    patience : int
        Early stopping patience (epochs without improvement).
    batch_size : int
        Mini-batch size for training.
    quantiles : tuple[float, ...]
        Quantile levels for probabilistic forecasting.
    n_cv_splits : int
        Number of TimeSeriesSplit folds.
    seed : int
        Random seed for reproducibility.
    """

    lookback: int = 72
    hidden_size: int = 32
    num_attention_heads: int = 2
    dropout: float = 0.1
    learning_rate: float = 0.001
    epochs: int = 100
    patience: int = 10
    batch_size: int = 64
    quantiles: tuple[float, ...] = DEFAULT_QUANTILES
    n_cv_splits: int = 5
    seed: int = 42


@dataclass(frozen=True)
class TFTFoldMetrics:
    """Performance metrics for a single CV fold.

    Attributes
    ----------
    fold_index : int
        Zero-based fold number.
    rmse_mw : float
        Root Mean Square Error [MW] (on P50 quantile).
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
class TFTCVResult:
    """Cross-validation results across all folds.

    Attributes
    ----------
    fold_metrics : list[TFTFoldMetrics]
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
        Human-readable description of the TFT architecture.
    """

    fold_metrics: list[TFTFoldMetrics]
    mean_rmse_mw: float
    mean_mae_mw: float
    mean_mape_pct: float
    mean_r_squared: float
    skill_score_vs_persistence: float
    architecture_summary: str


@dataclass(frozen=True)
class TFTForecastResult:
    """Probabilistic power forecast output from TFT quantile regression.

    Attributes
    ----------
    power_p10_mw : NDArray[np.float64]
        P10 (10th percentile) power forecast [MW].
    power_p50_mw : NDArray[np.float64]
        P50 (median) power forecast [MW].
    power_p90_mw : NDArray[np.float64]
        P90 (90th percentile) power forecast [MW].
    wind_speed_ms : NDArray[np.float64]
        Input wind speed used for constraint enforcement [m/s].
    timestamps_utc : NDArray[np.int64]
        Timestamps for the forecast period.
    """

    power_p10_mw: NDArray[np.float64]
    power_p50_mw: NDArray[np.float64]
    power_p90_mw: NDArray[np.float64]
    wind_speed_ms: NDArray[np.float64]
    timestamps_utc: NDArray[np.int64]


@dataclass(frozen=True)
class AttentionWeights:
    """Attention weight analysis for TFT explainability.

    Attributes
    ----------
    temporal_weights : NDArray[np.float64]
        Attention weights over timesteps, shape (n_steps, lookback).
        Shows which past timesteps the model focuses on.
    variable_importance : dict[str, float]
        Per-feature importance from Variable Selection Network.
        Sum = 1.0 (softmax normalized). Higher = more important.
    num_heads : int
        Number of attention heads used.
    """

    temporal_weights: NDArray[np.float64]
    variable_importance: dict[str, float] = field(default_factory=dict)
    num_heads: int = 2


# ── PyTorch Modules ──────────────────────────────────────────────


class GatedResidualNetwork(nn.Module):  # type: ignore[misc]
    """Gated Residual Network (GRN) — the fundamental building block of TFT.

    GRN applies non-linear processing with a gated skip connection:
      η₁ = W₁x + b₁
      η₂ = W₂·ELU(η₁) + b₂
      GRN(x) = LayerNorm(x + GLU(η₂))

    The GLU (Gated Linear Unit) controls information flow, allowing
    the network to suppress irrelevant inputs entirely (gate → 0).
    The skip connection preserves gradient flow for training stability.
    """

    def __init__(self, input_size: int, hidden_size: int, dropout: float = 0.1) -> None:
        super().__init__()
        self.fc1 = nn.Linear(input_size, hidden_size)
        self.elu = nn.ELU()
        # GLU splits output into two halves: one for value, one for gate
        self.fc2 = nn.Linear(hidden_size, hidden_size * 2)
        self.dropout = nn.Dropout(p=dropout)
        self.layer_norm = nn.LayerNorm(hidden_size)
        # Project input to hidden_size if dimensions differ (for skip connection)
        self.skip_proj = nn.Linear(input_size, hidden_size) if input_size != hidden_size else None

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass through GRN.

        Parameters
        ----------
        x : torch.Tensor
            Input tensor, shape (..., input_size).

        Returns
        -------
        torch.Tensor
            Output tensor, shape (..., hidden_size).
        """
        # Non-linear transformation
        eta1 = self.fc1(x)
        eta2 = self.fc2(self.elu(eta1))

        # Gated Linear Unit: split into value and gate
        value, gate = eta2.chunk(2, dim=-1)
        gated = value * torch.sigmoid(gate)
        gated = self.dropout(gated)

        # Skip connection (project input if needed)
        skip = self.skip_proj(x) if self.skip_proj is not None else x

        # Residual + layer norm
        result: torch.Tensor = self.layer_norm(skip + gated)
        return result


class VariableSelectionNetwork(nn.Module):  # type: ignore[misc]
    """Variable Selection Network (VSN) — learns per-feature importance.

    VSN determines which input features are most relevant by computing
    softmax weights over all features and applying them as a weighted sum.
    This provides built-in feature importance without external tools (SHAP).

    For wind power: the VSN might learn to weight NWP wind speed heavily
    for 24h horizons while weighting SCADA power lags for 1h horizons.
    """

    def __init__(self, n_features: int, hidden_size: int, dropout: float = 0.1) -> None:
        super().__init__()
        self.n_features = n_features
        self.hidden_size = hidden_size

        # Per-feature GRN: transforms each feature independently
        self.feature_grns = nn.ModuleList(
            [GatedResidualNetwork(1, hidden_size, dropout) for _ in range(n_features)]
        )

        # Weight GRN: computes selection weights from flattened input
        self.weight_grn = GatedResidualNetwork(n_features, n_features, dropout)
        self.softmax = nn.Softmax(dim=-1)

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """Forward pass computing weighted feature combination.

        Parameters
        ----------
        x : torch.Tensor
            Input tensor, shape (..., n_features).

        Returns
        -------
        tuple of (torch.Tensor, torch.Tensor)
            combined: weighted feature output, shape (..., hidden_size)
            weights: per-feature importance, shape (..., n_features)
        """
        # Compute selection weights from input
        weights = self.softmax(self.weight_grn(x))  # (..., n_features)

        # Transform each feature through its own GRN
        transformed = []
        for i in range(self.n_features):
            feat_i = x[..., i : i + 1]  # (..., 1)
            transformed.append(self.feature_grns[i](feat_i))  # (..., hidden_size)

        # Stack and apply weights
        stacked = torch.stack(transformed, dim=-2)  # (..., n_features, hidden_size)
        weights_expanded = weights.unsqueeze(-1)  # (..., n_features, 1)
        combined = (stacked * weights_expanded).sum(dim=-2)  # (..., hidden_size)

        return combined, weights


class InterpretableMultiHeadAttention(nn.Module):  # type: ignore[misc]
    """Multi-head attention with interpretable weight extraction.

    Standard multi-head attention from Vaswani et al. (2017), but designed
    to expose attention weights for explainability. In wind power forecasting,
    the attention pattern reveals which past timesteps influenced the forecast
    (e.g., a weather front arriving 6 hours ago might get high attention).

    Attention(Q,K,V) = softmax(QKᵀ/√d_k)V
    """

    def __init__(self, d_model: int, n_heads: int, dropout: float = 0.1) -> None:
        super().__init__()
        if d_model % n_heads != 0:
            msg = f"d_model ({d_model}) must be divisible by n_heads ({n_heads})"
            raise ValueError(msg)

        self.d_model = d_model
        self.n_heads = n_heads
        self.d_k = d_model // n_heads

        self.w_q = nn.Linear(d_model, d_model)
        self.w_k = nn.Linear(d_model, d_model)
        self.w_v = nn.Linear(d_model, d_model)
        self.w_o = nn.Linear(d_model, d_model)

        self.dropout = nn.Dropout(p=dropout)
        self.scale = math.sqrt(self.d_k)

        # Store attention weights for extraction
        self._attention_weights: torch.Tensor | None = None

    def forward(self, query: torch.Tensor, key: torch.Tensor, value: torch.Tensor) -> torch.Tensor:
        """Multi-head attention forward pass.

        Parameters
        ----------
        query, key, value : torch.Tensor
            Input tensors, shape (batch, seq_len, d_model).

        Returns
        -------
        torch.Tensor
            Attention output, shape (batch, seq_len, d_model).
        """
        batch_size = query.size(0)

        # Linear projections → (batch, n_heads, seq_len, d_k)
        q = self.w_q(query).view(batch_size, -1, self.n_heads, self.d_k).transpose(1, 2)
        k = self.w_k(key).view(batch_size, -1, self.n_heads, self.d_k).transpose(1, 2)
        v = self.w_v(value).view(batch_size, -1, self.n_heads, self.d_k).transpose(1, 2)

        # Scaled dot-product attention
        scores = torch.matmul(q, k.transpose(-2, -1)) / self.scale  # (batch, n_heads, seq, seq)
        attn_weights = torch.softmax(scores, dim=-1)
        attn_weights = self.dropout(attn_weights)

        # Store for extraction (average across heads for interpretability)
        self._attention_weights = attn_weights.detach().mean(dim=1)  # (batch, seq, seq)

        # Apply attention to values
        context = torch.matmul(attn_weights, v)  # (batch, n_heads, seq, d_k)
        context = context.transpose(1, 2).contiguous().view(batch_size, -1, self.d_model)

        result: torch.Tensor = self.w_o(context)
        return result

    def get_attention_weights(self) -> torch.Tensor | None:
        """Return stored attention weights from last forward pass."""
        return self._attention_weights


class WindPowerTFT(nn.Module):  # type: ignore[misc]
    """Temporal Fusion Transformer for wind power forecasting.

    Simplified educational TFT architecture:
      Input → VSN (feature selection) → LSTM Encoder (temporal context)
      → Multi-Head Attention (long-range patterns) → GRN (enrichment)
      → Quantile Output Heads (P10, P50, P90)

    This produces a single-step prediction per input sequence (like LSTM),
    with native quantile regression instead of MC Dropout for uncertainty.
    """

    def __init__(
        self,
        n_features: int,
        hidden_size: int = 32,
        num_attention_heads: int = 2,
        dropout: float = 0.1,
        n_quantiles: int = 3,
    ) -> None:
        super().__init__()
        self.n_features = n_features
        self.hidden_size = hidden_size
        self.n_quantiles = n_quantiles

        # Component 1: Variable Selection Network
        self.vsn = VariableSelectionNetwork(n_features, hidden_size, dropout)

        # Component 2: LSTM Encoder for temporal context
        self.lstm_encoder = nn.LSTM(
            input_size=hidden_size,
            hidden_size=hidden_size,
            batch_first=True,
        )
        self.lstm_dropout = nn.Dropout(p=dropout)

        # Component 3: Multi-Head Attention for long-range dependencies
        self.attention = InterpretableMultiHeadAttention(hidden_size, num_attention_heads, dropout)

        # Component 4: Post-attention GRN for enrichment
        self.post_attention_grn = GatedResidualNetwork(hidden_size, hidden_size, dropout)

        # Component 5: Quantile output heads — one per quantile
        self.quantile_heads = nn.ModuleList([nn.Linear(hidden_size, 1) for _ in range(n_quantiles)])

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass through the TFT.

        Parameters
        ----------
        x : torch.Tensor
            Input tensor, shape (batch, lookback, n_features).

        Returns
        -------
        torch.Tensor
            Quantile predictions, shape (batch, n_quantiles).
        """
        batch_size, seq_len, _ = x.shape

        # Step 1: Variable Selection — learn which features matter
        # Apply VSN at each timestep
        x_flat = x.reshape(batch_size * seq_len, self.n_features)
        selected, _weights = self.vsn(x_flat)
        selected = selected.reshape(batch_size, seq_len, self.hidden_size)

        # Step 2: LSTM Encoder — capture temporal context
        lstm_out, _ = self.lstm_encoder(selected)
        lstm_out = self.lstm_dropout(lstm_out)

        # Step 3: Multi-Head Attention — detect long-range patterns
        attn_out = self.attention(lstm_out, lstm_out, lstm_out)

        # Step 4: Post-attention GRN — non-linear enrichment
        enriched = self.post_attention_grn(attn_out[:, -1, :])  # Last timestep

        # Step 5: Quantile outputs — P10, P50, P90
        quantile_preds = []
        for head in self.quantile_heads:
            quantile_preds.append(head(enriched))  # (batch, 1)

        result: torch.Tensor = torch.cat(quantile_preds, dim=-1)  # (batch, n_quantiles)
        return result

    def get_variable_importance(self, x: torch.Tensor) -> NDArray[np.float64]:
        """Extract variable importance weights from VSN.

        Parameters
        ----------
        x : torch.Tensor
            Input tensor, shape (batch, lookback, n_features).

        Returns
        -------
        NDArray[np.float64]
            Per-feature importance, shape (n_features,). Sum = 1.0.
        """
        batch_size, seq_len, _ = x.shape
        x_flat = x.reshape(batch_size * seq_len, self.n_features)
        _, weights = self.vsn(x_flat)
        # Average across all timesteps and batches
        avg_weights = weights.detach().mean(dim=0).numpy()
        return np.asarray(avg_weights, dtype=np.float64)


# ── Helper Functions ──────────────────────────────────────────────


def _quantile_loss(
    predictions: torch.Tensor,
    targets: torch.Tensor,
    quantiles: tuple[float, ...],
) -> torch.Tensor:
    """Compute combined pinball loss across all quantiles.

    L_τ(y, ŷ) = τ × max(y-ŷ, 0) + (1-τ) × max(ŷ-y, 0)

    Parameters
    ----------
    predictions : torch.Tensor
        Predicted quantiles, shape (batch, n_quantiles).
    targets : torch.Tensor
        Actual values, shape (batch,).
    quantiles : tuple[float, ...]
        Quantile levels (e.g., 0.10, 0.50, 0.90).

    Returns
    -------
    torch.Tensor
        Scalar combined pinball loss.
    """
    total_loss = torch.tensor(0.0)
    for i, tau in enumerate(quantiles):
        pred_q = predictions[:, i]
        errors = targets - pred_q
        loss_q = torch.where(
            errors >= 0,
            tau * errors,
            (tau - 1.0) * errors,
        )
        total_loss = total_loss + loss_q.mean()
    return total_loss


def _compute_metrics(
    y_true: NDArray[np.float64],
    y_pred: NDArray[np.float64],
    fold_index: int,
    training_epochs: int,
) -> TFTFoldMetrics:
    """Compute regression metrics for a single fold (using P50 predictions)."""
    residuals = y_true - y_pred

    rmse = float(np.sqrt(np.mean(residuals**2)))
    mae = float(np.mean(np.abs(residuals)))

    nonzero_mask = np.abs(y_true) > 0.1
    if np.any(nonzero_mask):
        mape = float(np.mean(np.abs(residuals[nonzero_mask] / y_true[nonzero_mask])) * 100.0)
    else:
        mape = 0.0

    ss_res = float(np.sum(residuals**2))
    ss_tot = float(np.sum((y_true - np.mean(y_true)) ** 2))
    r_squared = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0

    return TFTFoldMetrics(
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


def _build_tft_model(n_features: int, config: TFTConfig) -> WindPowerTFT:
    """Construct a WindPowerTFT model."""
    torch.manual_seed(config.seed)
    return WindPowerTFT(
        n_features=n_features,
        hidden_size=config.hidden_size,
        num_attention_heads=config.num_attention_heads,
        dropout=config.dropout,
        n_quantiles=len(config.quantiles),
    )


def _train_single_fold(
    x_train: torch.Tensor,
    y_train: torch.Tensor,
    x_val: torch.Tensor,
    y_val: torch.Tensor,
    n_features: int,
    config: TFTConfig,
) -> tuple[WindPowerTFT, int]:
    """Train a single TFT model on one fold.

    Returns the trained model and the number of actual training epochs.
    """
    model = _build_tft_model(n_features, config)
    optimizer = torch.optim.Adam(model.parameters(), lr=config.learning_rate)

    best_val_loss = float("inf")
    patience_counter = 0
    actual_epochs = 0

    train_dataset = torch.utils.data.TensorDataset(x_train, y_train)
    train_loader = torch.utils.data.DataLoader(
        train_dataset,
        batch_size=config.batch_size,
        shuffle=False,  # Time series: preserve order
    )

    for epoch in range(config.epochs):
        # Training phase
        model.train()
        for batch_x, batch_y in train_loader:
            optimizer.zero_grad()
            pred = model(batch_x)  # (batch, n_quantiles)
            loss = _quantile_loss(pred, batch_y, config.quantiles)
            loss.backward()
            optimizer.step()

        actual_epochs = epoch + 1

        # Validation phase
        model.eval()
        with torch.no_grad():
            val_pred = model(x_val)
            val_loss = _quantile_loss(val_pred, y_val, config.quantiles).item()

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


def train_tft(
    features: NDArray[np.float64],
    target_power_mw: NDArray[np.float64],
    config: TFTConfig | None = None,
) -> tuple[TFTCVResult, WindPowerTFT, NormParams]:
    """Train TFT model with TimeSeriesSplit cross-validation.

    Normalizes data, creates sequences, and trains across CV folds
    using quantile loss (pinball loss) for native P10/P50/P90.
    Returns CV metrics, the model from the last fold, and normalization
    parameters for inference.

    Parameters
    ----------
    features : NDArray[np.float64]
        Feature matrix, shape (n_samples, n_features).
    target_power_mw : NDArray[np.float64]
        Target power values [MW], shape (n_samples,).
    config : TFTConfig, optional
        Model configuration. Uses defaults if None.

    Returns
    -------
    tuple of (TFTCVResult, WindPowerTFT, NormParams)
        CV metrics, trained model (last fold), and normalization params.
    """
    if config is None:
        config = TFTConfig()

    # Normalize before sequencing
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
    fold_metrics_list: list[TFTFoldMetrics] = []
    last_model: WindPowerTFT | None = None

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

        # Evaluate using P50 (median) — index 1 in quantile outputs
        model.eval()
        with torch.no_grad():
            preds = model(x_test_t)  # (n_test, n_quantiles)
            y_pred_norm = preds[:, 1].numpy()  # P50

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

    arch_summary = (
        f"VSN({n_features}→{config.hidden_size}) → "
        f"LSTM({config.hidden_size}) → "
        f"MultiHeadAttn(heads={config.num_attention_heads}) → "
        f"GRN({config.hidden_size}) → "
        f"Quantile({len(config.quantiles)}) | "
        f"lookback={config.lookback}, lr={config.learning_rate}, "
        f"batch={config.batch_size}"
    )

    cv_result = TFTCVResult(
        fold_metrics=fold_metrics_list,
        mean_rmse_mw=round(mean_rmse, 4),
        mean_mae_mw=round(mean_mae, 4),
        mean_mape_pct=round(mean_mape, 2),
        mean_r_squared=round(mean_r2, 4),
        skill_score_vs_persistence=round(skill_score, 4),
        architecture_summary=arch_summary,
    )

    return cv_result, last_model, norm_params


def predict_tft(
    model: WindPowerTFT,
    features: NDArray[np.float64],
    wind_speed_ms: NDArray[np.float64],
    norm_params: NormParams,
    config: TFTConfig | None = None,
    timestamps_utc: NDArray[np.int64] | None = None,
) -> TFTForecastResult:
    """Generate probabilistic power forecast using TFT quantile regression.

    Produces P10/P50/P90 directly from quantile output heads (no MC sampling).
    Physical constraints are applied after denormalization.

    Parameters
    ----------
    model : WindPowerTFT
        Trained TFT model.
    features : NDArray[np.float64]
        Feature matrix, shape (n_samples, n_features).
    wind_speed_ms : NDArray[np.float64]
        Wind speed for constraint enforcement, shape (n_samples,).
    norm_params : NormParams
        Normalization parameters from training.
    config : TFTConfig, optional
        Configuration (for lookback).
    timestamps_utc : NDArray[np.int64], optional
        Timestamps for the forecast period.

    Returns
    -------
    TFTForecastResult
        Probabilistic forecast with physical constraints applied.
    """
    if config is None:
        config = TFTConfig()

    # Normalize features
    norm_features = _normalize_features_with_params(features, norm_params)

    # Create sequences
    dummy_target = np.zeros(features.shape[0], dtype=np.float64)
    x_seq, _ = create_sequences(norm_features, dummy_target, config.lookback)

    if x_seq.shape[0] == 0:
        return TFTForecastResult(
            power_p10_mw=np.empty(0, dtype=np.float64),
            power_p50_mw=np.empty(0, dtype=np.float64),
            power_p90_mw=np.empty(0, dtype=np.float64),
            wind_speed_ms=np.empty(0, dtype=np.float64),
            timestamps_utc=np.empty(0, dtype=np.int64),
        )

    x_tensor = torch.tensor(x_seq, dtype=torch.float32)

    # Predict quantiles
    model.eval()
    with torch.no_grad():
        preds = model(x_tensor)  # (n_seq, n_quantiles)
        preds_np = preds.numpy()

    # Denormalize each quantile
    p10_raw = _denormalize_power(preds_np[:, 0], norm_params)
    p50_raw = _denormalize_power(preds_np[:, 1], norm_params)
    p90_raw = _denormalize_power(preds_np[:, 2], norm_params)

    # Wind speed for sequences: use the last value in each lookback window
    n_seq = len(p50_raw)
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

    return TFTForecastResult(
        power_p10_mw=p10,
        power_p50_mw=p50,
        power_p90_mw=p90,
        wind_speed_ms=seq_wind,
        timestamps_utc=timestamps_utc,
    )


def compute_attention_weights(
    model: WindPowerTFT,
    features: NDArray[np.float64],
    norm_params: NormParams,
    config: TFTConfig | None = None,
    feature_names: list[str] | None = None,
) -> AttentionWeights:
    """Extract attention weights and variable importance from TFT.

    Runs a forward pass and extracts:
    1. Temporal attention weights — which past timesteps influence the prediction
    2. Variable importance — which features the VSN selects

    Parameters
    ----------
    model : WindPowerTFT
        Trained TFT model.
    features : NDArray[np.float64]
        Feature matrix, shape (n_samples, n_features).
    norm_params : NormParams
        Normalization parameters from training.
    config : TFTConfig, optional
        Configuration (for lookback).
    feature_names : list[str], optional
        Names for each feature column.

    Returns
    -------
    AttentionWeights
        Temporal attention and variable importance analysis.
    """
    if config is None:
        config = TFTConfig()

    # Normalize and create sequences
    norm_features = _normalize_features_with_params(features, norm_params)
    dummy_target = np.zeros(features.shape[0], dtype=np.float64)
    x_seq, _ = create_sequences(norm_features, dummy_target, config.lookback)

    if x_seq.shape[0] == 0:
        return AttentionWeights(
            temporal_weights=np.empty((0, config.lookback), dtype=np.float64),
            variable_importance={},
            num_heads=config.num_attention_heads,
        )

    x_tensor = torch.tensor(x_seq, dtype=torch.float32)

    # Forward pass to populate attention weights
    model.eval()
    with torch.no_grad():
        _preds = model(x_tensor)

    # Extract temporal attention weights
    raw_attn = model.attention.get_attention_weights()
    if raw_attn is not None:
        # Take last row of each attention matrix (what the output attends to)
        temporal = raw_attn[:, -1, :].numpy()  # (n_seq, lookback)
    else:
        temporal = np.zeros((x_seq.shape[0], config.lookback), dtype=np.float64)

    # Extract variable importance
    var_importance = model.get_variable_importance(x_tensor)

    importance_dict: dict[str, float] = {}
    if feature_names is not None:
        for i, name in enumerate(feature_names):
            importance_dict[name] = round(float(var_importance[i]), 6)
    else:
        for i in range(len(var_importance)):
            importance_dict[f"feature_{i}"] = round(float(var_importance[i]), 6)

    # Sort by importance (descending)
    importance_dict = dict(sorted(importance_dict.items(), key=lambda x: x[1], reverse=True))

    return AttentionWeights(
        temporal_weights=np.asarray(temporal, dtype=np.float64),
        variable_importance=importance_dict,
        num_heads=config.num_attention_heads,
    )
