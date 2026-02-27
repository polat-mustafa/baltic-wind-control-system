"""
P4 Machine Learning forecasting API endpoints.

Provides REST endpoints for:
- Turbine specification: V236-15.0 MW parameters
- Power curve generation: IEC 61400-12-1 power performance model
- SCADA data synthesis: 34-turbine, 1-year synthetic dataset
- Quality filtering: 5-filter pipeline per Roadmap §5.3
- Feature engineering: physical feature extraction per §5.5
- Constraint enforcement: post-processing validation per §5.9
- XGBoost training: gradient boosting with TimeSeriesSplit CV per §5.7
- XGBoost prediction: probabilistic P10/P50/P90 forecasting per §5.11
- SHAP explainability: feature importance analysis per §5.10
- LSTM training: 2-layer LSTM with TimeSeriesSplit CV per §5.8
- LSTM prediction: MC Dropout → P10/P50/P90 forecasting per §5.11
- MC Dropout visualization: detailed uncertainty passes
- TFT training: Temporal Fusion Transformer with quantile regression per §5.6
- TFT prediction: native P10/P50/P90 forecasting with attention weights
- TFT attention: variable importance and temporal attention visualization

All endpoints follow the convention: /api/v1/forecast/{resource}
"""

from __future__ import annotations

import numpy as np
from fastapi import APIRouter

from app.schemas.forecast import (
    ConstraintCheckRequest,
    ConstraintCheckResponse,
    ConstraintViolationSchema,
    EnsemblePredictRequest,
    EnsemblePredictResponse,
    FeatureEngineeringRequest,
    FeatureEngineeringResponse,
    FeatureImportanceSchema,
    FoldMetricsSchema,
    GenerateSCADARequest,
    GridAlertSchema,
    LSTMFoldMetricsSchema,
    LSTMPredictRequest,
    LSTMPredictResponse,
    LSTMTrainRequest,
    LSTMTrainResponse,
    MCDropoutRequest,
    MCDropoutResponse,
    ModelCompareRequest,
    ModelCompareResponse,
    ModelMetricsSchema,
    PowerCurveRequest,
    PowerCurveResponse,
    QualityFilterRequest,
    QualityFilterResponse,
    QualityFlagSchema,
    RampDetectRequest,
    RampDetectResponse,
    RampEventSchema,
    SCADADatasetSummary,
    SHAPRequest,
    SHAPResponse,
    TFTAttentionRequest,
    TFTAttentionResponse,
    TFTFoldMetricsSchema,
    TFTPredictRequest,
    TFTPredictResponse,
    TFTTrainRequest,
    TFTTrainResponse,
    TurbineSpecSchema,
    VariableImportanceSchema,
    XGBoostPredictRequest,
    XGBoostPredictResponse,
    XGBoostTrainRequest,
    XGBoostTrainResponse,
)
from app.services.p4.ensemble_model import (
    ModelForecasts,
    compute_ensemble_forecast,
)
from app.services.p4.feature_engineering import FeatureConfig, engineer_features
from app.services.p4.lstm_model import (
    LSTMConfig,
    compute_mc_dropout_detail,
    predict_lstm,
    train_lstm,
)
from app.services.p4.model_evaluation import (
    compare_models,
    evaluate_model,
)
from app.services.p4.nwp_pipeline import NWPConfig, generate_nwp_dataset, merge_nwp_features
from app.services.p4.physical_constraints import enforce_physical_constraints
from app.services.p4.ramp_detection import (
    RampConfig,
    detect_all_ramps,
    generate_grid_alerts,
)
from app.services.p4.scada_generator import SCADAConfig, generate_scada_dataset
from app.services.p4.scada_quality_filters import apply_all_quality_filters
from app.services.p4.tft_model import (
    TFTConfig,
    compute_attention_weights,
    predict_tft,
    train_tft,
)
from app.services.p4.turbine_power_curve import (
    build_power_curve,
    get_v236_spec,
)
from app.services.p4.xgboost_model import (
    XGBoostConfig,
    compute_shap_values,
    predict_xgboost,
    train_xgboost,
)

router = APIRouter(prefix="/api/v1/forecast", tags=["P4 — ML Forecasting"])


