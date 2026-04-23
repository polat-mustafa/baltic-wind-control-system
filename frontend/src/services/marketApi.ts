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

// ── Imbalance Settlement ──────────────────────────────────────────

export interface ImbalanceRequest {
  forecast_mwh: number[];      // length 24
  actual_mwh: number[];        // length 24
  da_price_eur_mwh: number[];  // length 24
  imbalance_penalty_factor?: number;  // default 1.15
}

export interface ImbalanceHourResult {
  hour: number;
  forecast_mwh: number;
  actual_mwh: number;
  delta_mwh: number;
  da_price_eur_mwh: number;
  da_revenue_eur: number;
  imbalance_cost_eur: number;
  direction: "long" | "short" | "balanced";
}

export interface ImbalanceResponse {
  hourly_results: ImbalanceHourResult[];
  total_da_revenue_eur: number;
  total_imbalance_cost_eur: number;
  net_revenue_eur: number;
  mae_mwh: number;
  mape_pct: number;
  long_hours: number;
  short_hours: number;
  assessment: string;
}

/**
 * Settle a 24-h imbalance: penalises forecast error against the DA bid using
 * PSE's ±factor (default 1.15). Output includes hourly direction (long/short),
 * MAE/MAPE, and a qualitative assessment string.
 */
export function runImbalanceSettlement(req: ImbalanceRequest): Promise<ImbalanceResponse> {
  return post(`${BASE}/imbalance`, req);
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
