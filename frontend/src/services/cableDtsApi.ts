/**
 * Typed fetch wrapper for Cable DTS (Distributed Temperature Sensing) API endpoints.
 *
 * Maps 1:1 to backend routes in backend/app/routers/p2_cable_dts.py.
 * Vite dev proxy forwards /api → localhost:8000.
 */

import type {
  DTSProfileResponse,
  DynamicRatingResponse,
  HotspotResponse,
} from "../types/cableDts";

import { post, request } from "./apiClient";

const BASE = "/api/v1/grid/cable";

// ── DTS Profile ───────────────────────────────────────────────────

/**
 * Fetch the full 45 km temperature profile at a given current and ambient temperature.
 * Returns one DTSProfilePoint per km resolution.
 */
export function getDTSProfile(
  currentA: number,
  ambientTempC: number,
): Promise<DTSProfileResponse> {
  return request(
    `${BASE}/dts/profile?current_a=${currentA}&ambient_temp_c=${ambientTempC}`,
  );
}

// ── Dynamic Rating ────────────────────────────────────────────────

/**
 * Fetch dynamic ampacity rating — accounts for ambient temperature correction
 * vs the static IEC 60287 rating of 800 A.
 */
export function getDynamicRating(
  currentA: number,
  ambientTempC: number,
): Promise<DynamicRatingResponse> {
  return request(
    `${BASE}/dts/dynamic-rating?current_a=${currentA}&ambient_temp_c=${ambientTempC}`,
  );
}

// ── Hotspots ──────────────────────────────────────────────────────

/**
 * Fetch the list of hotspot locations along the cable route.
 * Hotspots are sections where temperature exceeds 70 °C (warning) or 90 °C (critical).
 */
export function getHotspots(
  currentA: number,
  ambientTempC: number,
): Promise<HotspotResponse> {
  return request(
    `${BASE}/dts/hotspots?current_a=${currentA}&ambient_temp_c=${ambientTempC}`,
  );
}

// ── Simulate (POST variant) ───────────────────────────────────────

/**
 * POST variant of profile fetch — used when backend requires body instead of query params.
 */
export function simulateDTSProfile(
  currentA: number,
  ambientTempC: number,
): Promise<DTSProfileResponse> {
  return post(`${BASE}/dts/simulate`, {
    current_a: currentA,
    ambient_temp_c: ambientTempC,
  });
}
