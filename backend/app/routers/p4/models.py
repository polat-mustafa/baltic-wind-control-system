"""P4 sub-router: XGBoost, LSTM, and TFT model training and prediction."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter

from app.schemas.forecast import (
    FeatureImportanceSchema,
    FoldMetricsSchema,
    LSTMFoldMetricsSchema,
    LSTMPredictRequest,
    LSTMPredictResponse,
    LSTMTrainRequest,
    LSTMTrainResponse,
    MCDropoutRequest,
    MCDropoutResponse,
    SHAPRequest,
    SHAPResponse,
    TFTAttentionRequest,
    TFTAttentionResponse,
    TFTFoldMetricsSchema,
    TFTPredictRequest,
    TFTPredictResponse,
    TFTTrainRequest,
    TFTTrainResponse,
    VariableImportanceSchema,
    XGBoostPredictRequest,
    XGBoostPredictResponse,
    XGBoostTrainRequest,
    XGBoostTrainResponse,
)
from app.services.p4.lstm_model import (
    LSTMConfig,
    MCDropoutDetail,
    compute_mc_dropout_detail,
    predict_lstm,
    train_lstm,
)
from app.services.p4.tft_model import (
    AttentionWeights,
    TFTConfig,
    compute_attention_weights,
    predict_tft,
    train_tft,
)
from app.services.p4.xgboost_model import (
    XGBoostConfig,
    compute_shap_values,
    predict_xgboost,
    train_xgboost,
)

from ._pipeline import _get_pipeline_data

router = APIRouter()


# ── XGBoost Training ───────────────────────────────────────────────


@router.post("/train-xgboost", response_model=XGBoostTrainResponse)
async def train_xgboost_endpoint(
    request: XGBoostTrainRequest,
) -> XGBoostTrainResponse:
    """Train XGBoost model with TimeSeriesSplit cross-validation.

    Pipeline: generate SCADA → quality filter → engineer features →
    merge NWP → train XGBoost → return CV metrics.
    """
    features, target, _, _, feature_names = await _get_pipeline_data(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        turbine_index=request.turbine_index,
        seed=request.seed,
    )

    def _train() -> tuple[Any, ...]:
        xgb_config = XGBoostConfig(
            n_estimators=request.n_estimators,
            max_depth=request.max_depth,
            learning_rate=request.learning_rate,
            seed=request.seed if request.seed is not None else 42,
        )
        cv_result, _ = train_xgboost(features, target, xgb_config)
        return cv_result, feature_names, features.shape[0]

    cv_result, feature_names, num_samples = await asyncio.to_thread(_train)

    fold_schemas = [
        FoldMetricsSchema(
            fold_index=m.fold_index,
            rmse_mw=m.rmse_mw,
            mae_mw=m.mae_mw,
            mape_pct=m.mape_pct,
            r_squared=m.r_squared,
        )
        for m in cv_result.fold_metrics
    ]

    return XGBoostTrainResponse(
        fold_metrics=fold_schemas,
        mean_rmse_mw=cv_result.mean_rmse_mw,
        mean_mae_mw=cv_result.mean_mae_mw,
        mean_mape_pct=cv_result.mean_mape_pct,
        mean_r_squared=cv_result.mean_r_squared,
        skill_score_vs_persistence=cv_result.skill_score_vs_persistence,
        feature_names=feature_names,
        num_features=len(feature_names),
        training_samples=num_samples,
    )


# ── XGBoost Prediction ────────────────────────────────────────────


@router.post("/predict-xgboost", response_model=XGBoostPredictResponse)
async def predict_xgboost_endpoint(
    request: XGBoostPredictRequest,
) -> XGBoostPredictResponse:
    """Generate probabilistic P10/P50/P90 power forecast.

    Pipeline: generate SCADA → filter → features → NWP → train → predict.
    Returns the last `horizon_steps` of the forecast.
    """
    features, target, wind_speed, timestamps, _ = await _get_pipeline_data(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        turbine_index=request.turbine_index,
        seed=request.seed,
    )

    def _predict() -> tuple[Any, ...]:
        xgb_config = XGBoostConfig(
            seed=request.seed if request.seed is not None else 42,
        )
        _, models = train_xgboost(features, target, xgb_config)
        horizon = min(request.horizon_steps, features.shape[0])
        forecast = predict_xgboost(
            models, features[-horizon:], wind_speed[-horizon:], timestamps[-horizon:]
        )
        return forecast, horizon

    forecast, horizon = await asyncio.to_thread(_predict)

    return XGBoostPredictResponse(
        power_p10_mw=[round(float(v), 4) for v in forecast.power_p10_mw],
        power_p50_mw=[round(float(v), 4) for v in forecast.power_p50_mw],
        power_p90_mw=[round(float(v), 4) for v in forecast.power_p90_mw],
        wind_speed_ms=[round(float(v), 4) for v in forecast.wind_speed_ms],
        timestamps_utc=[int(t) for t in forecast.timestamps_utc],
        num_steps=horizon,
    )


# ── SHAP Explainability ───────────────────────────────────────────


@router.post("/xgboost-shap", response_model=SHAPResponse)
async def xgboost_shap_endpoint(
    request: SHAPRequest,
) -> SHAPResponse:
    """Compute SHAP feature importance for the XGBoost P50 model.

    Pipeline: generate data → train → compute SHAP → return importance.
    """
    features, target, _, _, feature_names = await _get_pipeline_data(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        turbine_index=request.turbine_index,
        seed=request.seed,
    )

    def _compute_shap() -> tuple[Any, ...]:
        xgb_config = XGBoostConfig(
            seed=request.seed if request.seed is not None else 42,
        )
        _, models = train_xgboost(features, target, xgb_config)
        model_p50 = models[1]  # P50 = index 1
        shap_result = compute_shap_values(model_p50, features, feature_names)
        return shap_result, feature_names, features

    shap_result, feature_names, _features = await asyncio.to_thread(_compute_shap)

    # Build response
    top_k = min(request.top_k_features, len(feature_names))
    importance_list = [
        FeatureImportanceSchema(name=name, importance=round(imp, 6))
        for name, imp in shap_result.feature_importance.items()
    ]

    top_features = [item.name for item in importance_list[:top_k]]

    # Sample SHAP values (first 10 rows)
    n_sample = min(10, shap_result.shap_values.shape[0])
    shap_sample = [[round(float(v), 6) for v in row] for row in shap_result.shap_values[:n_sample]]

    return SHAPResponse(
        feature_importance=importance_list,
        top_features=top_features,
        shap_values_sample=shap_sample,
    )


# ── LSTM Training ────────────────────────────────────────────────


@router.post("/train-lstm", response_model=LSTMTrainResponse)
async def train_lstm_endpoint(
    request: LSTMTrainRequest,
) -> LSTMTrainResponse:
    """Train LSTM model with TimeSeriesSplit cross-validation.

    Pipeline: generate SCADA → quality filter → engineer features →
    merge NWP → normalize → create sequences → train LSTM → return CV metrics.
    """
    features, target, _, _, feature_names = await _get_pipeline_data(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        turbine_index=request.turbine_index,
        seed=request.seed,
    )

    def _train() -> tuple[Any, ...]:
        lstm_config = LSTMConfig(
            lookback=request.lookback,
            hidden_units=(request.hidden_units_l1, request.hidden_units_l2),
            dropout=request.dropout,
            learning_rate=request.learning_rate,
            epochs=request.epochs,
            patience=request.patience,
            batch_size=request.batch_size,
            seed=request.seed if request.seed is not None else 42,
        )
        cv_result, _, _ = train_lstm(features, target, lstm_config)
        return cv_result, feature_names, features.shape[0]

    cv_result, feature_names, num_samples = await asyncio.to_thread(_train)

    fold_schemas = [
        LSTMFoldMetricsSchema(
            fold_index=m.fold_index,
            rmse_mw=m.rmse_mw,
            mae_mw=m.mae_mw,
            mape_pct=m.mape_pct,
            r_squared=m.r_squared,
            training_epochs=m.training_epochs,
        )
        for m in cv_result.fold_metrics
    ]

    return LSTMTrainResponse(
        fold_metrics=fold_schemas,
        mean_rmse_mw=cv_result.mean_rmse_mw,
        mean_mae_mw=cv_result.mean_mae_mw,
        mean_mape_pct=cv_result.mean_mape_pct,
        mean_r_squared=cv_result.mean_r_squared,
        skill_score_vs_persistence=cv_result.skill_score_vs_persistence,
        architecture_summary=cv_result.architecture_summary,
        feature_names=feature_names,
        num_features=len(feature_names),
        training_samples=num_samples,
    )


# ── LSTM Prediction ──────────────────────────────────────────────


@router.post("/predict-lstm", response_model=LSTMPredictResponse)
async def predict_lstm_endpoint(
    request: LSTMPredictRequest,
) -> LSTMPredictResponse:
    """Generate LSTM probabilistic P10/P50/P90 power forecast via MC Dropout.

    Pipeline: generate SCADA → filter → features → NWP → train →
    MC Dropout (N passes) → P10/P50/P90 → physical constraints.
    """
    features, target, wind_speed, timestamps, _ = await _get_pipeline_data(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        turbine_index=request.turbine_index,
        seed=request.seed,
    )

    def _predict() -> tuple[Any, ...]:
        lstm_config = LSTMConfig(
            lookback=request.lookback,
            mc_samples=request.mc_samples,
            seed=request.seed if request.seed is not None else 42,
        )
        _, model, norm_params = train_lstm(features, target, lstm_config)
        horizon = min(request.horizon_steps + request.lookback - 1, features.shape[0])
        forecast = predict_lstm(
            model,
            features[-horizon:],
            wind_speed[-horizon:],
            norm_params,
            lstm_config,
            timestamps[-horizon:],
        )
        return forecast, request.horizon_steps

    forecast, horizon_steps = await asyncio.to_thread(_predict)
    n = min(horizon_steps, len(forecast.power_p50_mw))

    return LSTMPredictResponse(
        power_p10_mw=[round(float(v), 4) for v in forecast.power_p10_mw[-n:]],
        power_p50_mw=[round(float(v), 4) for v in forecast.power_p50_mw[-n:]],
        power_p90_mw=[round(float(v), 4) for v in forecast.power_p90_mw[-n:]],
        mc_mean_mw=[round(float(v), 4) for v in forecast.mc_mean_mw[-n:]],
        mc_std_mw=[round(float(v), 4) for v in forecast.mc_std_mw[-n:]],
        wind_speed_ms=[round(float(v), 4) for v in forecast.wind_speed_ms[-n:]],
        timestamps_utc=[int(t) for t in forecast.timestamps_utc[-n:]],
        num_steps=n,
    )


# ── MC Dropout Visualization ────────────────────────────────────


@router.post("/lstm-mc-dropout", response_model=MCDropoutResponse)
async def lstm_mc_dropout_endpoint(
    request: MCDropoutRequest,
) -> MCDropoutResponse:
    """Return detailed MC Dropout passes for uncertainty visualization.

    Each pass is a full forward pass with a different dropout mask,
    producing an ensemble of predictions that visualize epistemic uncertainty.
    """
    features, target, _, _, _ = await _get_pipeline_data(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        turbine_index=request.turbine_index,
        seed=request.seed,
    )

    def _compute() -> MCDropoutDetail:
        lstm_config = LSTMConfig(
            lookback=request.lookback,
            mc_samples=request.mc_samples,
            seed=request.seed if request.seed is not None else 42,
        )
        _, model, norm_params = train_lstm(features, target, lstm_config)
        horizon = min(request.horizon_steps + request.lookback - 1, features.shape[0])
        mc_detail = compute_mc_dropout_detail(model, features[-horizon:], norm_params, lstm_config)
        return mc_detail

    mc_detail = await asyncio.to_thread(_compute)

    # Trim to requested horizon
    n = min(request.horizon_steps, mc_detail.all_passes.shape[1] if mc_detail.num_passes > 0 else 0)

    return MCDropoutResponse(
        all_passes=[
            [round(float(v), 4) for v in pass_row[-n:]] for pass_row in mc_detail.all_passes
        ],
        mean_mw=[round(float(v), 4) for v in mc_detail.mean_mw[-n:]],
        std_mw=[round(float(v), 4) for v in mc_detail.std_mw[-n:]],
        num_passes=mc_detail.num_passes,
    )


# ── TFT Training ─────────────────────────────────────────────────


@router.post("/train-tft", response_model=TFTTrainResponse)
async def train_tft_endpoint(
    request: TFTTrainRequest,
) -> TFTTrainResponse:
    """Train TFT model with TimeSeriesSplit cross-validation.

    Pipeline: generate SCADA → quality filter → engineer features →
    merge NWP → normalize → create sequences → train TFT → return CV metrics.

    TFT uses native quantile regression (pinball loss) for P10/P50/P90
    instead of MC Dropout, and provides attention-based explainability.
    """
    features, target, _, _, feature_names = await _get_pipeline_data(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        turbine_index=request.turbine_index,
        seed=request.seed,
    )

    def _train() -> tuple[Any, ...]:
        tft_config = TFTConfig(
            lookback=request.lookback,
            hidden_size=request.hidden_size,
            num_attention_heads=request.num_attention_heads,
            dropout=request.dropout,
            learning_rate=request.learning_rate,
            epochs=request.epochs,
            patience=request.patience,
            batch_size=request.batch_size,
            seed=request.seed if request.seed is not None else 42,
        )
        cv_result, _, _ = train_tft(features, target, tft_config)
        return cv_result, feature_names, features.shape[0]

    cv_result, feature_names, training_samples = await asyncio.to_thread(_train)

    fold_schemas = [
        TFTFoldMetricsSchema(
            fold_index=m.fold_index,
            rmse_mw=m.rmse_mw,
            mae_mw=m.mae_mw,
            mape_pct=m.mape_pct,
            r_squared=m.r_squared,
            training_epochs=m.training_epochs,
        )
        for m in cv_result.fold_metrics
    ]

    return TFTTrainResponse(
        fold_metrics=fold_schemas,
        mean_rmse_mw=cv_result.mean_rmse_mw,
        mean_mae_mw=cv_result.mean_mae_mw,
        mean_mape_pct=cv_result.mean_mape_pct,
        mean_r_squared=cv_result.mean_r_squared,
        skill_score_vs_persistence=cv_result.skill_score_vs_persistence,
        architecture_summary=cv_result.architecture_summary,
        feature_names=feature_names,
        num_features=len(feature_names),
        training_samples=training_samples,
    )


# ── TFT Prediction ──────────────────────────────────────────────


@router.post("/predict-tft", response_model=TFTPredictResponse)
async def predict_tft_endpoint(
    request: TFTPredictRequest,
) -> TFTPredictResponse:
    """Generate TFT probabilistic P10/P50/P90 power forecast.

    Pipeline: generate SCADA → filter → features → NWP → train →
    quantile regression → P10/P50/P90 → physical constraints.

    Unlike LSTM MC Dropout, TFT produces quantiles natively via
    separate output heads trained with pinball loss.
    """
    features, target, wind_speed, timestamps, _ = await _get_pipeline_data(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        turbine_index=request.turbine_index,
        seed=request.seed,
    )

    def _predict() -> tuple[Any, ...]:
        tft_config = TFTConfig(
            lookback=request.lookback,
            seed=request.seed if request.seed is not None else 42,
        )
        _, model, norm_params = train_tft(features, target, tft_config)
        horizon = min(request.horizon_steps + request.lookback - 1, features.shape[0])
        forecast = predict_tft(
            model,
            features[-horizon:],
            wind_speed[-horizon:],
            norm_params,
            tft_config,
            timestamps[-horizon:],
        )
        return forecast, request.horizon_steps

    forecast, horizon_steps = await asyncio.to_thread(_predict)
    n = min(horizon_steps, len(forecast.power_p50_mw))

    return TFTPredictResponse(
        power_p10_mw=[round(float(v), 4) for v in forecast.power_p10_mw[-n:]],
        power_p50_mw=[round(float(v), 4) for v in forecast.power_p50_mw[-n:]],
        power_p90_mw=[round(float(v), 4) for v in forecast.power_p90_mw[-n:]],
        wind_speed_ms=[round(float(v), 4) for v in forecast.wind_speed_ms[-n:]],
        timestamps_utc=[int(t) for t in forecast.timestamps_utc[-n:]],
        num_steps=n,
    )


# ── TFT Attention Visualization ─────────────────────────────────


@router.post("/tft-attention", response_model=TFTAttentionResponse)
async def tft_attention_endpoint(
    request: TFTAttentionRequest,
) -> TFTAttentionResponse:
    """Return TFT attention weights and variable importance for visualization.

    Extracts:
    1. Temporal attention weights — which past timesteps influenced predictions
    2. Variable importance — which features the VSN selects (sum = 1.0)
    """

    features, target, _, _, feature_names = await _get_pipeline_data(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        turbine_index=request.turbine_index,
        seed=request.seed,
    )

    def _compute() -> AttentionWeights:
        tft_config = TFTConfig(
            lookback=request.lookback,
            seed=request.seed if request.seed is not None else 42,
        )
        _, model, norm_params = train_tft(features, target, tft_config)
        horizon = min(request.horizon_steps + request.lookback - 1, features.shape[0])
        attn_result = compute_attention_weights(
            model,
            features[-horizon:],
            norm_params,
            tft_config,
            feature_names,
        )
        return attn_result

    attn_result = await asyncio.to_thread(_compute)

    # Sample temporal weights (first 10 steps for response size)
    n_sample = min(10, attn_result.temporal_weights.shape[0])
    temporal_sample = [
        [round(float(v), 6) for v in row] for row in attn_result.temporal_weights[:n_sample]
    ]

    importance_list = [
        VariableImportanceSchema(name=name, importance=round(imp, 6))
        for name, imp in attn_result.variable_importance.items()
    ]

    return TFTAttentionResponse(
        temporal_weights_sample=temporal_sample,
        variable_importance=importance_list,
        num_attention_heads=attn_result.num_heads,
    )