# ── Turbine Specification ─────────────────────────────────────────


@router.get("/turbine-spec", response_model=TurbineSpecSchema)
async def get_turbine_spec() -> TurbineSpecSchema:
    """Return V236-15.0 MW turbine specifications."""
    spec = get_v236_spec()
    return TurbineSpecSchema(
        name=spec.name,
        rotor_diameter_m=spec.rotor_diameter_m,
        hub_height_m=spec.hub_height_m,
        rated_power_mw=spec.rated_power_mw,
        cut_in_speed_ms=spec.cut_in_speed_ms,
        rated_speed_ms=spec.rated_speed_ms,
        cut_out_speed_ms=spec.cut_out_speed_ms,
        num_blades=spec.num_blades,
        cp_max=spec.cp_max,
        ct_rated=spec.ct_rated,
    )


# ── Power Curve ───────────────────────────────────────────────────


@router.post("/power-curve", response_model=PowerCurveResponse)
async def generate_power_curve(request: PowerCurveRequest) -> PowerCurveResponse:
    """Generate IEC 61400-12-1 power curve for V236-15.0 MW."""
    result = build_power_curve(
        wind_step_ms=request.wind_step_ms,
        air_density_kg_m3=request.air_density_kg_m3,
    )
    return PowerCurveResponse(
        spec=TurbineSpecSchema(
            name=result.spec.name,
            rotor_diameter_m=result.spec.rotor_diameter_m,
            hub_height_m=result.spec.hub_height_m,
            rated_power_mw=result.spec.rated_power_mw,
            cut_in_speed_ms=result.spec.cut_in_speed_ms,
            rated_speed_ms=result.spec.rated_speed_ms,
            cut_out_speed_ms=result.spec.cut_out_speed_ms,
            num_blades=result.spec.num_blades,
            cp_max=result.spec.cp_max,
            ct_rated=result.spec.ct_rated,
        ),
        wind_speeds_ms=result.wind_speeds_ms.tolist(),
        power_mw=result.power_mw.tolist(),
        ct=result.ct.tolist(),
        swept_area_m2=result.swept_area_m2,
        air_density_kg_m3=result.air_density_kg_m3,
        num_points=len(result.wind_speeds_ms),
    )


# ── SCADA Generation ─────────────────────────────────────────────


@router.post("/generate-scada", response_model=SCADADatasetSummary)
async def generate_scada(request: GenerateSCADARequest) -> SCADADatasetSummary:
    """Generate synthetic SCADA dataset for the wind farm."""
    config = SCADAConfig(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        weibull_a=request.weibull_a,
        weibull_k=request.weibull_k,
        seed=request.seed,
    )
    dataset = generate_scada_dataset(config)

    # Compute status counts
    unique, counts = np.unique(dataset.status, return_counts=True)
    status_counts = dict(zip(unique.tolist(), counts.tolist(), strict=True))

    return SCADADatasetSummary(
        num_turbines=config.num_turbines,
        num_timesteps=config.num_timesteps,
        total_data_points=config.num_turbines * config.num_timesteps,
        wind_speed_mean_ms=round(float(np.mean(dataset.wind_speed_ms)), 2),
        wind_speed_max_ms=round(float(np.max(dataset.wind_speed_ms)), 2),
        power_mean_mw=round(float(np.mean(dataset.power_mw)), 2),
        power_max_mw=round(float(np.max(dataset.power_mw)), 2),
        status_counts=status_counts,
        start_timestamp=int(dataset.timestamps[0]),
        end_timestamp=int(dataset.timestamps[-1]),
    )


# ── Quality Filtering ────────────────────────────────────────────


@router.post("/quality-filter", response_model=QualityFilterResponse)
async def run_quality_filters(
    request: QualityFilterRequest,
) -> QualityFilterResponse:
    """Run 5 quality filters on synthetic SCADA data."""
    config = SCADAConfig(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        seed=request.seed,
    )
    dataset = generate_scada_dataset(config)

    result = apply_all_quality_filters(
        wind_speed=dataset.wind_speed_ms,
        power=dataset.power_mw,
        status=dataset.status,
        temperature=dataset.temperature_c,
        humidity=dataset.humidity_pct,
    )

    sample_flags = [
        QualityFlagSchema(
            filter_type=f.filter_type.value,
            turbine_index=f.turbine_index,
            timestep_index=f.timestep_index,
            reason=f.reason,
        )
        for f in result.flags[:50]
    ]

    return QualityFilterResponse(
        total_points=result.total_points,
        total_flagged=result.total_flagged,
        availability_pct=result.availability_pct,
        counts_by_filter=result.counts_by_filter,
        sample_flags=sample_flags,
    )


