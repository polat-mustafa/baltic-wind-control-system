/**
 * Condition Monitoring System (CMS) API — M12.
 * Maps to backend routers/p3/cms.py.
 * Endpoints: /api/v1/scada/cms/*
 * Fleet: 34 × Vestas V236-15.0 MW turbines.
 */

import type {
  FleetHealthResponse,
  TurbineHealthResponse,
  VibrationSpectrumResponse,
  OilAnalysisResponse,
  CMSAlertResponse,
  FaultInjectionRequest,
  FaultInjectionResponse,
  CMSComponent,
} from "../types/cms";

import { post, request } from "./apiClient";

const BASE = "/api/v1/scada/cms";

/** Fetch fleet-wide health overview for all 34 turbines. */
export function getFleetOverview(): Promise<FleetHealthResponse> {
  return request(`${BASE}/fleet/overview`);
}

/** Fetch full health status for one turbine (all 8 components). */
export function getTurbineHealth(turbineId: string): Promise<TurbineHealthResponse> {
  return request(`${BASE}/turbines/${turbineId}/health`);
}

/**
 * Fetch FFT vibration spectrum for a turbine component.
 * Returns ~200 frequency-amplitude points (0–2000 Hz).
 */
export function getVibrationSpectrum(
  turbineId: string,
  component: CMSComponent,
): Promise<VibrationSpectrumResponse> {
  return request(`${BASE}/turbines/${turbineId}/vibration?component=${component}`);
}

/** Fetch gearbox oil analysis history (ISO 4406 cleanliness trend). */
export function getOilAnalysis(turbineId: string): Promise<OilAnalysisResponse> {
  return request(`${BASE}/turbines/${turbineId}/oil-analysis`);
}

/** Fetch active CMS degradation alerts for all turbines. */
export function getCMSAlerts(): Promise<CMSAlertResponse[]> {
  return request(`${BASE}/alerts`);
}

/**
 * Inject a simulated fault for educational purposes (no real hardware effect).
 * Useful for training: shows how health index degrades over time.
 */
export function simulateFault(
  turbineId: string,
  req: FaultInjectionRequest,
): Promise<FaultInjectionResponse> {
  return post(`${BASE}/turbines/${turbineId}/simulate-fault`, req);
}
