/**
 * Typed fetch wrapper for Market Integration (TGE/PSE) API endpoints.
 *
 * Maps 1:1 to backend routes in backend/app/routers/p2_market.py.
 * Vite dev proxy forwards /api → localhost:8000.
 *
 * TGE = Towarowa Gielda Energii (Polish Power Exchange, day-ahead market).
 * PSE = Polskie Sieci Elektroenergetyczne (Polish TSO, imbalance settlement).
 */

import type {
  DABidRequest,
  DABidResponse,
  RevenueSimulationRequest,
  RevenueSimulationResponse,
  AncillaryServicesRequest,
  AncillaryServicesResponse,
} from "../types/market";

import { post } from "./apiClient";

const BASE = "/api/v1/grid/market";

// ── Default TGE Day-Ahead Price Profile ───────────────────────────

/**
 * Typical Polish day-ahead hourly prices (EUR/MWh), hours 0-23.
 * - Off-peak nights (00-05h): low 40-55 EUR/MWh
 * - Very early hours (01-03h): mildly negative during high wind / low demand
 * - Morning peak (07-09h): 85-100 EUR/MWh
 * - Midday shoulder (10-16h): 60-70 EUR/MWh
 * - Evening peak (17-20h): 90-105 EUR/MWh
 * - Late night (21-23h): declining to 50 EUR/MWh
 */
export const DEFAULT_DA_PRICES: number[] = [
  45.0, -5.0, -3.0, -2.0, 40.0, 48.0, 62.0, 88.0,
  97.0, 85.0, 68.0, 63.0, 58.0, 55.0, 60.0, 64.0,
  72.0, 92.0, 105.0, 98.0, 90.0, 70.0, 58.0, 50.0,
];

// ── Day-Ahead Bid ─────────────────────────────────────────────────

/**
 * Optimise the 24-hour day-ahead bid for the TGE market.
 * Curtails at negative prices; uses BESS to charge cheap / discharge expensive.
 */
export function runDABid(req: DABidRequest): Promise<DABidResponse> {
  return post(`${BASE}/da-bid`, req);
}

// ── Revenue Simulation ─────────────────────────────────────────────

/**
 * Simulate annual revenue including DA market, CfD top-up (OZMB 2024),
 * ancillary services (FCR-N/FCR-D/aFRR/mFRR), and PSE imbalance cost.
 */
export function runRevenueSimulation(
  params: RevenueSimulationRequest,
): Promise<RevenueSimulationResponse> {
  return post(`${BASE}/revenue`, params);
}

// ── Ancillary Services ─────────────────────────────────────────────

/**
 * Estimate ancillary services revenue portfolio (FCR-N, FCR-D, aFRR, mFRR).
 * PSE BSP contract value typically ~3.5 M EUR/year.
 */
export function runAncillaryServices(
  req: AncillaryServicesRequest,
): Promise<AncillaryServicesResponse> {
  return post(`${BASE}/ancillary`, req);
}
