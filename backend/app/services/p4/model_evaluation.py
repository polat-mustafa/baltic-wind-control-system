"""Model evaluation and comparison metrics for P4 forecasting models.

Pure math module — no model dependencies. Computes standard forecasting
metrics (RMSE, MAE, MAPE, R², Skill Score) and probabilistic calibration
metrics (quantile coverage, pinball loss) for comparing XGBoost, LSTM, TFT,
and ensemble forecasts side-by-side.

References:
    - IEC 61400-26-3: Wind turbine performance assessment
    - Gneiting & Raftery (2007): Strictly proper scoring rules
    - Roadmap §5.6–5.12: Model evaluation and comparison
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────

# Minimum absolute power to include in MAPE calculation (avoids division
# by near-zero actuals that produce misleadingly large percentage errors).
MAPE_MIN_POWER_MW: float = 0.5

# Standard quantile levels matching XGBoost/LSTM/TFT output
DEFAULT_QUANTILES: tuple[float, ...] = (0.10, 0.50, 0.90)


# ── Dataclasses ───────────────────────────────────────────────────


@dataclass(frozen=True)
class ModelMetrics:
    """Complete evaluation metrics for a single model.

    Deterministic metrics:
        rmse_mw — Root Mean Square Error [MW]
        mae_mw — Mean Absolute Error [MW]
        mape_pct — Mean Absolute Percentage Error [%] (near-zero excluded)
        r_squared — Coefficient of determination R²
        skill_score — Skill score vs persistence (1 - MSE_model / MSE_persist)

    Probabilistic metrics:
        quantile_coverage — fraction of actuals below each quantile forecast
        pinball_losses — pinball (quantile) loss per quantile level
    """

    model_name: str
    rmse_mw: float
    mae_mw: float
    mape_pct: float
    r_squared: float
    skill_score: float
    quantile_coverage: dict[str, float]
    pinball_losses: dict[str, float]
    num_samples: int


@dataclass(frozen=True)
class ModelComparisonResult:
    """Side-by-side comparison of multiple models.

    Attributes:
        model_metrics — metrics for each model
        best_rmse — model name with lowest RMSE
        best_mae — model name with lowest MAE
        best_skill — model name with highest skill score
        best_calibration — model name with best quantile calibration
        ranking — model names ordered by RMSE (best first)
    """

    model_metrics: list[ModelMetrics]
    best_rmse: str
    best_mae: str
    best_skill: str
    best_calibration: str
    ranking: list[str] = field(default_factory=list)


# ── Deterministic Metrics ─────────────────────────────────────────


def compute_rmse(
    actual: NDArray[np.float64],
    predicted: NDArray[np.float64],
) -> float:
    """Root Mean Square Error [MW].

    RMSE = sqrt(mean((actual - predicted)²))

    Penalises large errors more than MAE due to squaring.
    Standard metric for wind power forecasting per IEC 61400-26-3.
    """
    residuals = actual - predicted
    return float(np.sqrt(np.mean(residuals**2)))


def compute_mae(
    actual: NDArray[np.float64],
    predicted: NDArray[np.float64],
) -> float:
    """Mean Absolute Error [MW].

    MAE = mean(|actual - predicted|)

    More robust to outliers than RMSE. Preferred for operational
    dispatch error reporting.
    """
    return float(np.mean(np.abs(actual - predicted)))


def compute_mape(
    actual: NDArray[np.float64],
    predicted: NDArray[np.float64],
    min_power_mw: float = MAPE_MIN_POWER_MW,
) -> float:
    """Mean Absolute Percentage Error [%], excluding near-zero actuals.

    MAPE = 100 × mean(|actual - predicted| / |actual|)  for |actual| ≥ min_power

    Near-zero actuals (< 0.5 MW default) are excluded to avoid division
    by ~0 producing misleading 1000%+ errors during low-wind periods.
    Returns 0.0 if no samples pass the threshold.
    """
    mask = np.abs(actual) >= min_power_mw
    if not np.any(mask):
        return 0.0
    pct_errors = np.abs((actual[mask] - predicted[mask]) / actual[mask])
    return float(100.0 * np.mean(pct_errors))


def compute_r_squared(
    actual: NDArray[np.float64],
    predicted: NDArray[np.float64],
) -> float:
    """Coefficient of determination R².

    R² = 1 - SS_res / SS_tot

    Where SS_res = Σ(actual - predicted)² and SS_tot = Σ(actual - mean(actual))².
    R² = 1.0 is perfect, R² = 0.0 is same as predicting the mean,
    R² < 0 means the model is worse than the mean.
    """
    ss_res = float(np.sum((actual - predicted) ** 2))
    ss_tot = float(np.sum((actual - np.mean(actual)) ** 2))
    if ss_tot == 0.0:
        return 1.0 if ss_res == 0.0 else 0.0
    return 1.0 - ss_res / ss_tot


def compute_skill_score(
    actual: NDArray[np.float64],
    predicted: NDArray[np.float64],
) -> float:
    """Skill score vs persistence baseline.

    SS = 1 - MSE_model / MSE_persistence

    Persistence forecast: P(t+1) = P(t). Uses actual[:-1] as the
    persistence prediction for actual[1:].

    SS > 0 → model beats persistence
    SS = 0 → model equals persistence
    SS < 0 → model is worse than persistence

    Requires at least 2 samples. Returns 0.0 for insufficient data.
    """
    if len(actual) < 2:
        return 0.0

    # Persistence: previous value predicts next value
    persist_pred = actual[:-1]
    persist_actual = actual[1:]

    mse_persist = float(np.mean((persist_actual - persist_pred) ** 2))
    mse_model = float(np.mean((actual - predicted) ** 2))

    if mse_persist == 0.0:
        return 1.0 if mse_model == 0.0 else 0.0
    return 1.0 - mse_model / mse_persist


# ── Probabilistic Metrics ─────────────────────────────────────────


def compute_quantile_coverage(
    actual: NDArray[np.float64],
    quantile_forecasts: dict[float, NDArray[np.float64]],
) -> dict[str, float]:
    """Quantile calibration: fraction of actuals below each quantile forecast.

    For a well-calibrated P10 forecast, ~10% of actuals should fall below it.
    For P90, ~90% should fall below it.

    Returns dict like {"P10": 0.12, "P50": 0.48, "P90": 0.91}.
    """
    coverage: dict[str, float] = {}
    for q, forecast in sorted(quantile_forecasts.items()):
        label = f"P{int(q * 100)}"
        fraction_below = float(np.mean(actual < forecast))
        coverage[label] = round(fraction_below, 4)
    return coverage


def compute_pinball_loss(
    actual: NDArray[np.float64],
    predicted: NDArray[np.float64],
    quantile: float,
) -> float:
    """Pinball (quantile) loss for a single quantile level.

    L_q(y, ŷ) = q × max(y - ŷ, 0) + (1-q) × max(ŷ - y, 0)

    The pinball loss is a strictly proper scoring rule for quantile
    forecasts (Gneiting & Raftery, 2007). Lower is better.

    Args:
        actual: observed power [MW]
        predicted: quantile forecast [MW]
        quantile: quantile level (0.10, 0.50, 0.90)
    """
    residual = actual - predicted
    loss = np.where(
        residual >= 0,
        quantile * residual,
        (quantile - 1.0) * residual,
    )
    return float(np.mean(loss))


def compute_all_pinball_losses(
    actual: NDArray[np.float64],
    quantile_forecasts: dict[float, NDArray[np.float64]],
) -> dict[str, float]:
    """Pinball loss for all quantile levels.

    Returns dict like {"P10": 0.23, "P50": 0.45, "P90": 0.31}.
    """
    losses: dict[str, float] = {}
    for q, forecast in sorted(quantile_forecasts.items()):
        label = f"P{int(q * 100)}"
        losses[label] = round(compute_pinball_loss(actual, forecast, q), 4)
    return losses


# ── Composite Evaluation ──────────────────────────────────────────


def evaluate_model(
    model_name: str,
    actual: NDArray[np.float64],
    predicted_p50: NDArray[np.float64],
    predicted_p10: NDArray[np.float64] | None = None,
    predicted_p90: NDArray[np.float64] | None = None,
) -> ModelMetrics:
    """Compute all evaluation metrics for a single model.

    Args:
        model_name: identifier for the model (e.g., "XGBoost", "LSTM")
        actual: observed power values [MW]
        predicted_p50: P50 (median) forecast [MW]
        predicted_p10: optional P10 forecast [MW]
        predicted_p90: optional P90 forecast [MW]

    Returns:
        ModelMetrics with deterministic + probabilistic metrics.
    """
    actual = np.asarray(actual, dtype=np.float64)
    predicted_p50 = np.asarray(predicted_p50, dtype=np.float64)

    rmse = compute_rmse(actual, predicted_p50)
    mae = compute_mae(actual, predicted_p50)
    mape = compute_mape(actual, predicted_p50)
    r2 = compute_r_squared(actual, predicted_p50)
    skill = compute_skill_score(actual, predicted_p50)

    # Quantile metrics (if quantile forecasts provided)
    quantile_coverage: dict[str, float] = {}
    pinball_losses: dict[str, float] = {}

    quantile_forecasts: dict[float, NDArray[np.float64]] = {0.50: predicted_p50}
    if predicted_p10 is not None:
        quantile_forecasts[0.10] = np.asarray(predicted_p10, dtype=np.float64)
    if predicted_p90 is not None:
        quantile_forecasts[0.90] = np.asarray(predicted_p90, dtype=np.float64)

    quantile_coverage = compute_quantile_coverage(actual, quantile_forecasts)
    pinball_losses = compute_all_pinball_losses(actual, quantile_forecasts)

    logger.info(
        "%s evaluation: RMSE=%.3f MW, MAE=%.3f MW, R²=%.4f, Skill=%.4f",
        model_name,
        rmse,
        mae,
        r2,
        skill,
    )

    return ModelMetrics(
        model_name=model_name,
        rmse_mw=round(rmse, 4),
        mae_mw=round(mae, 4),
        mape_pct=round(mape, 2),
        r_squared=round(r2, 4),
        skill_score=round(skill, 4),
        quantile_coverage=quantile_coverage,
        pinball_losses=pinball_losses,
        num_samples=len(actual),
    )


def compare_models(
    model_results: list[ModelMetrics],
) -> ModelComparisonResult:
    """Compare multiple models and rank them.

    Ranking criteria:
    1. best_rmse — lowest RMSE
    2. best_skill — highest skill score vs persistence
    3. best_calibration — best P90 coverage (closest to 0.90)
    4. ranking — ordered by RMSE ascending

    Args:
        model_results: list of ModelMetrics from evaluate_model()

    Returns:
        ModelComparisonResult with rankings and per-model metrics.
    """
    if not model_results:
        msg = "At least one model result is required for comparison"
        raise ValueError(msg)

    # Rank by RMSE (ascending = best first)
    sorted_by_rmse = sorted(model_results, key=lambda m: m.rmse_mw)
    ranking = [m.model_name for m in sorted_by_rmse]
    best_rmse = ranking[0]

    # Best MAE (lowest) — may differ from best RMSE when residual
    # distributions differ (RMSE penalises large errors more than MAE)
    best_mae = min(model_results, key=lambda m: m.mae_mw).model_name

    # Best skill score (highest)
    best_skill = max(model_results, key=lambda m: m.skill_score).model_name

    # Best P90 calibration (closest to 0.90)
    def calibration_error(m: ModelMetrics) -> float:
        p90_cov = m.quantile_coverage.get("P90", 0.0)
        return abs(p90_cov - 0.90)

    best_calibration = min(model_results, key=calibration_error).model_name

    logger.info(
        "Model comparison: %d models — best RMSE: %s, best MAE: %s,"
        " best skill: %s, best calibration: %s",
        len(model_results),
        best_rmse,
        best_mae,
        best_skill,
        best_calibration,
    )

    return ModelComparisonResult(
        model_metrics=model_results,
        best_rmse=best_rmse,
        best_mae=best_mae,
        best_skill=best_skill,
        best_calibration=best_calibration,
        ranking=ranking,
    )
