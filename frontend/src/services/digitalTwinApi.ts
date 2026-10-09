/**
 * Typed client for the Digital Twin API (backend/app/routers/digital_twin.py).
 *
 * Times are Unix seconds (UTC). Channel order everywhere:
 * power, rotor_speed, pitch, generator_temp, anemometer.
 */

import { post, request } from "./apiClient";

const BASE = "/api/v1/digital-twin";

export type ScenarioName =
  | "healthy"
  | "rotor_icing"
  | "pitch_misalignment"
  | "converter_derating"
  | "generator_degradation"
  | "anemometer_drift"
  | "combined";

export type FaultKind =
  | "aero_efficiency"
  | "pitch_offset"
  | "power_limit"
  | "generator_loss"
  | "anemometer_gain";

export type ChannelKey = "power" | "rotor_speed" | "pitch" | "generator_temp" | "anemometer";
export type HealthStatus = "normal" | "alert" | "alarm";

// ── Model card ───────────────────────────────────────────────────

export interface ChannelCard {
  key: ChannelKey;
  label: string;
  unit: string;
  logical_node: string;
  sigma_floor: number;
  acf_factor: number;
  lag1_autocorr: number;
  rmse: number;
  bias: number;
  samples: number;
}

export interface FaultModeCard {
  kind: FaultKind;
  label: string;
  category: string;
  parameter: string;
  unit: string;
  nominal: number;
  search_min: number;
  search_max: number;
  advisory: string;
  references: string[];
  prognosis_limit: number | null;
  prognosis_limit_note: string | null;
}

export interface ScenarioInjection {
  kind: FaultKind;
  label: string;
  turbines: string[];
  severity: number[];
  unit: string;
  onset_fraction: number;
  ramp_fraction: number;
  end_fraction: number | null;
}

export interface ScenarioInfo {
  name: ScenarioName;
  title: string;
  description: string;
  injections: ScenarioInjection[];
  cold_spell: [number, number] | null;
}

export interface StandardRef {
  code: string;
  title: string;
  role: string;
}

export interface ModelCard {
  turbine: Record<string, number | string>;
  aero_calibration: Record<string, number>;
  thermal_model: Record<string, number | string>;
  measurement_model: Record<string, number | string>;
  detector: Record<string, number | string>;
  phase_one: Record<string, number>;
  channels: ChannelCard[];
  fault_library: FaultModeCard[];
  scenarios: ScenarioInfo[];
  standards: StandardRef[];
}

export interface ReferenceCurve {
  wind_ms: number[];
  power_mw: number[];
  rotor_speed_rpm: number[];
  pitch_deg: number[];
  tip_speed_ratio: number[];
  cp: number[];
  generator_loss_kw: number[];
  region: number[];
  region_names: Record<string, string>;
  p1_table_power_mw: number[];
  max_deviation_vs_p1_mw: number;
  max_deviation_vs_p1_above_6ms_mw: number;
}

// ── Analysis ─────────────────────────────────────────────────────

export interface Hypothesis {
  kind: FaultKind;
  severity: number;
  cost: number;
  explained: number;
  posterior: number;
}

export interface Diagnosis {
  kind: FaultKind | null;
  label: string;
  category: string | null;
  severity: number | null;
  unit: string | null;
  posterior: number;
  explained: number;
  lr_statistic: number;
  cause_hint: string;
  advisory: string | null;
  window_start: number;
  window_end: number;
  samples_used: number;
  mean_ambient_c: number;
  mean_humidity_pct: number;
  hypotheses: Hypothesis[];
}

export interface Prognosis {
  kind: FaultKind;
  limit: number;
  limit_note: string;
  current: number | null;
  slope_per_day: number;
  slope_std_error: number;
  p_value: number;
  significant: boolean;
  rul_days: number | null;
  rul_lower_days: number | null;
  rul_upper_days: number | null;
  points: number;
  status: "trend" | "no_trend" | "limit_exceeded" | "insufficient_data";
}

export interface TurbineSummary {
  turbine_id: number;
  name: string;
  status: HealthStatus;
  health_index: number;
  channel_health: Record<ChannelKey, number>;
  worst_channel: ChannelKey;
  event_count: number;
  active_event_count: number;
  first_detection: number | null;
  last_evidence: number | null;
  diagnosis: Diagnosis | null;
  prognosis: Prognosis | null;
  actual_energy_mwh: number;
  potential_energy_mwh: number;
  lost_energy_mwh: number;
}

