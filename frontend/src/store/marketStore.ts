/**
 * Market Integration store — M11 (TGE/PSE Polish Power Exchange).
 * Manages day-ahead bidding, imbalance settlement, ancillary services, revenue.
 */

import { create } from "zustand";
import * as api from "../services/marketApi";
import type {
  DABidResponse,
  RevenueSimulationResponse,
  AncillaryServicesResponse,
  DABidRequest,
  RevenueSimulationRequest,
  AncillaryServicesRequest,
} from "../types/market";

// Default 24-hour DA price profile (EUR/MWh)
const DEFAULT_DA_PRICES = [
  38, 35, 32, 30, 32, 42, 65, 80, 85, 75, 68, 62,
  60, 58, 62, 70, 78, 95, 105, 98, 85, 72, 58, 45,
];

interface MarketState {
  daBidResult: DABidResponse | null;
  revenueResult: RevenueSimulationResponse | null;
  ancillaryResult: AncillaryServicesResponse | null;
  // DA bid params
  includeBessArbitrage: boolean;
  bessInitialSoc: number;
  avgDaPriceEurMwh: number;
  priceVolatilityPct: number;
  cfdStrikePriceEurMwh: number;
  // Revenue sim params
  annualAepMwh: number;
  oAndMCostMEurYear: number;
  loading: boolean;
  error: string | null;

  runAll(): Promise<void>;
  runDABid(windForecastMwh?: number[]): Promise<void>;
  runRevenueSim(): Promise<void>;
  runAncillary(): Promise<void>;
  setIncludeBessArbitrage(val: boolean): void;
  setBessInitialSoc(v: number): void;
  setAvgDaPrice(v: number): void;
  setCfdStrikePrice(v: number): void;
  clearError(): void;
}

// Default wind forecast: 24h profile based on Weibull (GWh scale)
const DEFAULT_WIND_FORECAST_MWH = [
  340, 325, 315, 305, 320, 345, 375, 395, 410, 405, 395, 380,
  370, 360, 355, 365, 380, 400, 415, 420, 410, 395, 375, 355,
];

export const useMarketStore = create<MarketState>((set, get) => ({
  daBidResult: null,
  revenueResult: null,
  ancillaryResult: null,
  includeBessArbitrage: true,
  bessInitialSoc: 50,
  avgDaPriceEurMwh: 68,
  priceVolatilityPct: 25,
  cfdStrikePriceEurMwh: 80,
  annualAepMwh: 1_850_000,
  oAndMCostMEurYear: 24,
  loading: false,
  error: null,

  runAll: async () => {
    set({ loading: true, error: null });
    try {
      const daBidReq: DABidRequest = {
        wind_forecast_mwh: DEFAULT_WIND_FORECAST_MWH,
        da_price_eur_mwh: DEFAULT_DA_PRICES,
        include_bess_arbitrage: get().includeBessArbitrage,
        bess_soc_initial_pct: get().bessInitialSoc,
      };
      const revReq: RevenueSimulationRequest = {
        annual_aep_mwh: get().annualAepMwh,
        avg_da_price_eur_mwh: get().avgDaPriceEurMwh,
        price_volatility_pct: get().priceVolatilityPct,
        capacity_factor_pct: 42,
        cfd_strike_price_eur_mwh: get().cfdStrikePriceEurMwh,
        o_and_m_cost_m_eur_year: get().oAndMCostMEurYear,
      };
      const ancReq: AncillaryServicesRequest = {
        bess_power_mw: 50,
        wtg_available_mw: 510,
        reserve_soc_pct: 20,
      };
      const [daBidResult, revenueResult, ancillaryResult] = await Promise.all([
        api.runDABid(daBidReq),
        api.runRevenueSimulation(revReq),
        api.runAncillaryServices(ancReq),
      ]);
      set({ daBidResult, revenueResult, ancillaryResult });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Market analysis failed" });
    } finally {
      set({ loading: false });
    }
  },

  runDABid: async (windForecastMwh) => {
    set({ loading: true, error: null });
    try {
      const req: DABidRequest = {
        wind_forecast_mwh: windForecastMwh ?? DEFAULT_WIND_FORECAST_MWH,
        da_price_eur_mwh: DEFAULT_DA_PRICES,
        include_bess_arbitrage: get().includeBessArbitrage,
        bess_soc_initial_pct: get().bessInitialSoc,
      };
      const daBidResult = await api.runDABid(req);
      set({ daBidResult });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "DA bid failed" });
    } finally {
      set({ loading: false });
    }
  },

  runRevenueSim: async () => {
    set({ loading: true, error: null });
    try {
      const req: RevenueSimulationRequest = {
        annual_aep_mwh: get().annualAepMwh,
        avg_da_price_eur_mwh: get().avgDaPriceEurMwh,
        price_volatility_pct: get().priceVolatilityPct,
        capacity_factor_pct: 42,
        cfd_strike_price_eur_mwh: get().cfdStrikePriceEurMwh,
        o_and_m_cost_m_eur_year: get().oAndMCostMEurYear,
      };
      const revenueResult = await api.runRevenueSimulation(req);
      set({ revenueResult });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Revenue simulation failed" });
    } finally {
      set({ loading: false });
    }
  },

  runAncillary: async () => {
    try {
      const ancillaryResult = await api.runAncillaryServices({
        bess_power_mw: 50,
        wtg_available_mw: 510,
        reserve_soc_pct: 20,
      });
      set({ ancillaryResult });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Ancillary services failed" });
    }
  },

  setIncludeBessArbitrage: (val) => set({ includeBessArbitrage: val }),
  setBessInitialSoc: (v) => set({ bessInitialSoc: v }),
  setAvgDaPrice: (v) => set({ avgDaPriceEurMwh: v }),
  setCfdStrikePrice: (v) => set({ cfdStrikePriceEurMwh: v }),
  clearError: () => set({ error: null }),
}));
