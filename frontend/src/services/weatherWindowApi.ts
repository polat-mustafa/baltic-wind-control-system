/**
 * Typed fetch wrapper for M14 Weather Window & O&M Logistics API endpoints.
 *
 * Every function maps 1:1 to a backend route in backend/app/routers/p1_weather_window.py.
 * Vessel access probabilities derived from ERA5 Hs/Uw hindcast data.
 */

import type {
  AllVesselAccessResponse,
  OAMCostBreakdown,
} from "../types/weatherWindow";

import { request } from "./apiClient";

const BASE = "/api/v1/wind";

// ── Vessel access ─────────────────────────────────────────────────

export function getAllVesselAccess(
  year?: number,
): Promise<AllVesselAccessResponse> {
  return request(`${BASE}/weather-windows?year=${year ?? 2025}`);
}

// ── O&M cost breakdown ────────────────────────────────────────────

export function getOAMCost(
  nTurbines?: number,
  turbineRatedMw?: number,
): Promise<OAMCostBreakdown> {
  return request(
    `${BASE}/oam-cost?n_turbines=${nTurbines ?? 34}&turbine_rated_mw=${turbineRatedMw ?? 15.0}`,
  );
}
