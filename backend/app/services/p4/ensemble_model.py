"""Horizon-dependent ensemble forecasting for P4 wind power models.

Combines XGBoost, LSTM, and TFT forecasts using horizon-dependent
weighting per Roadmap Section 5.6. Short horizons favour XGBoost
(gradient boosting captures recent patterns), medium horizons balance
LSTM sequence memory with TFT attention, and long horizons favour
TFT's multi-horizon architecture.

Weight schedule (per Roadmap §5.6):
    < 6h:    XGB 0.50 + LSTM 0.30 + TFT 0.20
    6–24h:   XGB 0.20 + LSTM 0.40 + TFT 0.40
    24–48h:  XGB 0.10 + LSTM 0.30 + TFT 0.60

References:
    - Roadmap §5.6: Horizon-dependent ensemble weighting
    - Roadmap §5.9: Physical constraint enforcement
    - IEC 61400-26-3: Combined forecasting for grid dispatch
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

from app.services.p4.physical_constraints import (
    DEFAULT_CUT_IN_MS,
    DEFAULT_CUT_OUT_MS,
    DEFAULT_RATED_POWER_MW,
    ConstraintResult,
    enforce_physical_constraints,
)

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────

# SCADA resolution: 10 minutes per timestep
TIMESTEP_MINUTES: int = 10

# Horizon band boundaries in hours
HORIZON_SHORT_HOURS: float = 6.0
HORIZON_MEDIUM_HOURS: float = 24.0
HORIZON_LONG_HOURS: float = 48.0

# Steps per horizon band
STEPS_PER_HOUR: int = 60 // TIMESTEP_MINUTES  # 6 steps per hour
SHORT_HORIZON_STEPS: int = int(HORIZON_SHORT_HOURS * STEPS_PER_HOUR)  # 36
MEDIUM_HORIZON_STEPS: int = int(HORIZON_MEDIUM_HOURS * STEPS_PER_HOUR)  # 144
LONG_HORIZON_STEPS: int = int(HORIZON_LONG_HOURS * STEPS_PER_HOUR)  # 288


# ── Dataclasses ───────────────────────────────────────────────────


@dataclass(frozen=True)
class HorizonWeights:
    """Weights for a single horizon band.

    Attributes:
        label: human-readable band label (e.g., "short_0_6h")
        xgb_weight: XGBoost weight [0,1]
        lstm_weight: LSTM weight [0,1]
        tft_weight: TFT weight [0,1]
    """

    label: str
    xgb_weight: float
    lstm_weight: float
    tft_weight: float

    def __post_init__(self) -> None:
        """Validate weights sum to 1.0 (within floating-point tolerance)."""
        total = self.xgb_weight + self.lstm_weight + self.tft_weight
        if abs(total - 1.0) > 1e-6:
            msg = f"Weights must sum to 1.0, got {total:.6f}"
            raise ValueError(msg)


@dataclass(frozen=True)
class EnsembleConfig:
    """Configuration for horizon-dependent ensemble.

    Attributes:
        short_weights: weights for < 6h horizon
        medium_weights: weights for 6–24h horizon
        long_weights: weights for 24–48h horizon
        rated_power_mw: turbine rated power for constraint enforcement
        cut_in_ms: cut-in wind speed [m/s]
        cut_out_ms: cut-out wind speed [m/s]
    """

    short_weights: HorizonWeights = field(
        default_factory=lambda: HorizonWeights(
            label="short_0_6h",
            xgb_weight=0.50,
            lstm_weight=0.30,
            tft_weight=0.20,
        )
    )
    medium_weights: HorizonWeights = field(
        default_factory=lambda: HorizonWeights(
            label="medium_6_24h",
            xgb_weight=0.20,
            lstm_weight=0.40,
            tft_weight=0.40,
        )
    )
    long_weights: HorizonWeights = field(
        default_factory=lambda: HorizonWeights(
            label="long_24_48h",
            xgb_weight=0.10,
            lstm_weight=0.30,
            tft_weight=0.60,
        )
    )
    rated_power_mw: float = DEFAULT_RATED_POWER_MW
    cut_in_ms: float = DEFAULT_CUT_IN_MS
    cut_out_ms: float = DEFAULT_CUT_OUT_MS


@dataclass(frozen=True)
class ModelForecasts:
    """Aligned forecasts from all three models.

    All arrays must have the same length (n_steps). Each array contains
    the forecast power in MW for a single quantile level.

    Attributes:
        xgb_p10/p50/p90: XGBoost quantile forecasts [MW]
        lstm_p10/p50/p90: LSTM quantile forecasts [MW]
        tft_p10/p50/p90: TFT quantile forecasts [MW]
        wind_speed_ms: concurrent wind speed [m/s]
        timestamps_utc: Unix timestamps [s]
    """

    xgb_p10: NDArray[np.float64]
    xgb_p50: NDArray[np.float64]
    xgb_p90: NDArray[np.float64]
    lstm_p10: NDArray[np.float64]
    lstm_p50: NDArray[np.float64]
    lstm_p90: NDArray[np.float64]
    tft_p10: NDArray[np.float64]
    tft_p50: NDArray[np.float64]
    tft_p90: NDArray[np.float64]
    wind_speed_ms: NDArray[np.float64]
    timestamps_utc: NDArray[np.int64]


@dataclass(frozen=True)
class EnsembleForecastResult:
    """Result of horizon-dependent ensemble forecast.

    Attributes:
        power_p10_mw: ensemble P10 forecast [MW]
        power_p50_mw: ensemble P50 forecast [MW]
        power_p90_mw: ensemble P90 forecast [MW]
        wind_speed_ms: concurrent wind speed [m/s]
        timestamps_utc: Unix timestamps [s]
        weights_applied: per-step weights that were used
        constraint_result: physical constraint enforcement result
    """

    power_p10_mw: NDArray[np.float64]
    power_p50_mw: NDArray[np.float64]
    power_p90_mw: NDArray[np.float64]
    wind_speed_ms: NDArray[np.float64]
    timestamps_utc: NDArray[np.int64]
    weights_applied: list[str]
    constraint_result: ConstraintResult


# ── Core Functions ────────────────────────────────────────────────


def get_horizon_weights(
    step_index: int,
    config: EnsembleConfig,
) -> HorizonWeights:
    """Select weight set based on forecast horizon step index.

    Args:
        step_index: 0-based forecast step (each step = 10 min)
        config: ensemble configuration with weight sets

    Returns:
        HorizonWeights for the appropriate band.
    """
    if step_index < SHORT_HORIZON_STEPS:
        return config.short_weights
    if step_index < MEDIUM_HORIZON_STEPS:
        return config.medium_weights
    return config.long_weights


def _weighted_average(
    xgb_val: NDArray[np.float64],
    lstm_val: NDArray[np.float64],
    tft_val: NDArray[np.float64],
    weights: HorizonWeights,
) -> NDArray[np.float64]:
    """Compute weighted average of three model values."""
    return (
        weights.xgb_weight * xgb_val + weights.lstm_weight * lstm_val + weights.tft_weight * tft_val
    )


def apply_skill_gate(
    config: EnsembleConfig,
    skill_scores: dict[str, float],
    min_skill: float = 0.0,
) -> EnsembleConfig:
    """Zero out weights for models whose skill score falls below ``min_skill``.

    Guards against a broken base model dragging the ensemble below its best
    member. For each horizon band, surviving models are renormalised so their
    weights still sum to 1.0. If every model is gated in a band the original
    weights for that band are kept (no safe fallback other than the static
    schedule).

    Args:
        config: baseline ensemble config (typically default static weights)
        skill_scores: mapping of {"XGBoost"|"LSTM"|"TFT" → skill_score}
        min_skill: threshold below which a model is excluded (default 0.0)

    Returns:
        New ``EnsembleConfig`` with gated + renormalised weights per band.
    """
    xgb_ok = skill_scores.get("XGBoost", float("inf")) >= min_skill
    lstm_ok = skill_scores.get("LSTM", float("inf")) >= min_skill
    tft_ok = skill_scores.get("TFT", float("inf")) >= min_skill

    def gate(hw: HorizonWeights) -> HorizonWeights:
        xgb = hw.xgb_weight if xgb_ok else 0.0
        lstm = hw.lstm_weight if lstm_ok else 0.0
        tft = hw.tft_weight if tft_ok else 0.0
        total = xgb + lstm + tft
        if total <= 0.0:
            return hw  # every model gated — preserve original to avoid div/0
        return HorizonWeights(
            label=f"{hw.label}_gated",
            xgb_weight=xgb / total,
            lstm_weight=lstm / total,
            tft_weight=tft / total,
        )

    return EnsembleConfig(
        short_weights=gate(config.short_weights),
        medium_weights=gate(config.medium_weights),
        long_weights=gate(config.long_weights),
        rated_power_mw=config.rated_power_mw,
        cut_in_ms=config.cut_in_ms,
        cut_out_ms=config.cut_out_ms,
    )


def apply_inverse_rmse_weighting(
    config: EnsembleConfig,
    rmse_scores: dict[str, float],
    eps: float = 1e-6,
) -> EnsembleConfig:
    """Scale each per-band weight by ``1 / RMSE²`` (inverse-variance).

    Preserves the horizon expertise encoded in the static schedule
    (e.g. TFT dominates at long horizons) while pulling weight away
    from models that underperform on the evaluation window.

    Denominator uses ``RMSE² + eps`` so a perfect model (RMSE=0) does
    not blow up, and a model missing from ``rmse_scores`` simply keeps
    its base weight.

    Args:
        config: baseline ensemble config
        rmse_scores: mapping of {"XGBoost"|"LSTM"|"TFT" → RMSE in MW}
        eps: small floor to avoid division by zero

    Returns:
        New ``EnsembleConfig`` with adaptively scaled + renormalised weights.
    """

    def inv(name: str) -> float:
        rmse = rmse_scores.get(name)
        if rmse is None:
            return 1.0
        return 1.0 / (rmse**2 + eps)

    xgb_inv = inv("XGBoost")
    lstm_inv = inv("LSTM")
    tft_inv = inv("TFT")

    def scale(hw: HorizonWeights) -> HorizonWeights:
        xgb = hw.xgb_weight * xgb_inv
        lstm = hw.lstm_weight * lstm_inv
        tft = hw.tft_weight * tft_inv
        total = xgb + lstm + tft
        if total <= 0.0:
            return hw
        return HorizonWeights(
            label=f"{hw.label}_adaptive",
            xgb_weight=xgb / total,
            lstm_weight=lstm / total,
            tft_weight=tft / total,
        )

    return EnsembleConfig(
        short_weights=scale(config.short_weights),
        medium_weights=scale(config.medium_weights),
        long_weights=scale(config.long_weights),
        rated_power_mw=config.rated_power_mw,
        cut_in_ms=config.cut_in_ms,
        cut_out_ms=config.cut_out_ms,
    )


def compute_ensemble_forecast(
    forecasts: ModelForecasts,
    config: EnsembleConfig | None = None,
) -> EnsembleForecastResult:
    """Compute horizon-dependent weighted ensemble forecast.

    For each timestep, selects the appropriate horizon band weights
    and combines all three model forecasts. Then enforces:
    1. Physical constraints (rated power, cut-in/cut-out)
    2. Quantile monotonicity (P10 ≤ P50 ≤ P90)

    Args:
        forecasts: aligned forecasts from XGBoost, LSTM, and TFT
        config: ensemble configuration (uses defaults if None)

    Returns:
        EnsembleForecastResult with constrained ensemble predictions.
    """
    if config is None:
        config = EnsembleConfig()

    n_steps = len(forecasts.xgb_p50)

    # Validate alignment
    arrays = [
        forecasts.xgb_p10,
        forecasts.xgb_p50,
        forecasts.xgb_p90,
        forecasts.lstm_p10,
        forecasts.lstm_p50,
        forecasts.lstm_p90,
        forecasts.tft_p10,
        forecasts.tft_p50,
        forecasts.tft_p90,
        forecasts.wind_speed_ms,
    ]
    for arr in arrays:
        if len(arr) != n_steps:
            msg = f"All forecast arrays must have length {n_steps}, got {len(arr)}"
            raise ValueError(msg)

    # Allocate output arrays
    p10_raw = np.zeros(n_steps, dtype=np.float64)
    p50_raw = np.zeros(n_steps, dtype=np.float64)
    p90_raw = np.zeros(n_steps, dtype=np.float64)
    weights_applied: list[str] = []

    # Apply per-step horizon-dependent weighting
    for i in range(n_steps):
        hw = get_horizon_weights(i, config)
        weights_applied.append(hw.label)

        p10_raw[i] = (
            hw.xgb_weight * forecasts.xgb_p10[i]
            + hw.lstm_weight * forecasts.lstm_p10[i]
            + hw.tft_weight * forecasts.tft_p10[i]
        )
        p50_raw[i] = (
            hw.xgb_weight * forecasts.xgb_p50[i]
            + hw.lstm_weight * forecasts.lstm_p50[i]
            + hw.tft_weight * forecasts.tft_p50[i]
        )
        p90_raw[i] = (
            hw.xgb_weight * forecasts.xgb_p90[i]
            + hw.lstm_weight * forecasts.lstm_p90[i]
            + hw.tft_weight * forecasts.tft_p90[i]
        )

    # Enforce quantile monotonicity: P10 ≤ P50 ≤ P90
    p50_raw = np.maximum(p50_raw, p10_raw)
    p90_raw = np.maximum(p90_raw, p50_raw)

    # Enforce physical constraints on P50 (primary dispatch forecast)
    constraint_result = enforce_physical_constraints(
        power_mw=p50_raw,
        wind_speed_ms=forecasts.wind_speed_ms,
        rated_power_mw=config.rated_power_mw,
        cut_in_ms=config.cut_in_ms,
        cut_out_ms=config.cut_out_ms,
    )
    p50_constrained = constraint_result.power_mw

    # Apply same constraints to P10 and P90
    p10_result = enforce_physical_constraints(
        power_mw=p10_raw,
        wind_speed_ms=forecasts.wind_speed_ms,
        rated_power_mw=config.rated_power_mw,
        cut_in_ms=config.cut_in_ms,
        cut_out_ms=config.cut_out_ms,
    )
    p90_result = enforce_physical_constraints(
        power_mw=p90_raw,
        wind_speed_ms=forecasts.wind_speed_ms,
        rated_power_mw=config.rated_power_mw,
        cut_in_ms=config.cut_in_ms,
        cut_out_ms=config.cut_out_ms,
    )

    # Re-enforce monotonicity after constraints
    p10_final = p10_result.power_mw
    p50_final = np.maximum(p50_constrained, p10_final)
    p90_final = np.maximum(p90_result.power_mw, p50_final)

    logger.info(
        "Ensemble forecast: %d steps, %d P50 violations corrected",
        n_steps,
        constraint_result.total_violations,
    )

    return EnsembleForecastResult(
        power_p10_mw=p10_final,
        power_p50_mw=p50_final,
        power_p90_mw=p90_final,
        wind_speed_ms=forecasts.wind_speed_ms,
        timestamps_utc=forecasts.timestamps_utc,
        weights_applied=weights_applied,
        constraint_result=constraint_result,
    )


def compute_ensemble_simple(
    xgb_values: NDArray[np.float64],
    lstm_values: NDArray[np.float64],
    tft_values: NDArray[np.float64],
    config: EnsembleConfig | None = None,
) -> NDArray[np.float64]:
    """Compute horizon-dependent weighted average for a single quantile.

    Convenience function for cases where you only need the weighted
    average without full physical constraint enforcement.

    Args:
        xgb_values: XGBoost forecast array
        lstm_values: LSTM forecast array
        tft_values: TFT forecast array
        config: ensemble configuration

    Returns:
        Weighted average array.
    """
    if config is None:
        config = EnsembleConfig()

    n_steps = len(xgb_values)
    result = np.zeros(n_steps, dtype=np.float64)

    for i in range(n_steps):
        hw = get_horizon_weights(i, config)
        result[i] = (
            hw.xgb_weight * xgb_values[i]
            + hw.lstm_weight * lstm_values[i]
            + hw.tft_weight * tft_values[i]
        )

    return result