# ── Feature Engineering ──────────────────────────────────────────


@router.post("/features", response_model=FeatureEngineeringResponse)
async def run_feature_engineering(
    request: FeatureEngineeringRequest,
) -> FeatureEngineeringResponse:
    """Run feature engineering pipeline on filtered SCADA data."""
    config = SCADAConfig(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        seed=request.seed,
    )
    dataset = generate_scada_dataset(config)

    # Apply quality filters first
    filter_result = apply_all_quality_filters(
        wind_speed=dataset.wind_speed_ms,
        power=dataset.power_mw,
        status=dataset.status,
        temperature=dataset.temperature_c,
        humidity=dataset.humidity_pct,
    )

    # Run feature engineering
    turbine_idx = min(request.turbine_index, request.num_turbines - 1)
    features = engineer_features(
        wind_speed=dataset.wind_speed_ms,
        power=dataset.power_mw,
        wind_direction=dataset.wind_direction_deg,
        temperature=dataset.temperature_c,
        pressure=dataset.pressure_pa,
        humidity=dataset.humidity_pct,
        timestamps=dataset.timestamps,
        clean_mask=filter_result.clean_mask,
        turbine_index=turbine_idx,
        config=FeatureConfig(),
    )

    return FeatureEngineeringResponse(
        feature_names=features.feature_names,
        num_features=len(features.feature_names),
        valid_timesteps=features.valid_timesteps,
        dropped_timesteps=features.dropped_timesteps,
        sample_row=features.feature_matrix[0].tolist() if features.valid_timesteps > 0 else [],
    )


# ── Constraint Enforcement ───────────────────────────────────────


@router.post("/check-constraints", response_model=ConstraintCheckResponse)
async def check_constraints(
    request: ConstraintCheckRequest,
) -> ConstraintCheckResponse:
    """Test physical constraint enforcement on predictions."""
    predictions = np.array(request.predictions_mw, dtype=np.float64)
    wind_speeds = (
        np.array(request.wind_speeds_ms, dtype=np.float64)
        if request.wind_speeds_ms is not None
        else None
    )

    result = enforce_physical_constraints(
        power_mw=predictions,
        wind_speed_ms=wind_speeds,
    )

    violations = [
        ConstraintViolationSchema(
            constraint=v.constraint.value,
            index=v.index,
            original_value=round(v.original_value, 4),
            corrected_value=round(v.corrected_value, 4),
        )
        for v in result.violations
    ]

    return ConstraintCheckResponse(
        corrected_mw=[round(float(v), 4) for v in result.power_mw],
        total_violations=result.total_violations,
        violations=violations,
        original_energy_mwh=round(result.original_energy_mwh, 4),
        corrected_energy_mwh=round(result.corrected_energy_mwh, 4),
    )


# ── XGBoost Helper: Data Pipeline ──────────────────────────────────


