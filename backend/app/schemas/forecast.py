"""
Pydantic schemas for P4 Machine Learning forecasting pipeline.

Request and response models for power curve generation, SCADA data
synthesis, quality filtering, feature engineering, physical
constraint enforcement, XGBoost forecasting, and LSTM forecasting.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

# ── Power Curve Schemas ───────────────────────────────────────────


class TurbineSpecSchema(BaseModel):
    """Turbine specification response."""

    name: str = Field(description="Turbine model name")
    rotor_diameter_m: float = Field(description="Rotor diameter [m]")
    hub_height_m: float = Field(description="Hub height [m]")
    rated_power_mw: float = Field(description="Rated power [MW]")
    cut_in_speed_ms: float = Field(description="Cut-in wind speed [m/s]")
    rated_speed_ms: float = Field(description="Rated wind speed [m/s]")
    cut_out_speed_ms: float = Field(description="Cut-out wind speed [m/s]")
    num_blades: int = Field(description="Number of rotor blades")
    cp_max: float = Field(description="Maximum power coefficient")
    ct_rated: float = Field(description="Thrust coefficient at rated speed")


class PowerCurveRequest(BaseModel):
    """Request to generate a power curve."""

    wind_step_ms: float = Field(
        default=0.5,
        ge=0.1,
        le=2.0,
        description="Wind speed bin width [m/s]. IEC 61400-12-1 default: 0.5",
    )
    air_density_kg_m3: float | None = Field(
        default=None,
        ge=0.8,
        le=1.6,
        description="Air density [kg/m³]. Default: 1.225 (standard conditions)",
    )


class PowerCurveResponse(BaseModel):
    """Power curve generation response."""

    spec: TurbineSpecSchema
    wind_speeds_ms: list[float] = Field(description="Wind speed array [m/s]")
    power_mw: list[float] = Field(description="Power output array [MW]")
    ct: list[float] = Field(description="Thrust coefficient array [-]")
    swept_area_m2: float = Field(description="Rotor swept area [m²]")
    air_density_kg_m3: float = Field(description="Air density used [kg/m³]")
    num_points: int = Field(description="Number of data points in the curve")


# ── SCADA Generation Schemas ─────────────────────────────────────


class GenerateSCADARequest(BaseModel):
    """Request to generate synthetic SCADA data."""

    num_turbines: int = Field(
        default=34,
        ge=1,
        le=100,
        description="Number of turbines in the farm",
    )
    num_timesteps: int = Field(
        default=52_560,
        ge=100,
        le=525_600,
        description="Number of 10-minute intervals (52560 = 1 year)",
    )
    weibull_a: float = Field(
        default=10.5,
        ge=3.0,
        le=20.0,
        description="Weibull scale parameter [m/s]",
    )
    weibull_k: float = Field(
        default=2.2,
        ge=1.0,
        le=4.0,
        description="Weibull shape parameter [-]",
    )
    seed: int | None = Field(
        default=42,
        description="Random seed for reproducibility",
    )


class SCADADatasetSummary(BaseModel):
    """Summary of a generated SCADA dataset (not the full arrays)."""

    num_turbines: int = Field(description="Number of turbines")
    num_timesteps: int = Field(description="Number of 10-minute intervals")
    total_data_points: int = Field(description="Total data points (turbines x steps)")
    wind_speed_mean_ms: float = Field(description="Mean wind speed [m/s]")
    wind_speed_max_ms: float = Field(description="Max wind speed [m/s]")
    power_mean_mw: float = Field(description="Mean power output [MW]")
    power_max_mw: float = Field(description="Max power output [MW]")
    status_counts: dict[str, int] = Field(description="Count per operational status")
    start_timestamp: int = Field(description="First timestamp (Unix seconds)")
    end_timestamp: int = Field(description="Last timestamp (Unix seconds)")


# ── Quality Filter Schemas ────────────────────────────────────────


class QualityFilterRequest(BaseModel):
    """Request to run quality filters on SCADA data."""

    num_turbines: int = Field(default=34, ge=1, le=100)
    num_timesteps: int = Field(default=52_560, ge=100, le=525_600)
    seed: int | None = Field(default=42)


class QualityFlagSchema(BaseModel):
    """A single quality flag."""

    filter_type: str = Field(description="Filter category that flagged this point")
    turbine_index: int = Field(description="Turbine column index")
    timestep_index: int = Field(description="Timestep row index")
    reason: str = Field(description="Human-readable explanation")


class QualityFilterResponse(BaseModel):
    """Quality filter pipeline response."""

    total_points: int = Field(description="Total data points in dataset")
    total_flagged: int = Field(description="Number of flagged (excluded) points")
    availability_pct: float = Field(description="Clean data percentage (target: 85-92%)")
    counts_by_filter: dict[str, int] = Field(description="Flags per filter type")
    sample_flags: list[QualityFlagSchema] = Field(description="Sample of quality flags (first 50)")


# ── Feature Engineering Schemas ───────────────────────────────────


class FeatureEngineeringRequest(BaseModel):
    """Request to run feature engineering pipeline."""

    num_turbines: int = Field(default=34, ge=1, le=100)
    num_timesteps: int = Field(default=52_560, ge=100, le=525_600)
    turbine_index: int = Field(default=0, ge=0, description="Which turbine to process")
    seed: int | None = Field(default=42)


class FeatureEngineeringResponse(BaseModel):
    """Feature engineering pipeline response."""

    feature_names: list[str] = Field(description="Column names for feature matrix")
    num_features: int = Field(description="Number of engineered features")
    valid_timesteps: int = Field(description="Rows in final feature matrix")
    dropped_timesteps: int = Field(description="Rows dropped (NaN from lags/rolling)")
    sample_row: list[float] = Field(description="First row of the feature matrix")


# ── Constraint Check Schemas ─────────────────────────────────────


class ConstraintCheckRequest(BaseModel):
    """Request to test physical constraint enforcement."""

    predictions_mw: list[float] = Field(
        description="Raw ML power predictions [MW]",
        min_length=1,
    )
    wind_speeds_ms: list[float] | None = Field(
        default=None,
        description="Concurrent wind speed measurements [m/s]",
    )


class ConstraintViolationSchema(BaseModel):
    """A single constraint violation record."""

    constraint: str = Field(description="Constraint type violated")
    index: int = Field(description="Timestep index")
    original_value: float = Field(description="Original prediction [MW]")
    corrected_value: float = Field(description="Corrected value [MW]")


class ConstraintCheckResponse(BaseModel):
    """Constraint enforcement response."""

    corrected_mw: list[float] = Field(description="Corrected power predictions [MW]")
    total_violations: int = Field(description="Number of violations corrected")
    violations: list[ConstraintViolationSchema] = Field(description="Violation details")
    original_energy_mwh: float = Field(description="Sum of original predictions")
    corrected_energy_mwh: float = Field(description="Sum of corrected predictions")


# ── XGBoost Forecasting Schemas ──────────────────────────────────


class XGBoostTrainRequest(BaseModel):
    """Request to train XGBoost wind power forecasting model."""

    num_turbines: int = Field(default=34, ge=1, le=100)
    num_timesteps: int = Field(default=52_560, ge=100, le=525_600)
    turbine_index: int = Field(default=0, ge=0, description="Which turbine to train on")
    n_estimators: int = Field(default=500, ge=10, le=5000, description="Maximum boosting rounds")
    max_depth: int = Field(default=8, ge=2, le=15, description="Maximum tree depth")
    learning_rate: float = Field(default=0.05, gt=0.001, le=1.0, description="Step size shrinkage")
    seed: int | None = Field(default=42)


class FoldMetricsSchema(BaseModel):
    """Performance metrics for one CV fold."""

    fold_index: int = Field(description="Zero-based fold number")
    rmse_mw: float = Field(description="Root Mean Square Error [MW]")
    mae_mw: float = Field(description="Mean Absolute Error [MW]")
    mape_pct: float = Field(description="Mean Absolute Percentage Error [%]")
    r_squared: float = Field(description="Coefficient of determination R²")


class XGBoostTrainResponse(BaseModel):
    """XGBoost training response with cross-validation metrics."""

    fold_metrics: list[FoldMetricsSchema] = Field(description="Per-fold CV metrics")
    mean_rmse_mw: float = Field(description="Mean RMSE across folds [MW]")
    mean_mae_mw: float = Field(description="Mean MAE across folds [MW]")
    mean_mape_pct: float = Field(description="Mean MAPE across folds [%]")
    mean_r_squared: float = Field(description="Mean R² across folds")
    skill_score_vs_persistence: float = Field(
        description="Skill score vs persistence baseline (>0 = model wins)"
    )
    feature_names: list[str] = Field(description="Feature column names")
    num_features: int = Field(description="Number of input features")
    training_samples: int = Field(description="Number of training samples")


class XGBoostPredictRequest(BaseModel):
    """Request to generate probabilistic power forecast."""

    num_turbines: int = Field(default=34, ge=1, le=100)
    num_timesteps: int = Field(default=52_560, ge=100, le=525_600)
    turbine_index: int = Field(default=0, ge=0)
    horizon_steps: int = Field(
        default=144,
        ge=1,
        le=1000,
        description="Number of forecast steps to return (144 = 1 day)",
    )
    seed: int | None = Field(default=42)


class XGBoostPredictResponse(BaseModel):
    """Probabilistic power forecast response."""

    power_p10_mw: list[float] = Field(description="P10 forecast [MW]")
    power_p50_mw: list[float] = Field(description="P50 (median) forecast [MW]")
    power_p90_mw: list[float] = Field(description="P90 forecast [MW]")
    wind_speed_ms: list[float] = Field(description="Input wind speeds [m/s]")
    timestamps_utc: list[int] = Field(description="Forecast timestamps (Unix)")
    num_steps: int = Field(description="Number of forecast steps")


class SHAPRequest(BaseModel):
    """Request to compute SHAP feature importance."""

    num_turbines: int = Field(default=34, ge=1, le=100)
    num_timesteps: int = Field(default=52_560, ge=100, le=525_600)
    turbine_index: int = Field(default=0, ge=0)
    top_k_features: int = Field(
        default=10,
        ge=1,
        le=50,
        description="Number of top features to return",
    )
    seed: int | None = Field(default=42)


class FeatureImportanceSchema(BaseModel):
    """Single feature importance entry."""

    name: str = Field(description="Feature name")
    importance: float = Field(description="Mean |SHAP| value")


class SHAPResponse(BaseModel):
    """SHAP explainability response."""

    feature_importance: list[FeatureImportanceSchema] = Field(
        description="Features ranked by mean |SHAP| importance"
    )
    top_features: list[str] = Field(description="Top-K feature names")
    shap_values_sample: list[list[float]] = Field(
        description="SHAP values for first N samples (rows x features)"
    )


# ── LSTM Forecasting Schemas ────────────────────────────────────


class LSTMTrainRequest(BaseModel):
    """Request to train LSTM wind power forecasting model."""

    num_turbines: int = Field(default=34, ge=1, le=100)
    num_timesteps: int = Field(default=52_560, ge=100, le=525_600)
    turbine_index: int = Field(default=0, ge=0, description="Which turbine to train on")
    lookback: int = Field(
        default=144,
        ge=6,
        le=1000,
        description="Lookback window (144 = 24h at 10-min resolution)",
    )
    hidden_units_l1: int = Field(default=64, ge=4, le=512, description="LSTM layer 1 hidden units")
    hidden_units_l2: int = Field(default=32, ge=4, le=256, description="LSTM layer 2 hidden units")
    dropout: float = Field(default=0.2, ge=0.0, le=0.5, description="Dropout rate")
    learning_rate: float = Field(default=0.001, gt=0.0, le=0.1, description="Adam learning rate")
    epochs: int = Field(default=100, ge=1, le=1000, description="Maximum training epochs")
    patience: int = Field(default=10, ge=1, le=100, description="Early stopping patience")
    batch_size: int = Field(default=64, ge=8, le=512, description="Training batch size")
    seed: int | None = Field(default=42)


class LSTMFoldMetricsSchema(BaseModel):
    """Performance metrics for one LSTM CV fold."""

    fold_index: int = Field(description="Zero-based fold number")
    rmse_mw: float = Field(description="Root Mean Square Error [MW]")
    mae_mw: float = Field(description="Mean Absolute Error [MW]")
    mape_pct: float = Field(description="Mean Absolute Percentage Error [%]")
    r_squared: float = Field(description="Coefficient of determination R²")
    training_epochs: int = Field(
        description="Actual training epochs (may be less due to early stopping)"
    )


class LSTMTrainResponse(BaseModel):
    """LSTM training response with cross-validation metrics."""

    fold_metrics: list[LSTMFoldMetricsSchema] = Field(description="Per-fold CV metrics")
    mean_rmse_mw: float = Field(description="Mean RMSE across folds [MW]")
    mean_mae_mw: float = Field(description="Mean MAE across folds [MW]")
    mean_mape_pct: float = Field(description="Mean MAPE across folds [%]")
    mean_r_squared: float = Field(description="Mean R² across folds")
    skill_score_vs_persistence: float = Field(
        description="Skill score vs persistence baseline (>0 = model wins)"
    )
    architecture_summary: str = Field(description="Human-readable LSTM architecture")
    feature_names: list[str] = Field(description="Feature column names")
    num_features: int = Field(description="Number of input features")
    training_samples: int = Field(description="Number of training samples")


class LSTMPredictRequest(BaseModel):
    """Request to generate LSTM probabilistic power forecast."""

    num_turbines: int = Field(default=34, ge=1, le=100)
    num_timesteps: int = Field(default=52_560, ge=100, le=525_600)
    turbine_index: int = Field(default=0, ge=0)
    lookback: int = Field(default=144, ge=6, le=1000)
    mc_samples: int = Field(
        default=100,
        ge=10,
        le=1000,
        description="Number of MC Dropout forward passes",
    )
    horizon_steps: int = Field(
        default=144,
        ge=1,
        le=1000,
        description="Number of forecast steps to return (144 = 1 day)",
    )
    seed: int | None = Field(default=42)


class LSTMPredictResponse(BaseModel):
    """LSTM probabilistic power forecast response."""

    power_p10_mw: list[float] = Field(description="P10 forecast [MW]")
    power_p50_mw: list[float] = Field(description="P50 (median) forecast [MW]")
    power_p90_mw: list[float] = Field(description="P90 forecast [MW]")
    mc_mean_mw: list[float] = Field(description="MC Dropout mean [MW]")
    mc_std_mw: list[float] = Field(description="MC Dropout std [MW]")
    wind_speed_ms: list[float] = Field(description="Input wind speeds [m/s]")
    timestamps_utc: list[int] = Field(description="Forecast timestamps (Unix)")
    num_steps: int = Field(description="Number of forecast steps")


class MCDropoutRequest(BaseModel):
    """Request for detailed MC Dropout visualization data."""

    num_turbines: int = Field(default=34, ge=1, le=100)
    num_timesteps: int = Field(default=52_560, ge=100, le=525_600)
    turbine_index: int = Field(default=0, ge=0)
    lookback: int = Field(default=144, ge=6, le=1000)
    mc_samples: int = Field(
        default=100,
        ge=10,
        le=1000,
        description="Number of MC Dropout forward passes",
    )
    horizon_steps: int = Field(
        default=144,
        ge=1,
        le=1000,
        description="Number of steps for visualization",
    )
    seed: int | None = Field(default=42)


class MCDropoutResponse(BaseModel):
    """MC Dropout detailed visualization response."""

    all_passes: list[list[float]] = Field(description="All MC passes, shape (mc_samples x n_steps)")
    mean_mw: list[float] = Field(description="Mean across MC passes [MW]")
    std_mw: list[float] = Field(description="Std across MC passes [MW]")
    num_passes: int = Field(description="Number of MC forward passes")


# ── TFT Forecasting Schemas ──────────────────────────────────────


class TFTTrainRequest(BaseModel):
    """Request to train TFT wind power forecasting model."""

    num_turbines: int = Field(default=34, ge=1, le=100)
    num_timesteps: int = Field(default=52_560, ge=100, le=525_600)
    turbine_index: int = Field(default=0, ge=0, description="Which turbine to train on")
    lookback: int = Field(
        default=72,
        ge=6,
        le=1000,
        description="Lookback window (72 = 12h at 10-min resolution)",
    )
    hidden_size: int = Field(
        default=32, ge=4, le=256, description="Hidden dimension for all layers"
    )
    num_attention_heads: int = Field(
        default=2, ge=1, le=8, description="Number of parallel attention heads"
    )
    dropout: float = Field(default=0.1, ge=0.0, le=0.5, description="Dropout rate")
    learning_rate: float = Field(default=0.001, gt=0.0, le=0.1, description="Adam learning rate")
    epochs: int = Field(default=100, ge=1, le=1000, description="Maximum training epochs")
    patience: int = Field(default=10, ge=1, le=100, description="Early stopping patience")
    batch_size: int = Field(default=64, ge=8, le=512, description="Training batch size")
    seed: int | None = Field(default=42)


class TFTFoldMetricsSchema(BaseModel):
    """Performance metrics for one TFT CV fold."""

    fold_index: int = Field(description="Zero-based fold number")
    rmse_mw: float = Field(description="Root Mean Square Error [MW]")
    mae_mw: float = Field(description="Mean Absolute Error [MW]")
    mape_pct: float = Field(description="Mean Absolute Percentage Error [%]")
    r_squared: float = Field(description="Coefficient of determination R²")
    training_epochs: int = Field(
        description="Actual training epochs (may be less due to early stopping)"
    )


class TFTTrainResponse(BaseModel):
    """TFT training response with cross-validation metrics."""

    fold_metrics: list[TFTFoldMetricsSchema] = Field(description="Per-fold CV metrics")
    mean_rmse_mw: float = Field(description="Mean RMSE across folds [MW]")
    mean_mae_mw: float = Field(description="Mean MAE across folds [MW]")
    mean_mape_pct: float = Field(description="Mean MAPE across folds [%]")
    mean_r_squared: float = Field(description="Mean R² across folds")
    skill_score_vs_persistence: float = Field(
        description="Skill score vs persistence baseline (>0 = model wins)"
    )
    architecture_summary: str = Field(description="Human-readable TFT architecture")
    feature_names: list[str] = Field(description="Feature column names")
    num_features: int = Field(description="Number of input features")
    training_samples: int = Field(description="Number of training samples")


class TFTPredictRequest(BaseModel):
    """Request to generate TFT probabilistic power forecast."""

    num_turbines: int = Field(default=34, ge=1, le=100)
    num_timesteps: int = Field(default=52_560, ge=100, le=525_600)
    turbine_index: int = Field(default=0, ge=0)
    lookback: int = Field(default=72, ge=6, le=1000)
    horizon_steps: int = Field(
        default=144,
        ge=1,
        le=1000,
        description="Number of forecast steps to return (144 = 1 day)",
    )
    seed: int | None = Field(default=42)


class TFTPredictResponse(BaseModel):
    """TFT probabilistic power forecast response."""

    power_p10_mw: list[float] = Field(description="P10 forecast [MW]")
    power_p50_mw: list[float] = Field(description="P50 (median) forecast [MW]")
    power_p90_mw: list[float] = Field(description="P90 forecast [MW]")
    wind_speed_ms: list[float] = Field(description="Input wind speeds [m/s]")
    timestamps_utc: list[int] = Field(description="Forecast timestamps (Unix)")
    num_steps: int = Field(description="Number of forecast steps")


class TFTAttentionRequest(BaseModel):
    """Request for TFT attention weight visualization."""

    num_turbines: int = Field(default=34, ge=1, le=100)
    num_timesteps: int = Field(default=52_560, ge=100, le=525_600)
    turbine_index: int = Field(default=0, ge=0)
    lookback: int = Field(default=72, ge=6, le=1000)
    horizon_steps: int = Field(
        default=144,
        ge=1,
        le=1000,
        description="Number of steps for attention visualization",
    )
    seed: int | None = Field(default=42)


class VariableImportanceSchema(BaseModel):
    """Single variable importance entry from TFT VSN."""

    name: str = Field(description="Feature name")
    importance: float = Field(description="VSN selection weight (sum=1.0)")


class TFTAttentionResponse(BaseModel):
    """TFT attention weight visualization response."""

    temporal_weights_sample: list[list[float]] = Field(
        description="Temporal attention weights for sample steps (n_sample x lookback)"
    )
    variable_importance: list[VariableImportanceSchema] = Field(
        description="Per-feature importance from Variable Selection Network"
    )
    num_attention_heads: int = Field(description="Number of attention heads used")


# ── Ensemble Forecasting Schemas ─────────────────────────────────


class EnsemblePredictRequest(BaseModel):
    """Request to generate horizon-dependent ensemble forecast."""

    num_turbines: int = Field(default=34, ge=1, le=100)
    num_timesteps: int = Field(default=52_560, ge=100, le=525_600)
    turbine_index: int = Field(default=0, ge=0)
    horizon_steps: int = Field(
        default=144,
        ge=1,
        le=1000,
        description="Number of forecast steps (144 = 1 day)",
    )
    seed: int | None = Field(default=42)


class EnsemblePredictResponse(BaseModel):
    """Horizon-dependent ensemble forecast response."""

    power_p10_mw: list[float] = Field(description="Ensemble P10 forecast [MW]")
    power_p50_mw: list[float] = Field(description="Ensemble P50 (median) forecast [MW]")
    power_p90_mw: list[float] = Field(description="Ensemble P90 forecast [MW]")
    wind_speed_ms: list[float] = Field(description="Input wind speeds [m/s]")
    timestamps_utc: list[int] = Field(description="Forecast timestamps (Unix)")
    num_steps: int = Field(description="Number of forecast steps")
    weights_applied: list[str] = Field(description="Horizon band label per step")
    total_violations: int = Field(description="Physical constraint violations corrected")


# ── Ensemble Task Schemas (async background training) ────────────


class TaskStartResponse(BaseModel):
    """Returned immediately (202) when ensemble training starts in the background."""

    task_id: str = Field(description="UUID identifying the background training task")
    status: str = Field(default="running", description="Initial status (always 'running')")


class TaskStatusResponse(BaseModel):
    """Polling response for background ensemble training task."""

    status: str = Field(description="running | completed | failed")
    progress: int = Field(description="Estimated progress 0-100 %")
    result: EnsemblePredictResponse | None = Field(
        default=None, description="Full forecast result when status='completed'"
    )
    error: str | None = Field(default=None, description="Error message when status='failed'")


# ── Ramp Detection Schemas ───────────────────────────────────────


class RampEventSchema(BaseModel):
    """A detected ramp event."""

    start_index: int = Field(description="First timestep index")
    end_index: int = Field(description="Last timestep index (inclusive)")
    direction: str = Field(description="ramp_up or ramp_down")
    magnitude_mw: float = Field(description="Total power change [MW]")
    rate_mw_hr: float = Field(description="Power change rate [MW/hr]")
    duration_minutes: int = Field(description="Event duration [min]")
    severity: str = Field(description="minor/moderate/severe/extreme")
    detection_method: str = Field(description="threshold/wavelet/regime")


class GridAlertSchema(BaseModel):
    """Grid stability alert for a ramp event."""

    alert_level: str = Field(description="info/warning/critical/emergency")
    message: str = Field(description="Human-readable alert description")
    recommended_action: str = Field(description="Suggested response")
    statcom_action: str = Field(description="STATCOM mode recommendation")
    pse_notification: bool = Field(description="Whether PSE TSO must be notified")


class RampDetectRequest(BaseModel):
    """Request to detect ramp events in ensemble forecast."""

    num_turbines: int = Field(default=34, ge=1, le=100)
    num_timesteps: int = Field(default=52_560, ge=100, le=525_600)
    turbine_index: int = Field(default=0, ge=0)
    horizon_steps: int = Field(default=144, ge=1, le=1000)
    threshold_mw_hr: float = Field(
        default=50.0,
        ge=1.0,
        le=500.0,
        description="Ramp rate threshold [MW/hr]",
    )
    seed: int | None = Field(default=42)


class RampDetectResponse(BaseModel):
    """Ramp detection and grid alert response."""

    ramp_events: list[RampEventSchema] = Field(description="All detected ramp events")
    num_ramp_up: int = Field(description="Number of upward ramps")
    num_ramp_down: int = Field(description="Number of downward ramps")
    max_ramp_rate_mw_hr: float = Field(description="Peak ramp rate [MW/hr]")
    grid_alerts: list[GridAlertSchema] = Field(description="Grid stability alerts")
    regime_states: list[str] = Field(description="Per-step regime classification")


# ── Model Comparison Schemas ─────────────────────────────────────


class ModelMetricsSchema(BaseModel):
    """Evaluation metrics for a single model."""

    model_name: str = Field(description="Model identifier")
    rmse_mw: float = Field(description="Root Mean Square Error [MW]")
    mae_mw: float = Field(description="Mean Absolute Error [MW]")
    mape_pct: float = Field(description="Mean Absolute Percentage Error [%]")
    r_squared: float = Field(description="Coefficient of determination R²")
    skill_score: float = Field(description="Skill score vs persistence")
    quantile_coverage: dict[str, float] = Field(description="Calibration per quantile")
    pinball_losses: dict[str, float] = Field(description="Pinball loss per quantile")
    num_samples: int = Field(description="Number of evaluation samples")


class ModelCompareRequest(BaseModel):
    """Request to compare all forecasting models."""

    num_turbines: int = Field(default=34, ge=1, le=100)
    num_timesteps: int = Field(default=52_560, ge=100, le=525_600)
    turbine_index: int = Field(default=0, ge=0)
    horizon_steps: int = Field(default=144, ge=1, le=1000)
    seed: int | None = Field(default=42)


class ModelCompareResponse(BaseModel):
    """Side-by-side model comparison response."""

    model_metrics: list[ModelMetricsSchema] = Field(description="Metrics per model")
    best_rmse: str = Field(description="Model with lowest RMSE")
    best_mae: str = Field(description="Model with lowest MAE")
    best_skill: str = Field(description="Model with highest skill score")
    best_calibration: str = Field(description="Model with best P90 calibration")
    ranking: list[str] = Field(description="Models ranked by RMSE (best first)")
