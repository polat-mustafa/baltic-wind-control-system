/**
 * BESS Integration API — M08.
 * Maps to backend routers/p2_bess.py.
 * Endpoints: /api/v1/grid/bess/* and /api/v1/grid/ppc/bess-dispatch
 * Spec: 50 MW / 200 MWh LFP, C-rate 0.25, SOC 10-90%, 3000 cycles to 80% SoH.
 */

import type {
  BESSStatusResponse,
  BESSModeRequest,
  FrequencyResponseRequest,
  FrequencyResponseResult,
  RampSmoothingRequest,
  RampSmoothingResult,
  DegradationRequest,
  DegradationResponse,
  BESSDispatchRequest,
  BESSDispatchResponse,
} from "../types/bess";

// BESSModeResponse is internal to the API layer — define it locally
interface BESSModeResponse {
  previous_mode: string;
  new_mode: string;
  power_setpoint_mw: number;
  soc_current_pct: number;
  transition_allowed: boolean;
  reason: string;
}

import { post, request } from "./apiClient";

const BASE = "/api/v1/grid/bess";

/** Get current BESS state (SOC%, power, mode, temperature, SoH, cycle count). */
export function getBESSStatus(): Promise<BESSStatusResponse> {
  return request(`${BASE}/status`);
}

/** Request a BESS mode change (STANDBY, CHARGE, DISCHARGE, FREQUENCY_RESPONSE, …). */
export function setBESSMode(req: BESSModeRequest): Promise<BESSModeResponse> {
  return post(`${BASE}/mode`, req);
}

/**
 * Simulate FCR / FFR frequency response.
 * Input: frequency trace (Hz) + FCR droop + FFR threshold + initial SOC.
 * Returns time-series: frequency, BESS power, SOC — includes nadir and energy delivered.
 */
export function simFrequencyResponse(
  req: FrequencyResponseRequest,
): Promise<FrequencyResponseResult> {
  return post(`${BASE}/simulate/frequency-response`, req);
}

/**
 * Simulate ramp smoothing of wind power variability.
 * Returns before/after ramp violation counts + BESS charge/discharge peaks.
 */
export function simRampSmoothing(
  req: RampSmoothingRequest,
): Promise<RampSmoothingResult> {
  return post(`${BASE}/simulate/ramp-smoothing`, req);
}

/**
 * Project BESS degradation over N years.
 * Returns SoH% per year, EOL year, replacement cost, LCOE contribution.
 */
export function calcDegradation(req: DegradationRequest): Promise<DegradationResponse> {
  return post(`${BASE}/degradation`, req);
}

/** Combined WTG + BESS dispatch (fills gap when WTG alone can't meet P_target). */
export function dispatchBESS(req: BESSDispatchRequest): Promise<BESSDispatchResponse> {
  return post("/api/v1/grid/ppc/bess-dispatch", req);
}
