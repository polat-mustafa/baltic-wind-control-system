/**
 * Market day API types — mirror backend/app/schemas/market.py.
 * Money in PLN, energy in MWh per 1 h period.
 */

export type MarketScenario = "windy_spring_sunday" | "winter_weekday" | "calm_summer_day" | "real_day";

export interface MarketDayRequest {
  scenario: MarketScenario;
  strike_pln_mwh: number;
  forecast_sigma_ms: number;
  include_cfd: boolean;
  include_bess: boolean;
  /** real_day: YYYY-MM-DD (Polish time); default today. */
  date?: string;
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

/** One quarter-hour of the Polish system (PSE his-wlk-cal + rce-pln); null = not published yet. */
export interface PseQuarter {
  /** End of the quarter-hour, Polish time. */
  time: string;
  period: string;
  wind_mw: number | null;
  pv_mw: number | null;
  demand_mw: number | null;
  price_pln_mwh: number | null;
}

export interface PseDay {
  date: string;
  quarters: PseQuarter[];
  summary: {
    quarters_filled: number;
    last_filled: string | null;
    wind_mwh: number;
    pv_mwh: number;
    demand_mwh: number;
    wind_share_pct: number | null;
    pv_share_pct: number | null;
    wind_peak_mw: number | null;
    avg_price_pln_mwh: number | null;
    wind_capture_price_pln_mwh: number | null;
    wind_capture_rate_pct: number | null;
    negative_price_quarters: number;
  };
  source: string;
}