export interface TwinEvent {
  turbine_id: number;
  turbine_name: string;
  channel: ChannelKey;
  level: "alert" | "alarm";
  direction: "high" | "low";
  onset: number;
  confirmed: number;
  end: number | null;
  peak_u: number;
  diagnosis: FaultKind | null;
}

export interface ValidationRow {
  turbine_id: number;
  turbine_name: string;
  injected_kind: FaultKind;
  injected_severity: number;
  final_severity: number;
  unit: string;
  onset: number;
  detected: boolean;
  detection: number | null;
  delay_hours: number | null;
  diagnosed_kind: FaultKind | null;
  isolation_correct: boolean;
  estimated_severity: number | null;
}

export interface FarmSummary {
  fleet_health_index: number;
  min_health_index: number;
  normal_count: number;
  alert_count: number;
  alarm_count: number;
  diagnosed_count: number;
  active_events: number;
  total_events: number;
  actual_energy_mwh: number;
  potential_energy_mwh: number;
  lost_energy_mwh: number;
  energy_performance_pct: number;
}

export interface AnalyzeResponse {
  scenario: ScenarioName;
  title: string;
  duration_days: number;
  seed: number;
  start: number;
  sample_period_s: number;
  num_samples: number;
  farm: FarmSummary;
  turbines: TurbineSummary[];
  events: TwinEvent[];
  health_trend: { timestamps: number[]; health: number[][] };
  ambient: {
    timestamps: number[];
    temperature_c: number[];
    humidity_pct: number[];
    farm_wind_ms: number[];
  };
  validation: {
    rows: ValidationRow[];
    injected: number;
    detected: number;
    isolated: number;
    false_events: number;
    mean_delay_hours: number | null;
  };
}

export interface ChannelSeries {
  key: ChannelKey;
  label: string;
  unit: string;
  logical_node: string;
  measured: number[];
  expected: number[];
  ewma: number[];
  limit: number[];
  valid: boolean[];
}

export interface TurbineDetail {
  turbine: TurbineSummary;
  timestamps: number[];
  wind_ms: number[];
  channels: ChannelSeries[];
  health: number[];
  in_event: boolean[];
  severity_trend: { time: number; severity: number; std_error: number; samples: number }[];
  truth: { kind: FaultKind; unit: string; values: number[] }[];
  power_curve_wind_ms: number[];
  power_curve_mw: number[];
}

export interface RunParams {
  scenario: ScenarioName;
  duration_days: number;
  seed: number;
}

// ── Calls ────────────────────────────────────────────────────────

export const getModelCard = (): Promise<ModelCard> => request(`${BASE}/config`);

export const getReferenceCurve = (): Promise<ReferenceCurve> =>
  request(`${BASE}/reference-curve`);

export const postAnalyze = (params: RunParams): Promise<AnalyzeResponse> =>
  post(`${BASE}/analyze`, params);

export const postTurbineDetail = (
  params: RunParams & { turbine_id: number },
): Promise<TurbineDetail> => post(`${BASE}/turbine-detail`, params);

// ── Real-data validation: CARE to Compare, Wind Farm B (offshore) ──

export interface CareEvent {
  event_id: number;
  label: "anomaly" | "normal";
  description: string;
  window_days: number;
  prediction_days: number;
  channels_charted: number;
  median_limit_factor: number;
  alarm_at_live_limit: boolean;
  alarm: boolean;
  first_channel: string | null;
  first_alarm_day: number | null;
  warning_days: number | null;
  channels_in_alarm: string[];
  daily_health_min: (number | null)[];
  daily_residual_k: (number | null)[] | null;
}

export interface CareBenchmark {
  source: string;
  settings: Record<string, number | string>;
  summary: {
    anomaly_events: number;
    detected: number;
    normal_events: number;
    false_alarms: number;
    median_warning_days: number | null;
  };
  summary_live_limit: { detected: number; false_alarms: number };
  events: CareEvent[];
}

/** The twin's detector on real offshore SCADA with recorded faults (bundled result). */
export function getCareBenchmark(): Promise<CareBenchmark> {
  return request(`${BASE}/real-data/care`);
}
