/**
 * Typed fetch wrapper for PPC (Power Plant Controller) API endpoints.
 *
 * Maps 1:1 to backend routes in backend/app/routers/p2.py (PPC section).
 * Pattern follows gridApi.ts — Vite dev proxy forwards /api.
 */

import type {
  PPCSimulationRequest,
  PPCSimulationResponse,
  PPCStatusResponse,
  TSOSetpoint,
  ActivePowerMode,
  ReactivePowerMode,
} from "../types/ppc";

import { post, request } from "./apiClient";

const BASE = "/api/v1/grid/ppc";

// ── PPC Status ───────────────────────────────────────────────────

/** Get PPC status at default operating conditions (rated wind, all turbines). */
export function getPPCStatus(): Promise<PPCStatusResponse> {
  return request(`${BASE}/status`);
}

/** Get PPC status at specified conditions. */
export function getPPCStatusCustom(params: {
  wind_speed_ms: number;
  available_turbines: number;
  active_power_mode: ActivePowerMode;
  reactive_power_mode: ReactivePowerMode;
  frequency_hz: number;
  tso_setpoint: TSOSetpoint;
}): Promise<PPCStatusResponse> {
  return post(`${BASE}/status`, params);
}

// ── PPC Simulation ───────────────────────────────────────────────

/** Run PPC control simulation over a time window. */
export function runPPCSimulation(
  params: PPCSimulationRequest,
): Promise<PPCSimulationResponse> {
  return post(`${BASE}/simulate`, params);
}
