"""
XGBoost wind power forecasting with quantile regression and SHAP explainability.

Core ML service for P4. Trains gradient-boosted tree models to predict
wind turbine power output using engineered SCADA features + NWP data.
Produces probabilistic forecasts (P10/P50/P90) and global feature importance.

Physics — Gradient Boosting for Wind Power
--------------------------------------------
Wind power prediction is a regression task with non-linear relationships:
  P = ½ × ρ × A × Cp(λ,β) × v³

The cubic wind-speed dependence means small forecast errors amplify into
large power errors. Gradient boosting handles this by:
  1. Fitting sequential decision trees to residuals
  2. Learning non-linear feature interactions (e.g., TI × wind speed)
  3. Naturally handling the mixed-type feature space (continuous + cyclical)

Quantile regression (pinball loss) provides prediction intervals:
  L_τ(y, ŷ) = τ × max(y-ŷ, 0) + (1-τ) × max(ŷ-y, 0)

where τ = 0.10 (P10), 0.50 (P50/median), 0.90 (P90).

Forecast verification — quantiles and skill
--------------------------------------------
P10/P50/P90 here are QUANTILES of the power forecast: the real power should
fall below P10 one time in ten and above P90 one time in ten (Gneiting &
Raftery 2007). P90 is therefore the HIGH value. This is the opposite side
from energy-yield P90 (P1), which is the yield EXCEEDED with 90 % probability
— the low, bankable value. Same name, opposite tail.
  - P10: low side — the level to plan against when a shortfall is costly
  - P50: median forecast, the point forecast for day-ahead bidding
  - P90: high side — upper bound for curtailment / congestion planning

The skill score compares against persistence (P̂(t) = P(t−1)) on the same
test samples, as recommended by Madsen et al. (2005):
  SS = 1 - MSE_model / MSE_persistence
  SS > 0 means the model beats the naive baseline.

Maths — XGBoost Objective Functions
-------------------------------------
XGBoost minimizes a regularized objective at iteration t:
  L(t) = Σ l(yi, ŷi^(t-1) + ft(xi)) + Ω(ft)

where Ω(ft) = γT + ½λ‖w‖² penalizes tree complexity.

For quantile regression, the loss function becomes:
  l(y, ŷ) = τ(y-ŷ)⁺ + (1-τ)(ŷ-y)⁺

which is a piecewise linear (pinball) loss that shifts the predicted
distribution to the desired quantile level.

TimeSeriesSplit ensures no future leakage (5 splits → N/6 per block):
  Fold 1: train [0..N/6], test [N/6..2N/6]
  Fold 2: train [0..2N/6], test [2N/6..3N/6]
  ...
  Fold 5: train [0..5N/6], test [5N/6..N]

SHAP (SHapley Additive exPlanations) decomposes each prediction:
  f(x) = E[f(X)] + Σ φ_j(x)

where φ_j is the Shapley value for feature j — the average marginal
contribution across all possible feature coalitions.

References
----------
- Chen & Guestrin, "XGBoost: A Scalable Tree Boosting System" (KDD 2016)
- Lundberg & Lee, "SHAP: A Unified Approach to Interpreting Model Predictions"
- Madsen et al., "Standardizing the performance evaluation of short-term wind
  power prediction models", Wind Engineering 29(6), 2005
- Gneiting & Raftery, "Strictly proper scoring rules, prediction, and
  estimation", JASA 102(477), 2007
- Roadmap §5.7: XGBoost model, §5.10: SHAP, §5.11: Skill score
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import xgboost as xgb
from numpy.typing import NDArray
from sklearn.model_selection import TimeSeriesSplit

from app.services.p4.model_evaluation import skill_score_from_squared_errors
from app.services.p4.physical_constraints import enforce_physical_constraints
from app.services.p4.training_progress import PROGRESS

# ── Constants ─────────────────────────────────────────────────────

DEFAULT_QUANTILES: tuple[float, ...] = (0.10, 0.50, 0.90)


# ── Data Classes ──────────────────────────────────────────────────


@dataclass(frozen=True)
class XGBoostConfig:
    """Configuration for XGBoost wind power forecasting model.

    Attributes
    ----------
    n_estimators : int
        Maximum number of boosting rounds.
    max_depth : int
        Maximum tree depth. Controls model complexity.
    learning_rate : float
        Step size shrinkage. Smaller = more robust but slower.
    early_stopping_rounds : int
        Stop if validation loss doesn't improve for N rounds.
    n_cv_splits : int
        Number of TimeSeriesSplit folds.
    quantiles : tuple[float, ...]
        Quantile levels for probabilistic forecasting.
    seed : int
        Random seed for reproducibility.
    """

    n_estimators: int = 500
    max_depth: int = 8
    learning_rate: float = 0.05
    early_stopping_rounds: int = 50
    n_cv_splits: int = 5
    quantiles: tuple[float, ...] = DEFAULT_QUANTILES
    seed: int = 42


@dataclass(frozen=True)
class FoldMetrics:
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
    """

    fold_index: int
    rmse_mw: float
    mae_mw: float
    mape_pct: float
    r_squared: float