def _build_xgboost_pipeline(
    num_turbines: int,
    num_timesteps: int,
    turbine_index: int,
    seed: int | None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, list[str]]:
    """Run the full data pipeline: SCADA → filter → features → NWP merge.

    Returns (features, target_power, wind_speed, timestamps, feature_names).
    """
    config = SCADAConfig(
        num_turbines=num_turbines,
        num_timesteps=num_timesteps,
        seed=seed,
    )
    dataset = generate_scada_dataset(config)

    # Quality filtering
    filter_result = apply_all_quality_filters(
        wind_speed=dataset.wind_speed_ms,
        power=dataset.power_mw,
        status=dataset.status,
        temperature=dataset.temperature_c,
        humidity=dataset.humidity_pct,
    )

    # Feature engineering
    turbine_idx = min(turbine_index, num_turbines - 1)
    eng_features = engineer_features(
        wind_speed=dataset.wind_speed_ms,
        power=dataset.power_mw,
        wind_direction=dataset.wind_direction_deg,
        temperature=dataset.temperature_c,
        pressure=dataset.pressure_pa,
        humidity=dataset.humidity_pct,
        timestamps=dataset.timestamps,
        clean_mask=filter_result.clean_mask,
        turbine_index=turbine_idx,
        config=FeatureConfig(),
    )

    # NWP data generation and merge
    clean_mask = filter_result.clean_mask[:, turbine_idx]
    scada_wind_clean = dataset.wind_speed_ms[clean_mask, turbine_idx]
    nwp_config = NWPConfig(num_timesteps=len(scada_wind_clean), seed=seed)
    nwp_dataset = generate_nwp_dataset(
        config=nwp_config,
        scada_wind_ms=scada_wind_clean,
        timestamps=dataset.timestamps[clean_mask],
    )

    merged_features = merge_nwp_features(eng_features.feature_matrix, nwp_dataset)
    feature_names = [
        *eng_features.feature_names,
        "nwp_wind_speed_100m_ms",
        "nwp_wind_direction_100m_deg",
        "nwp_temperature_2m_c",
        "nwp_pressure_msl_pa",
        "nwp_boundary_layer_height_m",
    ]

    # Extract target: wind_speed is column 0 in feature matrix
    wind_speed = merged_features[:, 0]

    # Target power: use the clean, filtered power for this turbine
    # After feature engineering, we have valid_timesteps rows.
    # Power lags drop early rows, so target aligns with feature matrix.
    clean_power = dataset.power_mw[clean_mask, turbine_idx]
    # Drop the same rows that feature engineering dropped
    n_valid = eng_features.valid_timesteps
    target_power = clean_power[-n_valid:]

    # Timestamps for the valid period
    clean_ts = dataset.timestamps[clean_mask]
    timestamps = clean_ts[-n_valid:]

    return merged_features, target_power, wind_speed, timestamps, feature_names


# ── XGBoost Training ───────────────────────────────────────────────


