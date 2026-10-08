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
  UncertaintyResult,
  WakeAnalysisResult,
  WeibullFitResult,
  WindRoseResult,
} from "../types/windResource";

import { DEFAULT_TURBINE_ID } from "../constants/turbineModels";
import { post, request } from "./apiClient";
import { SB510_WIND } from "../constants/sb510Wind";

const BASE = "/api/v1/wind";

// ── Turbine Spec ────────────────────────────────────────────────

/** Reference turbine specification (default SB-510's IEA 15 MW). */
export function getTurbineSpec(model?: string): Promise<TurbineSpec> {
  return request(`${BASE}/turbine-spec${model ? `?model=${encodeURIComponent(model)}` : ""}`);
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

/** PyWake AEP for arbitrary positions, local metres (x east, y north). */
export function runCustomWakeAnalysis(
  x_m: number[],
  y_m: number[],
  weibull_a: number = SB510_WIND.weibullA,
  weibull_k: number = SB510_WIND.weibullK,
  turbulence_intensity = 0.06,
  turbine_model = DEFAULT_TURBINE_ID,
  sector_frequencies: number[] | null = null,
  neighbours: { x_m: number[]; y_m: number[] } | null = null,
): Promise<WakeAnalysisResult> {
  return post(`${BASE}/wake-analysis-custom`, {
    x_m,
    y_m,
    weibull_a,
    weibull_k,
    turbulence_intensity,
    turbine_model,
    sector_frequencies,
    ...(neighbours ? { neighbour_x_m: neighbours.x_m, neighbour_y_m: neighbours.y_m } : {}),
  });
}

export interface WakeMoveResult {
  index: number;
  net_aep_gwh: number;
  delta_gwh: number;
  delta_percent: number;
  wake_loss_percent: number;
}

/** PyWake check of single-turbine moves (≤ 5) against the base layout, same wind. */
export function checkWakeMoves(
  x_m: number[],
  y_m: number[],
  moves: { index: number; x_m: number; y_m: number }[],
  wind: { weibull_a: number; weibull_k: number; sector_frequencies: number[] | null },
  turbine_model = DEFAULT_TURBINE_ID,
): Promise<{ base_net_aep_gwh: number; moves: WakeMoveResult[] }> {
  return post(`${BASE}/wake-moves`, { x_m, y_m, moves, turbine_model, ...wind });
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

/** AEP uncertainty components of a farm (wind, wake loss, turbine) and their RSS. */
export const getUncertainty = (body: {
  weibull_a: number;
  weibull_k: number;
  wake_loss_percent: number;
  blockage_loss_percent?: number;
  turbine_model?: string;
}): Promise<UncertaintyResult> => post(`${BASE}/uncertainty`, body);
