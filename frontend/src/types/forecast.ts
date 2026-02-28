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
  best_skill: string;
  best_calibration: string;
  ranking: string[];
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
