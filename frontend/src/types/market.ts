/**
 * TypeScript interfaces for Market Integration (TGE/PSE) API responses.
 *
 * All field names use snake_case to match the API JSON directly.
 * Source of truth: backend/app/schemas/market.py Pydantic schemas.
 */

// ── Day-Ahead Bid ─────────────────────────────────────────────────

export interface DAPricePoint {
  hour: number;
  price_eur_mwh: number;
  volume_mwh: number;
  revenue_eur: number;
}

export interface DABidRequest {
  wind_forecast_mwh: number[];
  da_price_eur_mwh: number[];
  include_bess_arbitrage: boolean;
  bess_soc_initial_pct: number;
}

export interface DABidResponse {
  hourly_schedule: DAPricePoint[];
  total_revenue_eur: number;
  total_energy_mwh: number;
  weighted_avg_price_eur_mwh: number;
  bess_arbitrage_revenue_eur: number;
  curtailment_hours: number;
  curtailment_loss_eur: number;
  optimal_curtailment_mwh: number;
  assessment: string;
}

// ── Revenue Simulation ─────────────────────────────────────────────

/** @deprecated Use RevenueSimulationRequest instead */
export interface RevenueSimRequest {
  annual_energy_mwh: number;
  da_price_eur_mwh: number;
  cfd_strike_eur_mwh: number;
  bess_capacity_mwh: number;
  mape_pct: number;
  ancillary_capacity_mw: number;
}

export interface RevenueSimulationRequest {
  annual_aep_mwh: number;
  avg_da_price_eur_mwh: number;
  price_volatility_pct: number;
  capacity_factor_pct: number;
  cfd_strike_price_eur_mwh: number;
  o_and_m_cost_m_eur_year: number;
}

export interface RevenueBreakdownItem {
  category: string;
  revenue_m_eur: number;
  share_pct: number;
}

export interface RevenueSimulationResponse {
  gross_revenue_m_eur: number;
  cfd_support_m_eur: number;
  ancillary_revenue_m_eur: number;
  imbalance_cost_m_eur: number;
  bess_arbitrage_m_eur: number;
  total_revenue_m_eur: number;
  ebitda_m_eur: number;
  revenue_per_mwh_eur: number;
  breakdown: RevenueBreakdownItem[];
  lcoe_comparison: string;
  assessment: string;
}

// ── Ancillary Services ────────────────────────────────────────────

export interface AncillaryServicesRequest {
  bess_power_mw: number;
  wtg_available_mw: number;
  reserve_soc_pct: number;
}

export interface AncillaryServiceBid {
  service: string;
  capacity_mw: number;
  availability_price_eur_mw_h: number;
  activation_price_eur_mwh: number;
  annual_revenue_eur: number;
}

export interface AncillaryServicesResponse {
  services: AncillaryServiceBid[];
  total_annual_revenue_eur: number;
  fcr_capacity_mw: number;
  afrr_capacity_mw: number;
  mfrr_capacity_mw: number;
  bsp_contract_value_m_eur_year: number;
  assessment: string;
}
