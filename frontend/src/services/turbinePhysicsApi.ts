/**
 * Typed fetch wrapper for Turbine Physics API endpoints.
 *
 * Maps 1:1 to backend routes in backend/app/routers/turbine_physics.py.
 * Vite dev proxy forwards /api → localhost:8000.
 */

import { post, request } from "./apiClient";

const BASE = "/api/v1/turbine-physics";

// ── Response Types ───────────────────────────────────────────────

export interface SimulationSummary {
  total_energy_mwh: number;
  mean_power_mw: number;
  max_power_mw: number;
  capacity_factor: number;
  mean_rotor_speed_rpm: number;
  mean_pitch_deg: number;
  mean_yaw_error_deg: number;
  duration_s: number;
  num_steps: number;
}

export interface SimulationResponse {
  time_s: number[];
  wind_speed_ms: number[];
  wind_dir_deg: number[];
  rotor_speed_rpm: number[];
  pitch_angle_deg: number[];
  electrical_power_mw: number[];
  aero_power_mw: number[];
  tip_speed_ratio: number[];
  cp: number[];
  yaw_error_deg: number[];
  gen_speed_rpm: number[];
  nacelle_dir_deg: number[];
  status: string[];
  summary: SimulationSummary;
}

export interface CpSurfaceResponse {
  tip_speed_ratios: number[];
  pitch_angles_deg: number[];
  cp_matrix: number[][];
  cp_max: number;
  lambda_opt: number;
  betz_limit: number;
}

export interface TurbinePhysicsConfig {
  turbine_name: string;
  rotor_diameter_m: number;
  rated_power_mw: number;
  cut_in_speed_ms: number;
  rated_speed_ms: number;
  cut_out_speed_ms: number;
  rotor_inertia_kg_m2: number;
  min_rotor_speed_rpm: number;
  max_rotor_speed_rpm: number;
  gearbox_ratio: number;
  gearbox_efficiency: number;
  generator_efficiency: number;
  pitch_kp: number;
  pitch_ki: number;
  pitch_rate_limit_deg_s: number;
  yaw_rate_deg_s: number;
  yaw_deadband_deg: number;
  yaw_power_loss_exponent: number;
}

export interface AerodynamicStateResponse {
  wind_speed_ms: number;
  rotor_speed_rpm: number;
  pitch_angle_deg: number;
  tip_speed_ratio: number;
  cp: number;
  ct: number;
  aero_power_mw: number;
  aero_torque_nm: number;
  thrust_force_kn: number;
}

// ── API Functions ────────────────────────────────────────────────

export function getConfig(): Promise<TurbinePhysicsConfig> {
  return request(`${BASE}/config`);
}

export function getCpSurface(): Promise<CpSurfaceResponse> {
  return request(`${BASE}/cp-surface`);
}

export function postSimulate(
  windSpeedsMs: number[],
  dt: number,
  initialRotorSpeedRpm: number,
  airDensityKgM3: number,
  windDirsDeg?: number[],
): Promise<SimulationResponse> {
  return post(`${BASE}/simulate`, {
    wind_speeds_ms: windSpeedsMs,
    wind_dirs_deg: windDirsDeg,
    dt,
    initial_rotor_speed_rpm: initialRotorSpeedRpm,
    air_density_kg_m3: airDensityKgM3,
  });
}

export function postStepResponse(
  vInitMs: number,
  vFinalMs: number,
  rampS: number,
  totalS: number,
  dt: number,
): Promise<SimulationResponse> {
  return post(`${BASE}/step-response`, {
    v_init_ms: vInitMs,
    v_final_ms: vFinalMs,
    ramp_s: rampS,
    total_s: totalS,
    dt,
  });
}

export function postAeroState(
  windSpeedMs: number,
  rotorSpeedRpm: number,
  pitchAngleDeg: number,
  airDensityKgM3: number,
): Promise<AerodynamicStateResponse> {
  return post(`${BASE}/aerodynamic-state`, {
    wind_speed_ms: windSpeedMs,
    rotor_speed_rpm: rotorSpeedRpm,
    pitch_angle_deg: pitchAngleDeg,
    air_density_kg_m3: airDensityKgM3,
  });
}
