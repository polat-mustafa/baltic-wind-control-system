/**
 * Typed fetch wrapper for the M04 Multi-Farm Comparison API
 * (backend/app/routers/p1_farms.py).
 */

import type { FarmComparisonResponse, FarmConfig } from "../types/farmComparison";

import { post } from "./apiClient";

/** Compare 2–4 inline farm configurations (not stored server-side). */
export function compareFarms(
  farms: FarmConfig[],
  electricityPriceEurMwh: number,
): Promise<FarmComparisonResponse> {
  return post("/api/v1/wind/farms/compare", {
    farms,
    electricity_price_eur_mwh: electricityPriceEurMwh,
  });
}