@router.post("/train-xgboost", response_model=XGBoostTrainResponse)
async def train_xgboost_endpoint(
    request: XGBoostTrainRequest,
) -> XGBoostTrainResponse:
    """Train XGBoost model with TimeSeriesSplit cross-validation.

    Pipeline: generate SCADA → quality filter → engineer features →
    merge NWP → train XGBoost → return CV metrics.
    """
    features, target, _, _, feature_names = _build_xgboost_pipeline(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        turbine_index=request.turbine_index,
        seed=request.seed,
    )

    xgb_config = XGBoostConfig(
        n_estimators=request.n_estimators,
        max_depth=request.max_depth,
        learning_rate=request.learning_rate,
        seed=request.seed if request.seed is not None else 42,
    )

    cv_result, _ = train_xgboost(features, target, xgb_config)

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
        training_samples=features.shape[0],
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
    features, target, wind_speed, timestamps, _ = _build_xgboost_pipeline(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        turbine_index=request.turbine_index,
        seed=request.seed,
    )

    xgb_config = XGBoostConfig(
        seed=request.seed if request.seed is not None else 42,
    )
    _, models = train_xgboost(features, target, xgb_config)

    # Predict on the last horizon_steps
    horizon = min(request.horizon_steps, features.shape[0])
    pred_features = features[-horizon:]
    pred_wind = wind_speed[-horizon:]
    pred_ts = timestamps[-horizon:]

    forecast = predict_xgboost(models, pred_features, pred_wind, pred_ts)

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
    features, target, _, _, feature_names = _build_xgboost_pipeline(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        turbine_index=request.turbine_index,
        seed=request.seed,
    )

    xgb_config = XGBoostConfig(
        seed=request.seed if request.seed is not None else 42,
    )
    _, models = train_xgboost(features, target, xgb_config)
    model_p50 = models[1]  # P50 = index 1

    shap_result = compute_shap_values(model_p50, features, feature_names)

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
    features, target, _, _, feature_names = _build_xgboost_pipeline(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        turbine_index=request.turbine_index,
        seed=request.seed,
    )

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
        training_samples=features.shape[0],
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
    features, target, wind_speed, timestamps, _ = _build_xgboost_pipeline(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        turbine_index=request.turbine_index,
        seed=request.seed,
    )

    lstm_config = LSTMConfig(
        lookback=request.lookback,
        mc_samples=request.mc_samples,
        seed=request.seed if request.seed is not None else 42,
    )

    _, model, norm_params = train_lstm(features, target, lstm_config)

    # Use last horizon_steps of features for prediction
    horizon = min(request.horizon_steps + request.lookback - 1, features.shape[0])
    pred_features = features[-horizon:]
    pred_wind = wind_speed[-horizon:]
    pred_ts = timestamps[-horizon:]

    forecast = predict_lstm(
        model,
        pred_features,
        pred_wind,
        norm_params,
        lstm_config,
        pred_ts,
    )

    # Trim to requested horizon
    n = min(request.horizon_steps, len(forecast.power_p50_mw))

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
    features, target, _, _, _ = _build_xgboost_pipeline(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        turbine_index=request.turbine_index,
        seed=request.seed,
    )

    lstm_config = LSTMConfig(
        lookback=request.lookback,
        mc_samples=request.mc_samples,
        seed=request.seed if request.seed is not None else 42,
    )

    _, model, norm_params = train_lstm(features, target, lstm_config)

    # Use last horizon_steps for visualization
    horizon = min(request.horizon_steps + request.lookback - 1, features.shape[0])
    pred_features = features[-horizon:]

    mc_detail = compute_mc_dropout_detail(model, pred_features, norm_params, lstm_config)

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
    features, target, _, _, feature_names = _build_xgboost_pipeline(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        turbine_index=request.turbine_index,
        seed=request.seed,
    )

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
        training_samples=features.shape[0],
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
    features, target, wind_speed, timestamps, _ = _build_xgboost_pipeline(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        turbine_index=request.turbine_index,
        seed=request.seed,
    )

    tft_config = TFTConfig(
        lookback=request.lookback,
        seed=request.seed if request.seed is not None else 42,
    )

    _, model, norm_params = train_tft(features, target, tft_config)

    # Use last horizon_steps of features for prediction
    horizon = min(request.horizon_steps + request.lookback - 1, features.shape[0])
    pred_features = features[-horizon:]
    pred_wind = wind_speed[-horizon:]
    pred_ts = timestamps[-horizon:]

    forecast = predict_tft(
        model,
        pred_features,
        pred_wind,
        norm_params,
        tft_config,
        pred_ts,
    )

    # Trim to requested horizon
    n = min(request.horizon_steps, len(forecast.power_p50_mw))

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
    features, target, _, _, feature_names = _build_xgboost_pipeline(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        turbine_index=request.turbine_index,
        seed=request.seed,
    )

    tft_config = TFTConfig(
        lookback=request.lookback,
        seed=request.seed if request.seed is not None else 42,
    )

    _, model, norm_params = train_tft(features, target, tft_config)

    # Use last horizon_steps for visualization
    horizon = min(request.horizon_steps + request.lookback - 1, features.shape[0])
    pred_features = features[-horizon:]

    attn_result = compute_attention_weights(
        model,
        pred_features,
        norm_params,
        tft_config,
        feature_names,
    )

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


# ── Shared Helper: Build All Model Forecasts ─────────────────────


