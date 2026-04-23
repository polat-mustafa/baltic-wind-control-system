/**
 * TypeScript interfaces for P4 AI Forecasting API responses.
 *
 * All field names use snake_case to match the API JSON directly.
 * Source of truth: backend/app/schemas/forecast.py Pydantic schemas.
 */

// ── Turbine Spec ──────────────────────────────────────────────

export interface TurbineSpec {
  name: string;
  rotor_diameter_m: number;
  hub_height_m: number;
  rated_power_mw: number;
  cut_in_speed_ms: number;
  rated_speed_ms: number;
  cut_out_speed_ms: number;
  num_blades: number;
  cp_max: number;
  ct_rated: number;
}

// ── Power Curve ─────────────────────────────────────────────

export interface PowerCurveResponse {
  spec: TurbineSpec;
  wind_speeds_ms: number[];
  power_mw: number[];
  ct: number[];
  swept_area_m2: number;
  air_density_kg_m3: number;
  num_points: number;
}

// ── SCADA Dataset ───────────────────────────────────────────

export interface SCADADatasetSummary {
  num_turbines: number;
  num_timesteps: number;
  total_data_points: number;
  wind_speed_mean_ms: number;
  wind_speed_max_ms: number;
  power_mean_mw: number;
  power_max_mw: number;
  status_counts: Record<string, number>;
  start_timestamp: number;
  end_timestamp: number;
}

// ── Quality Filtering ───────────────────────────────────────

export interface QualityFlag {
  filter_type: string;
  turbine_index: number;
  timestep_index: number;
  reason: string;
}

export interface QualityFilterResponse {
  total_points: number;
  total_flagged: number;
  availability_pct: number;
  counts_by_filter: Record<string, number>;
  sample_flags: QualityFlag[];
}

// ── Feature Engineering ─────────────────────────────────────

export interface FeatureEngineeringResponse {
  feature_names: string[];
  num_features: number;
  valid_timesteps: number;
  dropped_timesteps: number;
  sample_row: number[];
}

// ── Constraint Enforcement ──────────────────────────────────

export interface ConstraintViolation {
  constraint: string;
  index: number;
  original_value: number;
  corrected_value: number;
}

export interface ConstraintCheckResponse {
  corrected_mw: number[];
  total_violations: number;
  violations: ConstraintViolation[];
  original_energy_mwh: number;
  corrected_energy_mwh: number;
}

// ── XGBoost ─────────────────────────────────────────────────

export interface FoldMetrics {
  fold_index: number;
  rmse_mw: number;
  mae_mw: number;
  mape_pct: number;
  r_squared: number;
}

export interface XGBoostTrainResponse {
  fold_metrics: FoldMetrics[];
  mean_rmse_mw: number;
  mean_mae_mw: number;
  mean_mape_pct: number;
  mean_r_squared: number;
  skill_score_vs_persistence: number;
  feature_names: string[];
  num_features: number;
  training_samples: number;
}

export interface XGBoostPredictResponse {
  power_p10_mw: number[];
  power_p50_mw: number[];
  power_p90_mw: number[];
  wind_speed_ms: number[];
  timestamps_utc: number[];
  num_steps: number;
}

// ── SHAP Feature Importance ───────────────────────────────────

export interface FeatureImportance {
  name: string;
  importance: number;
}

export interface SHAPResponse {
  feature_importance: FeatureImportance[];
  top_features: string[];
  shap_values_sample: number[][];
}

// ── LSTM ─────────────────────────────────────────────────────

export interface LSTMFoldMetrics {
  fold_index: number;
  rmse_mw: number;
  mae_mw: number;
  mape_pct: number;
  r_squared: number;
  training_epochs: number;
}

export interface LSTMTrainResponse {
  fold_metrics: LSTMFoldMetrics[];
  mean_rmse_mw: number;
  mean_mae_mw: number;
  mean_mape_pct: number;
  mean_r_squared: number;
  skill_score_vs_persistence: number;
  architecture_summary: string;
  feature_names: string[];
  num_features: number;
  training_samples: number;
}

export interface LSTMPredictResponse {
  power_p10_mw: number[];
  power_p50_mw: number[];
  power_p90_mw: number[];
  mc_mean_mw: number[];
  mc_std_mw: number[];
  wind_speed_ms: number[];
  timestamps_utc: number[];
  num_steps: number;
}

export interface MCDropoutResponse {
  all_passes: number[][];
  mean_mw: number[];
  std_mw: number[];
  num_passes: number;
}

// ── TFT ─────────────────────────────────────────────────────

export interface TFTFoldMetrics {
  fold_index: number;
  rmse_mw: number;
  mae_mw: number;
  mape_pct: number;
  r_squared: number;
  training_epochs: number;
}

export interface TFTTrainResponse {
  fold_metrics: TFTFoldMetrics[];
  mean_rmse_mw: number;
  mean_mae_mw: number;
  mean_mape_pct: number;
  mean_r_squared: number;
  skill_score_vs_persistence: number;
  architecture_summary: string;
  feature_names: string[];
  num_features: number;
  training_samples: number;
}

export interface TFTPredictResponse {
  power_p10_mw: number[];
  power_p50_mw: number[];
  power_p90_mw: number[];
  wind_speed_ms: number[];
  timestamps_utc: number[];
  num_steps: number;
}

export interface VariableImportance {
  name: string;
  importance: number;
}

export interface TFTAttentionResponse {
  temporal_weights_sample: number[][];
  variable_importance: VariableImportance[];
  num_attention_heads: number;
}

// ── Ensemble Prediction ───────────────────────────────────────

export interface EnsemblePredictResponse {
  power_p10_mw: number[];
  power_p50_mw: number[];
  power_p90_mw: number[];
  wind_speed_ms: number[];
  timestamps_utc: number[];
  num_steps: number;
  weights_applied: string[];
  total_violations: number;
}

// ── Model Comparison ──────────────────────────────────────────

export interface ModelMetrics {
  model_name: string;
  rmse_mw: number;
  mae_mw: number;
  mape_pct: number;
  r_squared: number;
  skill_score: number;
  quantile_coverage: Record<string, number>;
  pinball_losses: Record<string, number>;
  num_samples: number;
}

export interface ModelCompareResponse {
  model_metrics: ModelMetrics[];
  best_rmse: string;
  best_mae: string;
  best_skill: string;
  best_calibration: string;
  ranking: string[];
}

// ── Ramp Detection ────────────────────────────────────────────

export interface RampEvent {
  start_index: number;
  end_index: number;
  direction: string;
  magnitude_mw: number;
  rate_mw_hr: number;
  duration_minutes: number;
  severity: string;
  detection_method: string;
}

export interface GridAlert {
  alert_level: string;
  message: string;
  recommended_action: string;
  statcom_action: string;
  pse_notification: boolean;
}

export interface RampDetectResponse {
  ramp_events: RampEvent[];
  num_ramp_up: number;
  num_ramp_down: number;
  max_ramp_rate_mw_hr: number;
  grid_alerts: GridAlert[];
  regime_states: string[];
}