@dataclass(frozen=True)
class CVResult:
    """Cross-validation results across all folds.

    Attributes
    ----------
    fold_metrics : list[FoldMetrics]
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
        SS = 1 - MSE_model / MSE_persistence on the test samples. SS > 0 = model wins.
    """

    fold_metrics: list[FoldMetrics]
    mean_rmse_mw: float
    mean_mae_mw: float
    mean_mape_pct: float
    mean_r_squared: float
    skill_score_vs_persistence: float


@dataclass(frozen=True)
class ForecastResult:
    """Probabilistic power forecast output.

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
class SHAPResult:
    """SHAP explainability results for the P50 model.

    Attributes
    ----------
    shap_values : NDArray[np.float64]
        Per-sample SHAP values, shape (n_samples, n_features).
    feature_names : list[str]
        Feature names corresponding to columns.
    feature_importance : dict[str, float]
        Mean |SHAP| value per feature (global importance ranking).
    """

    shap_values: NDArray[np.float64]
    feature_names: list[str]
    feature_importance: dict[str, float] = field(default_factory=dict)


# ── Helper Functions ──────────────────────────────────────────────


def _compute_metrics(
    y_true: NDArray[np.float64],
    y_pred: NDArray[np.float64],
    fold_index: int,
) -> FoldMetrics:
    """Compute regression metrics for a single fold."""
    residuals = y_true - y_pred

    rmse = float(np.sqrt(np.mean(residuals**2)))
    mae = float(np.mean(np.abs(residuals)))

    # MAPE: avoid division by zero for near-zero actual values
    nonzero_mask = np.abs(y_true) > 0.1  # Skip near-zero power
    if np.any(nonzero_mask):
        mape = float(np.mean(np.abs(residuals[nonzero_mask] / y_true[nonzero_mask])) * 100.0)
    else:
        mape = 0.0

    # R²: 1 - SS_res / SS_tot
    ss_res = float(np.sum(residuals**2))
    ss_tot = float(np.sum((y_true - np.mean(y_true)) ** 2))
    r_squared = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0

    return FoldMetrics(
        fold_index=fold_index,
        rmse_mw=round(rmse, 4),
        mae_mw=round(mae, 4),
        mape_pct=round(mape, 2),
        r_squared=round(r_squared, 4),
    )


def _dmatrix(
    x: NDArray[np.float64], y: NDArray[np.float64] | None, persistence_column: int | None
) -> xgb.DMatrix:
    """DMatrix whose base margin is P(t−1) when a persistence column is given: the trees
    then learn the change from persistence, which they represent far better than the
    near-identity map from P(t−1) to P(t)."""
    margin = None if persistence_column is None else x[:, persistence_column]
    return xgb.DMatrix(x, label=y, base_margin=margin)


def _train_quantile_model(
    x_train: NDArray[np.float64],
    y_train: NDArray[np.float64],
    x_val: NDArray[np.float64],
    y_val: NDArray[np.float64],
    quantile: float,
    config: XGBoostConfig,
    persistence_column: int | None = None,
) -> xgb.Booster:
    """Train a single XGBoost model for one quantile level."""
    dtrain = _dmatrix(x_train, y_train, persistence_column)
    dval = _dmatrix(x_val, y_val, persistence_column)

    params: dict[str, object] = {
        "objective": "reg:quantileerror",
        "quantile_alpha": quantile,
        "max_depth": config.max_depth,
        "learning_rate": config.learning_rate,
        "seed": config.seed,
        "verbosity": 0,
    }

    model = xgb.train(
        params,
        dtrain,
        num_boost_round=config.n_estimators,
        evals=[(dval, "val")],
        early_stopping_rounds=config.early_stopping_rounds,
        verbose_eval=False,
    )
    if persistence_column is not None:
        model.set_attr(persistence_column=str(persistence_column))
    return model


def _predict(model: xgb.Booster, x: NDArray[np.float64]) -> NDArray[np.float64]:
    column = model.attr("persistence_column")
    return np.asarray(
        model.predict(_dmatrix(x, None, None if column is None else int(column))),
        dtype=np.float64,
    )


# ── Public API ────────────────────────────────────────────────────


def train_xgboost(
    features: NDArray[np.float64],
    target_power_mw: NDArray[np.float64],
    config: XGBoostConfig | None = None,
    persistence_column: int | None = None,
) -> tuple[CVResult, list[xgb.Booster]]:
    """Train XGBoost models with TimeSeriesSplit cross-validation.

    Trains 3 quantile models (P10/P50/P90) per fold using TimeSeriesSplit.
    Returns CV metrics from all folds and trained models from the last fold.
    Early stopping uses the last 20 % of each training fold, never the test fold.
    With ``persistence_column`` (the index of P(t−1), ``power_lag_1``) the models
    learn the correction to persistence. The skill score compares with persistence
    on the same test samples.

    Parameters
    ----------
    features : NDArray[np.float64]
        Feature matrix, shape (n_samples, n_features).
    target_power_mw : NDArray[np.float64]
        Target power values [MW], shape (n_samples,).
    config : XGBoostConfig, optional
        Model configuration.
    persistence_column : int, optional
        Column of ``features`` holding P(t−1): the base margin of every model.

    Returns
    -------
    tuple of (CVResult, list[xgb.Booster])
        CV metrics and list of 3 trained Booster models [P10, P50, P90].
    """
    if config is None:
        config = XGBoostConfig()

    tscv = TimeSeriesSplit(n_splits=config.n_cv_splits)
    fold_metrics_list: list[FoldMetrics] = []
    last_fold_models: list[xgb.Booster] = []
    n_jobs = config.n_cv_splits * len(config.quantiles)
    PROGRESS.stage("xgboost", "running", f"{features.shape[0]} rows × {features.shape[1]} features")

    persistence_sq: list[float] = []
    for fold_idx, (train_idx, test_idx) in enumerate(tscv.split(features)):
        n_fit = max(1, int(len(train_idx) * 0.8))
        fit_idx, stop_idx = train_idx[:n_fit], train_idx[n_fit:]
        if len(stop_idx) == 0:
            stop_idx = fit_idx
        x_test = features[test_idx]
        y_test = target_power_mw[test_idx]

        # Train 3 quantile models
        fold_models: list[xgb.Booster] = []
        for q_idx, quantile in enumerate(config.quantiles):
            PROGRESS.fraction(
                "xgboost",
                (fold_idx * len(config.quantiles) + q_idx) / n_jobs,
                f"fold {fold_idx + 1}/{config.n_cv_splits} · P{round(quantile * 100)} trees",
            )
            model = _train_quantile_model(
                features[fit_idx],
                target_power_mw[fit_idx],
                features[stop_idx],
                target_power_mw[stop_idx],
                quantile,
                config,
                persistence_column,
            )
            fold_models.append(model)

        # Evaluate using P50 (median) model
        p50_model = fold_models[1]  # Index 1 = P50 (0.50 quantile)
        y_pred = _predict(p50_model, x_test)
        # Persistence on the same samples: P̂(t) = P(t−1)
        persistence_sq.extend((y_test - target_power_mw[test_idx - 1]) ** 2)

        metrics = _compute_metrics(y_test, y_pred, fold_idx)
        fold_metrics_list.append(metrics)
        last_fold_models = fold_models
        PROGRESS.fold("xgboost", fold_idx, metrics.rmse_mw)

    # Aggregate metrics across folds
    mean_rmse = float(np.mean([m.rmse_mw for m in fold_metrics_list]))
    mean_mae = float(np.mean([m.mae_mw for m in fold_metrics_list]))
    mean_mape = float(np.mean([m.mape_pct for m in fold_metrics_list]))
    mean_r2 = float(np.mean([m.r_squared for m in fold_metrics_list]))

    # Skill score vs persistence on the same test samples (TimeSeriesSplit folds are
    # equal-sized, so the mean of the fold MSEs is the MSE over all test samples)
    fold_mse = [m.rmse_mw**2 for m in fold_metrics_list]
    skill_score = skill_score_from_squared_errors(fold_mse, persistence_sq)

    cv_result = CVResult(
        fold_metrics=fold_metrics_list,
        mean_rmse_mw=round(mean_rmse, 4),
        mean_mae_mw=round(mean_mae, 4),
        mean_mape_pct=round(mean_mape, 2),
        mean_r_squared=round(mean_r2, 4),
        skill_score_vs_persistence=round(skill_score, 4),
    )

    PROGRESS.model_done("xgboost", cv_result.mean_rmse_mw, cv_result.skill_score_vs_persistence)
    return cv_result, last_fold_models


def predict_xgboost(
    models: list[xgb.Booster],
    features: NDArray[np.float64],
    wind_speed_ms: NDArray[np.float64],
    timestamps_utc: NDArray[np.int64] | None = None,
) -> ForecastResult:
    """Generate probabilistic power forecast using trained XGBoost models.

    Runs 3 models (P10/P50/P90), enforces physical constraints, and
    ensures quantile monotonicity: P10 ≤ P50 ≤ P90.

    Parameters
    ----------
    models : list[xgb.Booster]
        Trained models [P10, P50, P90].
    features : NDArray[np.float64]
        Feature matrix, shape (n_samples, n_features).
    wind_speed_ms : NDArray[np.float64]
        Wind speed for constraint enforcement, shape (n_samples,).
    timestamps_utc : NDArray[np.int64], optional
        Timestamps for the forecast period.

    Returns
    -------
    ForecastResult
        Probabilistic forecast with physical constraints applied.
    """
    n = features.shape[0]

    # Predict with each quantile model (base margin P(t−1) if it was trained with one)
    raw_predictions = [_predict(model, features) for model in models]

    # Apply physical constraints to each quantile
    constrained: list[NDArray[np.float64]] = []
    for pred in raw_predictions:
        result = enforce_physical_constraints(
            power_mw=pred,
            wind_speed_ms=wind_speed_ms,
        )
        constrained.append(result.power_mw)

    p10 = constrained[0]
    p50 = constrained[1]
    p90 = constrained[2]

    # Enforce monotonicity: P10 ≤ P50 ≤ P90
    p50 = np.maximum(p50, p10)
    p90 = np.maximum(p90, p50)

    if timestamps_utc is None:
        start = 1_704_067_200
        timestamps_utc = np.arange(start, start + n * 600, 600, dtype=np.int64)

    return ForecastResult(
        power_p10_mw=p10,
        power_p50_mw=p50,
        power_p90_mw=p90,
        wind_speed_ms=wind_speed_ms,
        timestamps_utc=timestamps_utc,
    )


def compute_shap_values(
    model_p50: xgb.Booster,
    features: NDArray[np.float64],
    feature_names: list[str],
) -> SHAPResult:
    """Compute SHAP values for the P50 model.

    Uses TreeExplainer for exact Shapley values on tree-based models.
    Returns per-sample values and global feature importance ranking.

    Parameters
    ----------
    model_p50 : xgb.Booster
        Trained P50 XGBoost model.
    features : NDArray[np.float64]
        Feature matrix, shape (n_samples, n_features).
    feature_names : list[str]
        Names for each feature column.

    Returns
    -------
    SHAPResult
        SHAP values and feature importance ranking.
    """
    import shap  # Lazy import: numba/shap have heavy native deps

    explainer = shap.TreeExplainer(model_p50)
    shap_values_raw = explainer.shap_values(features)

    # Ensure numpy array
    shap_array: NDArray[np.float64] = np.asarray(shap_values_raw, dtype=np.float64)

    # Global feature importance: mean |SHAP| per feature
    mean_abs_shap = np.mean(np.abs(shap_array), axis=0)
    importance_dict: dict[str, float] = {}
    for i, name in enumerate(feature_names):
        importance_dict[name] = round(float(mean_abs_shap[i]), 6)

    # Sort by importance (descending)
    importance_dict = dict(sorted(importance_dict.items(), key=lambda x: x[1], reverse=True))

    return SHAPResult(
        shap_values=shap_array,
        feature_names=feature_names,
        feature_importance=importance_dict,
    )
