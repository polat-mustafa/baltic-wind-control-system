/**
 * P1 wake & uncertainty studies — backend/app/routers/p1.py (PyWake on the selected layout):
 * wake-model comparison, FLOWERS analytical AEP, wake steering (one direction and the year),
 * axial-induction derating and the PCE spread of AEP from the wind-climate inputs.
 */

import { post } from "./apiClient";

const BASE = "/api/v1/wind";

/** Wind inputs every study shares (the AEP tab's controls). */
export interface StudyWind {
  layout: string;
  weibull_a: number;
  weibull_k: number;
  turbulence_intensity: number;
}

export interface WakeModelRow {
  model_name: string;
  net_aep_gwh: number;
  wake_loss_percent: number;
  capacity_factor: number;
}

export interface WakeModelComparison {
  results: WakeModelRow[];
  aep_range_gwh: number;
  wake_loss_range_percent: number;
}

export interface FlowersResult {
  aep_gwh: number;
  gross_aep_gwh: number;
  wake_loss_percent: number;
  computation_time_ms: number;
  capacity_factor: number;
  n_fourier_modes: number;
}

export interface YawResult {
  wind_direction_deg: number;
  baseline_power_mw: number;
  optimized_power_mw: number;
  power_gain_percent: number;
  optimal_yaw_angles_deg: number[];
}

export interface FarmYawResult {
  baseline_aep_gwh: number;
  optimized_aep_gwh: number;
  aep_gain_percent: number;
  mean_power_gain_percent: number;
  max_power_gain_percent: number;
  best_direction_deg: number;
  per_direction_results: YawResult[];
}

export interface DeratingResult {
  baseline_power_mw: number;
  derated_power_mw: number;
  power_gain_percent: number;
  optimal_derating_fraction: number;
  upstream_loss_mw: number;
  downstream_gain_mw: number;
}

export interface PceResult {
  mean_aep_gwh: number;
  std_aep_gwh: number;
  cov_percent: number;
  p50_gwh: number;
  p75_gwh: number;
  p90_gwh: number;
  dominant_parameter: string;
  sobol_indices: { parameter: string; first_order: number }[];
  q2_loo: number;
  pce_order: number;
  num_samples: number;
}

export const compareWakeModels = (w: StudyWind): Promise<WakeModelComparison> =>
  post(`${BASE}/wake-model-comparison`, w);

/** FLOWERS needs the mean speed, not A: v̄ = A·Γ(1 + 1/k) is passed by the caller. */
export const flowersAep = (w: StudyWind, meanWindMs: number): Promise<FlowersResult> =>
  post(`${BASE}/flowers-aep`, { layout: w.layout, mean_wind_speed_ms: meanWindMs, weibull_k: w.weibull_k });

export const optimiseYaw = (w: StudyWind, directionDeg: number, windMs: number): Promise<YawResult> =>
  post(`${BASE}/yaw-optimization`, { ...w, wind_direction_deg: directionDeg, wind_speed_ms: windMs });

export const optimiseYawFarm = (w: StudyWind, windMs: number): Promise<FarmYawResult> =>
  post(`${BASE}/yaw-optimization-farm`, { ...w, wind_speed_ms: windMs });

export const derating = (w: StudyWind, directionDeg: number): Promise<DeratingResult> =>
  post(`${BASE}/derating`, { ...w, wind_direction_deg: directionDeg });

export const pceUncertainty = (layout: string): Promise<PceResult> =>
  post(`${BASE}/pce-uncertainty`, { layout });
