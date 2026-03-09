"""P4 sub-router: Ramp detection, SHAP, and model comparison."""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.forecast import (
    GridAlertSchema,
    ModelCompareRequest,
    ModelCompareResponse,
    ModelMetricsSchema,
    RampDetectRequest,
    RampDetectResponse,
    RampEventSchema,
)
from app.services.p4.ensemble_model import compute_ensemble_forecast
from app.services.p4.model_evaluation import compare_models, evaluate_model
from app.services.p4.ramp_detection import RampConfig, detect_all_ramps, generate_grid_alerts

from ._pipeline import _get_cached_forecasts

router = APIRouter()


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

    # Use shared cached forecasts (lock serialises first build)
    forecasts, _ = await _get_cached_forecasts(
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

    # Use shared cached forecasts (lock serialises first build)
    forecasts, actual = await _get_cached_forecasts(
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
