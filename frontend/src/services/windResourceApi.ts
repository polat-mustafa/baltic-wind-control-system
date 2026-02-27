/**
 * Typed fetch wrapper for all P1 wind resource API endpoints.
 *
 * Every function maps 1:1 to a backend route in backend/app/routers/p1.py.
 * Pattern follows commissioningApi.ts — Vite dev proxy forwards /api.
 */

import type {
  AEPCascadeResult,
  BlockageResult,
  LayoutComparisonResult,
  LayoutPositions,
  TurbineSpec,
  WakeAnalysisResult,
  WeibullFitResult,
  WindRoseResult,
} from "../types/windResource";

const BASE = "/api/v1/wind";

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

// ── Turbine Spec ────────────────────────────────────────────────

export function getTurbineSpec(): Promise<TurbineSpec> {
  return request(`${BASE}/turbine-spec`);
}

// ── Weibull Fit ─────────────────────────────────────────────────

export function fitWeibull(
  weibull_a: number,
  weibull_k: number,
  num_samples?: number,
): Promise<WeibullFitResult> {
  return post(`${BASE}/weibull-fit`, { weibull_a, weibull_k, num_samples });
}

// ── Wind Rose ───────────────────────────────────────────────────

export function computeWindRose(
  weibull_a: number,
  weibull_k: number,
  num_samples?: number,
  num_sectors?: number,
): Promise<WindRoseResult> {
  return post(`${BASE}/wind-rose`, {
    weibull_a,
    weibull_k,
    num_samples,
    num_sectors,
  });
}

// ── Wake Analysis ───────────────────────────────────────────────

export function runWakeAnalysis(
  layout: string,
  weibull_a: number,
  weibull_k: number,
  turbulence_intensity: number,
): Promise<WakeAnalysisResult> {
  return post(`${BASE}/wake-analysis`, {
    layout,
    weibull_a,
    weibull_k,
    turbulence_intensity,
  });
}

// ── AEP Cascade ─────────────────────────────────────────────────

export function computeAEPCascade(
  layout: string,
  weibull_a: number,
  weibull_k: number,
  turbulence_intensity: number,
  price_eur_mwh: number,
): Promise<AEPCascadeResult> {
  return post(`${BASE}/aep-cascade`, {
    layout,
    weibull_a,
    weibull_k,
    turbulence_intensity,
    price_eur_mwh,
  });
}

// ── Blockage ────────────────────────────────────────────────────

export function estimateBlockage(
  layout: string,
  mean_wind_speed_ms: number,
): Promise<BlockageResult> {
  return post(`${BASE}/blockage`, { layout, mean_wind_speed_ms });
}

// ── Layout Comparison ───────────────────────────────────────────

export function compareLayouts(
  weibull_a: number,
  weibull_k: number,
  turbulence_intensity: number,
  price_eur_mwh: number,
): Promise<LayoutComparisonResult> {
  return post(`${BASE}/layout-comparison`, {
    weibull_a,
    weibull_k,
    turbulence_intensity,
    price_eur_mwh,
  });
}

// ── Layout Positions ────────────────────────────────────────────

export function getLayoutPositions(name: string): Promise<LayoutPositions> {
  return request(`${BASE}/layouts/${name}/positions`);
}