def _build_all_model_forecasts(
    num_turbines: int,
    num_timesteps: int,
    turbine_index: int,
    horizon_steps: int,
    seed: int | None,
) -> tuple[ModelForecasts, np.ndarray]:
    """Train XGBoost, LSTM, and TFT, then return aligned forecast arrays.

    Returns (ModelForecasts, actual_power) for ensemble/evaluation use.
    """
    features, target, wind_speed, timestamps, _ = _build_xgboost_pipeline(
        num_turbines=num_turbines,
        num_timesteps=num_timesteps,
        turbine_index=turbine_index,
        seed=seed,
    )

    seed_val = seed if seed is not None else 42

    # ── Train all three models ──
    xgb_config = XGBoostConfig(seed=seed_val)
    _, xgb_models = train_xgboost(features, target, xgb_config)

    lstm_config = LSTMConfig(seed=seed_val)
    _, lstm_model, lstm_norm = train_lstm(features, target, lstm_config)

    tft_config = TFTConfig(seed=seed_val)
    _, tft_model, tft_norm = train_tft(features, target, tft_config)

    # ── Predict with each model ──
    horizon = min(horizon_steps, features.shape[0])
    pred_features = features[-horizon:]
    pred_wind = wind_speed[-horizon:]
    pred_ts = timestamps[-horizon:]
    actual = target[-horizon:]

    xgb_forecast = predict_xgboost(xgb_models, pred_features, pred_wind, pred_ts)

    # LSTM needs lookback buffer
    lstm_horizon = min(horizon_steps + lstm_config.lookback - 1, features.shape[0])
    lstm_forecast = predict_lstm(
        lstm_model,
        features[-lstm_horizon:],
        wind_speed[-lstm_horizon:],
        lstm_norm,
        lstm_config,
        timestamps[-lstm_horizon:],
    )

    # TFT needs lookback buffer
    tft_horizon = min(horizon_steps + tft_config.lookback - 1, features.shape[0])
    tft_forecast = predict_tft(
        tft_model,
        features[-tft_horizon:],
        wind_speed[-tft_horizon:],
        tft_norm,
        tft_config,
        timestamps[-tft_horizon:],
    )

    # Align all to same length (min of all outputs)
    n = min(
        len(xgb_forecast.power_p50_mw),
        len(lstm_forecast.power_p50_mw),
        len(tft_forecast.power_p50_mw),
        horizon,
    )

    forecasts = ModelForecasts(
        xgb_p10=xgb_forecast.power_p10_mw[-n:],
        xgb_p50=xgb_forecast.power_p50_mw[-n:],
        xgb_p90=xgb_forecast.power_p90_mw[-n:],
        lstm_p10=lstm_forecast.power_p10_mw[-n:],
        lstm_p50=lstm_forecast.power_p50_mw[-n:],
        lstm_p90=lstm_forecast.power_p90_mw[-n:],
        tft_p10=tft_forecast.power_p10_mw[-n:],
        tft_p50=tft_forecast.power_p50_mw[-n:],
        tft_p90=tft_forecast.power_p90_mw[-n:],
        wind_speed_ms=pred_wind[-n:],
        timestamps_utc=pred_ts[-n:],
    )

    return forecasts, actual[-n:]


# ── Ensemble Prediction ──────────────────────────────────────────


@router.post("/predict-ensemble", response_model=EnsemblePredictResponse)
async def predict_ensemble_endpoint(
    request: EnsemblePredictRequest,
) -> EnsemblePredictResponse:
    """Generate horizon-dependent ensemble forecast from XGBoost + LSTM + TFT.

    Pipeline: train all 3 models → predict → apply horizon-dependent
    weights → enforce physical constraints → return ensemble P10/P50/P90.

    Weight schedule per Roadmap §5.6:
        < 6h:    XGB 0.50 + LSTM 0.30 + TFT 0.20
        6–24h:   XGB 0.20 + LSTM 0.40 + TFT 0.40
        24–48h:  XGB 0.10 + LSTM 0.30 + TFT 0.60
    """
    forecasts, _ = _build_all_model_forecasts(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        turbine_index=request.turbine_index,
        horizon_steps=request.horizon_steps,
        seed=request.seed,
    )

    ensemble = compute_ensemble_forecast(forecasts)
    n = len(ensemble.power_p50_mw)

    return EnsemblePredictResponse(
        power_p10_mw=[round(float(v), 4) for v in ensemble.power_p10_mw],
        power_p50_mw=[round(float(v), 4) for v in ensemble.power_p50_mw],
        power_p90_mw=[round(float(v), 4) for v in ensemble.power_p90_mw],
        wind_speed_ms=[round(float(v), 4) for v in ensemble.wind_speed_ms],
        timestamps_utc=[int(t) for t in ensemble.timestamps_utc],
        num_steps=n,
        weights_applied=ensemble.weights_applied,
        total_violations=ensemble.constraint_result.total_violations,
    )


# ── Ramp Detection ───────────────────────────────────────────────


