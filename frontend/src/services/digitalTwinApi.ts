/**
 * Typed fetch wrapper for Digital Twin API endpoints.
 *
 * Maps 1:1 to backend routes in backend/app/routers/digital_twin.py.
 * Vite dev proxy forwards /api → localhost:8000.
 */

import { post, request } from "./apiClient";

const BASE = "/api/v1/digital-twin";

// ── Response Types ───────────────────────────────────────────────

export interface TurbineHealth {
  turbine_id: number;
  turbine_name: string;
  health_power: number;
  health_rpm: number;
  health_pitch: number;
  health_composite: number;
  status: "healthy" | "degraded" | "critical";
  anomaly_count: number;
}

export interface AnomalyRecord {
  turbine_id: number;
  timestep: number;
  category: string;
  severity: "low" | "medium" | "high";
  description: string;
  power_ewma_pct: number;
  rpm_ewma_pct: number;
  pitch_ewma_pct: number;
}

export interface DegradationTrend {
  turbine_id: number;
  turbine_name: string;
  health_values: number[];
  slope_pct_per_day: number;
  rul_days: number | null;
}

export interface TwinComparison {
  timestamps: number[];
  wind_speed_ms: number[];
  actual_power_mw: number[];
  twin_power_mw: number[];
  residual_mw: number[];
  residual_pct: number[];
  power_ewma: number[];
}

export interface FarmHealthSummary {
  farm_health_pct: number;
  healthy_count: number;
  degraded_count: number;
  critical_count: number;
  worst_turbine_id: number;
  worst_turbine_name: string;
  total_anomalies: number;
}

export interface AnalyzeResponse {
  scenario: string;
  num_timesteps: number;
  num_turbines: number;
  farm_health: FarmHealthSummary;
  turbine_health: TurbineHealth[];
  anomalies: AnomalyRecord[];
  degradation_trends: DegradationTrend[];
  comparison_data: TwinComparison;
}

export interface ScenarioInfo {
  name: string;
  description: string;
}

export interface DigitalTwinConfig {
  health_weights: Record<string, number>;
  health_thresholds: Record<string, number>;
  sigma_baselines: Record<string, number>;
  ewma_span: number;
  available_scenarios: string[];
}

export interface SingleTurbineResponse {
  wind_speed_ms: number;
  wind_dir_deg: number;
  actual_power_mw: number;
  twin_power_mw: number;
  residual_mw: number;
  residual_pct: number;
  health_composite: number;
  status: string;
}

// ── API Functions ────────────────────────────────────────────────

export function getConfig(): Promise<DigitalTwinConfig> {
  return request(`${BASE}/config`);
}

export function getScenarios(): Promise<ScenarioInfo[]> {
  return request(`${BASE}/scenarios`);
}

export function postAnalyze(
  scenario: string,
  numTimesteps: number = 144,
  numTurbines: number = 34,
  seed: number = 42,
): Promise<AnalyzeResponse> {
  return post(`${BASE}/analyze`, {
    scenario,
    num_timesteps: numTimesteps,
    num_turbines: numTurbines,
    seed,
  });
}

export function postSingleTurbine(
  windSpeedMs: number,
  windDirDeg: number,
  actualPowerMw: number,
): Promise<SingleTurbineResponse> {
  return post(`${BASE}/single-turbine`, {
    wind_speed_ms: windSpeedMs,
    wind_dir_deg: windDirDeg,
    actual_power_mw: actualPowerMw,
  });
}
