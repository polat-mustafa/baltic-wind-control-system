/**
 * Market day API types — mirror backend/app/schemas/market.py.
 * Money in PLN, energy in MWh per 1 h period.
 */

export type MarketScenario = "windy_spring_sunday" | "winter_weekday" | "calm_summer_day";

export interface MarketDayRequest {
  scenario: MarketScenario;
  strike_pln_mwh: number;
  forecast_sigma_ms: number;
  include_cfd: boolean;
  include_bess: boolean;
}

export interface MarketHour {
  hour: number;
  da_price_pln_mwh: number;
  cen_pln_mwh: number;
  wind_forecast_ms: number;
  wind_actual_ms: number;
  forecast_mwh: number;
  bid_mwh: number;
  metered_mwh: number;
  curtailed_mwh: number;
  deviation_mwh: number;
  /** + discharge, − charge [MW]. */
  bess_mw: number;
  bess_soc_pct: number | null;
}

export interface MarketDayResponse {
  scenario: MarketScenario;
  scenario_label: string;
  hours: MarketHour[];
  energy_mwh: number;
  curtailed_mwh: number;
  negative_hours: number;
  rmse_mwh: number;
  day_average_price_pln_mwh: number;
  captured_price_pln_mwh: number;
  capture_rate_pct: number;
  farm_price_pln_mwh: number;
  energy_value_pln: number;
  imbalance_pln: number;
  cfd_settlement_pln: number;
  bess_arbitrage_pln: number;
  total_pln: number;
  assessment: string;
}
