/**
 * Market store — one trading day. Default strike 489 PLN/MWh, the middle of
 * the Phase II CfD auction (17 Dec 2025: 476.88–492.32 PLN/MWh).
 */

import { create } from "zustand";

import { simMarketDay } from "../services/marketApi";
import type { MarketDayRequest, MarketDayResponse } from "../types/market";

interface MarketState extends MarketDayRequest {
  day: MarketDayResponse | null;
  error: string | null;
  setParams(p: Partial<MarketDayRequest>): void;
  run(): Promise<void>;
  clearError(): void;
}

export const useMarketStore = create<MarketState>((set, get) => ({
  scenario: "windy_spring_sunday",
  strike_pln_mwh: 489,
  forecast_sigma_ms: 1.0,
  include_cfd: true,
  include_bess: true,
  date: undefined,
  day: null,
  error: null,
  setParams: (p) => set(p),
  run: async () => {
    const { scenario, strike_pln_mwh, forecast_sigma_ms, include_cfd, include_bess, date } = get();
    try {
      const body = { scenario, strike_pln_mwh, forecast_sigma_ms, include_cfd, include_bess, ...(scenario === "real_day" && date ? { date } : {}) };
      set({ day: await simMarketDay(body), error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },
  clearError: () => set({ error: null }),
}));
