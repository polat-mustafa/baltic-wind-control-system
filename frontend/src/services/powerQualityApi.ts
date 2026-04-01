/**
 * Power Quality & Harmonics API — M06.
 * Maps to backend routers/p2_power_quality.py.
 * Endpoints: /api/v1/grid/power-quality/*
 * Standards: IEC 61000-3-6 (harmonics), IEC 61000-3-7 (flicker).
 */

import type {
  HarmonicSpectrumRequest,
  HarmonicAnalysisResponse,
  ResonanceScanRequest,
  ResonanceScanResponse,
  FlickerRequest,
  FlickerResponse,
  FilterDesignRequest,
  FilterDesignResponse,
  HarmonicLimitsResponse,
} from "../types/powerQuality";

import { post, request } from "./apiClient";

const BASE = "/api/v1/grid/power-quality";

/**
 * Analyse harmonic spectrum at the 66 kV POC.
 * Input: harmonic magnitudes dict (order → % of fundamental).
 */
export function analyzeHarmonics(
  req: HarmonicSpectrumRequest,
): Promise<HarmonicAnalysisResponse> {
  return post(`${BASE}/harmonics`, req);
}

/**
 * Scan network impedance vs frequency to identify parallel resonance.
 * Returns impedance profile 0–2500 Hz with resonance peak markers.
 */
export function runResonanceScan(
  req: ResonanceScanRequest,
): Promise<ResonanceScanResponse> {
  return post(`${BASE}/resonance-scan`, req);
}

/**
 * Compute flicker emission (Pst/Plt) per IEC 61000-3-7.
 * Baltic Wind 66 kV is IEC HV tier (≥35 kV boundary).
 */
export function computeFlicker(req: FlickerRequest): Promise<FlickerResponse> {
  return post(`${BASE}/flicker`, req);
}

/**
 * Design a passive LC filter tuned to the dominant harmonic.
 * Returns capacitor MVAR, reactor mH, quality factor, insertion loss.
 */
export function designFilter(req: FilterDesignRequest): Promise<FilterDesignResponse> {
  return post(`${BASE}/filter-design`, req);
}

/** Fetch IEC 61000-3-6 harmonic planning levels for all voltage tiers. */
export function getHarmonicLimits(): Promise<HarmonicLimitsResponse> {
  return request(`${BASE}/limits`);
}
