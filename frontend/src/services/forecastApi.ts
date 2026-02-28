/**
 * Typed fetch wrapper for P4 AI Forecasting API endpoints.
 *
 * Every function maps 1:1 to a backend route in backend/app/routers/p4.py.
 * Pattern follows gridApi.ts — Vite dev proxy forwards /api.
 */

import type {
  EnsemblePredictResponse,
  ModelCompareResponse,
  RampDetectResponse,
  SHAPResponse,
  TurbineSpec,
} from "../types/forecast";

const BASE = "/api/v1/forecast";

// ── Helpers ────────────────────────────────────────────────────

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function post<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, { method: "POST", body: JSON.stringify(body) });
}

// ── Turbine Spec ──────────────────────────────────────────────

export function getTurbineSpec(): Promise<TurbineSpec> {
  return request(`${BASE}/turbine-spec`);
}

// ── Ensemble Prediction ───────────────────────────────────────

export function predictEnsemble(
  numTurbines: number,
  numTimesteps: number,
  turbineIndex: number,
  horizonSteps: number,
  seed?: number,
): Promise<EnsemblePredictResponse> {
  return post(`${BASE}/predict-ensemble`, {
    num_turbines: numTurbines,
    num_timesteps: numTimesteps,
    turbine_index: turbineIndex,
    horizon_steps: horizonSteps,
    seed,
  });
}

// ── Model Comparison ──────────────────────────────────────────

export function compareModels(
  numTurbines: number,
  numTimesteps: number,
  turbineIndex: number,
  horizonSteps: number,
  seed?: number,
): Promise<ModelCompareResponse> {
  return post(`${BASE}/compare-models`, {
    num_turbines: numTurbines,
    num_timesteps: numTimesteps,
    turbine_index: turbineIndex,
    horizon_steps: horizonSteps,
    seed,
  });
}

// ── XGBoost SHAP ──────────────────────────────────────────────

export function getXGBoostSHAP(
  numTurbines: number,
  numTimesteps: number,
  turbineIndex: number,
  topKFeatures: number = 10,
  seed?: number,
): Promise<SHAPResponse> {
  return post(`${BASE}/xgboost-shap`, {
    num_turbines: numTurbines,
    num_timesteps: numTimesteps,
    turbine_index: turbineIndex,
    top_k_features: topKFeatures,
    seed,
  });
}

// ── Ramp Detection ────────────────────────────────────────────

export function detectRamps(
  numTurbines: number,
  numTimesteps: number,
  turbineIndex: number,
  horizonSteps: number,
  thresholdMwHr: number,
  seed?: number,
): Promise<RampDetectResponse> {
  return post(`${BASE}/detect-ramps`, {
    num_turbines: numTurbines,
    num_timesteps: numTimesteps,
    turbine_index: turbineIndex,
    horizon_steps: horizonSteps,
    threshold_mw_hr: thresholdMwHr,
    seed,
  });
}
