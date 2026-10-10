/**
 * Typed fetch wrapper for the P4 forecasting API (backend/app/routers/p4/real_data.py):
 * the day-ahead forecast trained and scored on real Baltic offshore production.
 */

import { request } from "./apiClient";

const BASE = "/api/v1/forecast";

export interface RealModelScore {
  name: string;
  nrmse_pct: number;
  nmae_pct: number;
  bias_pct: number;
  skill_vs_persistence: number;
  skill_vs_climatology: number;
  /** CRPS ≈ (2/9)·Σ pinball over P10…P90 [% of capacity]; equals nMAE for a point forecast. */
  crps_pct: number;
  crpss_vs_climatology: number;
  probabilistic: boolean;
  fold_nrmse_pct: number[];
}

export interface RealReliability {
  name: string;
  /** Share of hours at or below each quantile P10 … P90 (ideal 0.1 … 0.9). */
  observed_below: number[];
  p10_p90_coverage_pct: number;
}

export interface RealForecastResponse {
  source: {
    site: string;
    title: string;
    production: string;
    nwp: string;
    farms: string[];
    capacity_mw: number;
    period_start_utc: string;
    period_end_utc: string;
    hours: number;
    folds: number;
    scored_hours: number;
  };
  scores: RealModelScore[];
  reliability: RealReliability[];
  p10_p90_coverage_pct: number;
  feature_importance: { feature: string; shap_share: number }[];
  series: {
    time_utc: string[];
    actual_mw: (number | null)[];
    p10_mw: (number | null)[];
    p50_mw: (number | null)[];
    p90_mw: (number | null)[];
    persistence_mw: (number | null)[];
    nwp_wind_ms: (number | null)[];
    /** DK2 only: Energinet's day-ahead forecast, rescaled to the three farms. */
    tso_mw?: (number | null)[];
    /** When the LSTM / TFT forecasts are bundled: the 1/MSE-weighted ensemble. */
    ensemble_mw?: (number | null)[];
  };
}

/** XGBoost P10…P90, LSTM, TFT, ensemble and baselines on measured output + archived NWP. */
export function getRealDayAhead(site = "dk2"): Promise<RealForecastResponse> {
  return request(`${BASE}/real-data/day-ahead?site=${encodeURIComponent(site)}`);
}

export interface RealSite {
  key: string;
  title: string;
  capacity_mw: number;
}

/** Real production series available: DK2 aggregate + single farms (ENTSO-E 16.1.A). */
export function getRealSites(): Promise<RealSite[]> {
  return request(`${BASE}/real-data/sites`);
}
