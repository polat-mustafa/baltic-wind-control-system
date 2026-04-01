/**
 * Typed fetch wrapper for M04 Multi-Farm Comparison API endpoints.
 *
 * Every function maps 1:1 to a backend route in backend/app/routers/p1_farms.py.
 * Compares AEP, LCOE, capacity factor across multiple farm configurations.
 */

import type {
  FarmComparisonResponse,
  FarmConfig,
} from "../types/farmComparison";

import { post, request } from "./apiClient";

const BASE = "/api/v1/wind";

// ── Farm comparison ───────────────────────────────────────────────

export function compareFarms(
  farms: FarmConfig[],
): Promise<FarmComparisonResponse> {
  return post(`${BASE}/farms/compare`, { farms });
}

// ── Default and preset configs ────────────────────────────────────

export function getDefaultFarm(): Promise<FarmConfig> {
  return request(`${BASE}/farms/default`);
}

export function getFarmPresets(): Promise<FarmConfig[]> {
  return request(`${BASE}/farms/presets`);
}