@router.post("/detect-ramps", response_model=RampDetectResponse)
async def detect_ramps_endpoint(
    request: RampDetectRequest,
) -> RampDetectResponse:
    """Detect ramp events in ensemble forecast and generate grid alerts.

    Pipeline: train all 3 models → ensemble forecast → scale to farm total
    (×34 turbines) → ramp detection (threshold + wavelet + regime) →
    grid stability alerts for ramp-down events.
    """
    forecasts, _ = _build_all_model_forecasts(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        turbine_index=request.turbine_index,
        horizon_steps=request.horizon_steps,
        seed=request.seed,
    )

    ensemble = compute_ensemble_forecast(forecasts)

    # Scale single-turbine forecast to farm total for ramp detection
    num_turbines = request.num_turbines
    farm_power = ensemble.power_p50_mw * num_turbines

    ramp_config = RampConfig(threshold_mw_hr=request.threshold_mw_hr)
    detection = detect_all_ramps(farm_power, ramp_config)
    alerts = generate_grid_alerts(detection.events)

    event_schemas = [
        RampEventSchema(
            start_index=e.start_index,
            end_index=e.end_index,
            direction=e.direction.value,
            magnitude_mw=e.magnitude_mw,
            rate_mw_hr=e.rate_mw_hr,
            duration_minutes=e.duration_minutes,
            severity=e.severity.value,
            detection_method=e.detection_method,
        )
        for e in detection.events
    ]

    alert_schemas = [
        GridAlertSchema(
            alert_level=a.alert_level.value,
            message=a.message,
            recommended_action=a.recommended_action,
            statcom_action=a.statcom_action,
            pse_notification=a.pse_notification,
        )
        for a in alerts
    ]

    return RampDetectResponse(
        ramp_events=event_schemas,
        num_ramp_up=detection.num_ramp_up,
        num_ramp_down=detection.num_ramp_down,
        max_ramp_rate_mw_hr=round(detection.max_ramp_rate_mw_hr, 2),
        grid_alerts=alert_schemas,
        regime_states=detection.regime_states,
    )


# ── Model Comparison ─────────────────────────────────────────────


@router.post("/compare-models", response_model=ModelCompareResponse)
async def compare_models_endpoint(
    request: ModelCompareRequest,
) -> ModelCompareResponse:
    """Compare XGBoost, LSTM, TFT, and Ensemble forecasts side-by-side.

    Pipeline: train all 3 models → predict → compute ensemble →
    evaluate each model vs actuals → rank and compare.
    """
    forecasts, actual = _build_all_model_forecasts(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        turbine_index=request.turbine_index,
        horizon_steps=request.horizon_steps,
        seed=request.seed,
    )

    ensemble = compute_ensemble_forecast(forecasts)

    # Evaluate each model
    xgb_metrics = evaluate_model(
        "XGBoost", actual, forecasts.xgb_p50, forecasts.xgb_p10, forecasts.xgb_p90
    )
    lstm_metrics = evaluate_model(
        "LSTM", actual, forecasts.lstm_p50, forecasts.lstm_p10, forecasts.lstm_p90
    )
    tft_metrics = evaluate_model(
        "TFT", actual, forecasts.tft_p50, forecasts.tft_p10, forecasts.tft_p90
    )
    ens_metrics = evaluate_model(
        "Ensemble",
        actual,
        ensemble.power_p50_mw,
        ensemble.power_p10_mw,
        ensemble.power_p90_mw,
    )

    comparison = compare_models([xgb_metrics, lstm_metrics, tft_metrics, ens_metrics])

    metric_schemas = [
        ModelMetricsSchema(
            model_name=m.model_name,
            rmse_mw=m.rmse_mw,
            mae_mw=m.mae_mw,
            mape_pct=m.mape_pct,
            r_squared=m.r_squared,
            skill_score=m.skill_score,
            quantile_coverage=m.quantile_coverage,
            pinball_losses=m.pinball_losses,
            num_samples=m.num_samples,
        )
        for m in comparison.model_metrics
    ]

    return ModelCompareResponse(
        model_metrics=metric_schemas,
        best_rmse=comparison.best_rmse,
        best_skill=comparison.best_skill,
        best_calibration=comparison.best_calibration,
        ranking=comparison.ranking,
    )
