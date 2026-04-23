/**
 * P1 Research Tools API — wrappers for 8 advanced wind-resource endpoints
 * that previously had no UI caller (audit 2026-04-20).
 *
 * Backend: backend/app/routers/p1.py (POST /api/v1/wind/{tool}).
 * All bodies match the FastAPI Pydantic Field() defaults so a "Run" with
 * no edits produces a valid result.
 */

import { post } from "./apiClient";

const BASE = "/api/v1/wind";

// ── Request bodies ──────────────────────────────────────────────────

export interface HelixControlRequest {
  layout: string;
  wind_direction_deg: number;
  wind_speed_ms: number;
  turbulence_intensity: number;
  helix_amplitude_deg: number;
}

export interface DynamicFlowRequest {
  layout: string;
  dt_s: number;
  duration_s: number;
}

export interface CFDSimulationRequest {
  layout: string;
  wind_speed_ms: number;
  wind_direction_deg: number;
  mesh_resolution: "coarse" | "medium" | "fine";
  terrain_type: string;
}

export interface SimultaneousOptRequest {
  layout: string;
  maxiter: number;
}

export interface AdjointSensitivityRequest {
  layout: string;
}

export interface TwoStageStochasticRequest {
  layout: string;
  n_scenarios: number;
  maxiter: number;
}

export interface MGARequest {
  layout: string;
  n_alternatives: number;
  aep_slack_percent: number;
}

export interface GaussianFLOWERSRequest {
  layout: string;
  mean_wind_speed_ms: number;
  n_fourier_modes: number;
}

// ── Defaults (match backend Field defaults) ──────────────────────────

export const RESEARCH_DEFAULTS = {
  helixControl: { layout: "staggered", wind_direction_deg: 240, wind_speed_ms: 10, turbulence_intensity: 0.06, helix_amplitude_deg: 2 } satisfies HelixControlRequest,
  dynamicFlow: { layout: "staggered", dt_s: 60, duration_s: 3600 } satisfies DynamicFlowRequest,
  cfdSimulation: { layout: "staggered", wind_speed_ms: 10.5, wind_direction_deg: 240, mesh_resolution: "coarse" as const, terrain_type: "offshore_flat" } satisfies CFDSimulationRequest,
  simultaneousOpt: { layout: "staggered", maxiter: 5 } satisfies SimultaneousOptRequest,
  adjointSensitivity: { layout: "staggered" } satisfies AdjointSensitivityRequest,
  twoStageStochastic: { layout: "staggered", n_scenarios: 3, maxiter: 3 } satisfies TwoStageStochasticRequest,
  mga: { layout: "staggered", n_alternatives: 3, aep_slack_percent: 2 } satisfies MGARequest,
  gaussianFlowers: { layout: "staggered", mean_wind_speed_ms: 10.5, n_fourier_modes: 12 } satisfies GaussianFLOWERSRequest,
};

// ── POST wrappers ────────────────────────────────────────────────────

export const postHelixControl = (b: HelixControlRequest) => post<unknown>(`${BASE}/helix-control`, b);
export const postDynamicFlow = (b: DynamicFlowRequest) => post<unknown>(`${BASE}/dynamic-flow`, b);
export const postCFDSimulation = (b: CFDSimulationRequest) => post<unknown>(`${BASE}/cfd-simulation`, b);
export const postSimultaneousOpt = (b: SimultaneousOptRequest) => post<unknown>(`${BASE}/simultaneous-optimization`, b);
export const postAdjointSensitivities = (b: AdjointSensitivityRequest) => post<unknown>(`${BASE}/adjoint-sensitivities`, b);
export const postTwoStageStochastic = (b: TwoStageStochasticRequest) => post<unknown>(`${BASE}/two-stage-stochastic`, b);
export const postMGA = (b: MGARequest) => post<unknown>(`${BASE}/mga`, b);
export const postGaussianFlowers = (b: GaussianFLOWERSRequest) => post<unknown>(`${BASE}/gaussian-flowers-aep`, b);
