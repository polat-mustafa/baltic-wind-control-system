/**
 * Typed fetch wrapper for M13 Availability Tracking API endpoints.
 *
 * Every function maps 1:1 to a backend route in backend/app/routers/p1_availability.py.
 * IEC 61400-26: TBA, EBA, PBA metrics + downtime category breakdown.
 */

import type {
  DowntimeBreakdownResponse,
  FarmAvailabilityResponse,
  TurbineAvailabilityKPI,
} from "../types/availability";

import { request } from "./apiClient";

const BASE = "/api/v1/wind";

// ── Fleet availability ────────────────────────────────────────────

export function getFleetAvailability(): Promise<FarmAvailabilityResponse> {
  return request(`${BASE}/availability/fleet`);
}

// ── Turbine availability ──────────────────────────────────────────

export function getTurbineAvailability(
  turbineId: string,
): Promise<TurbineAvailabilityKPI> {
  return request(`${BASE}/availability/turbine/${turbineId}`);
}

// ── Downtime breakdown ────────────────────────────────────────────

/** scope: "fleet" or a turbine_id e.g. "WTG-01" */
export function getDowntimeBreakdown(
  scope: string,
): Promise<DowntimeBreakdownResponse> {
  return request(`${BASE}/availability/breakdown/${scope}`);
}
