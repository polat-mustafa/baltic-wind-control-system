/**
 * Zustand store for M04 Multi-Farm Comparison.
 *
 * Holds 2–4 editable farm configurations and the last comparison result.
 * Pre-loaded with three design alternatives for the Baltic site so the
 * user can compare immediately. Editing any input marks results stale.
 */

import { create } from "zustand";

import * as api from "../services/farmComparisonApi";
import type { FarmComparisonResponse, FarmConfig } from "../types/farmComparison";

export const MAX_FARMS = 4;

/** One colour per farm slot — config cards and every results chart. */
export const FARM_COLORS = ["#60a5fa", "#3ecf6e", "#f5a623", "#c084fc"];

/** Shared economics / site defaults (2024–25 European offshore ranges). */
const BASE: Omit<FarmConfig, "name"> = {
  turbine_count: 34,
  turbine_rated_mw: 15.0,
  mean_wind_speed_ms: 9.3, // Weibull A 10.5, k 2.2 — same site as the AEP tab
  weibull_k: 2.2,
  turbine_spacing_d: 7,
  array_voltage_kv: 66,
  export_voltage_kv: 220,
  export_length_km: 76.5,
  availability_pct: 95,
  // NREL Cost of Wind Energy Review 2024, fixed-bottom reference (2023 USD → € at 1.0813 $/€)
  capex_m_eur_per_mw: 5.0,
  opex_k_eur_per_mw_year: 125,
  discount_rate_pct: 6,
  lifetime_years: 25,
};

export const DEFAULT_FARMS: FarmConfig[] = [
  { ...BASE, name: "SB-510 · 7D" },
  {
    ...BASE,
    name: "Compact 6D layout",
    turbine_spacing_d: 6,
    export_length_km: 38,
    capex_m_eur_per_mw: 4.9,
  },
  {
    ...BASE,
    name: "Far-shore, 9D spacing",
    mean_wind_speed_ms: 9.8,
    turbine_spacing_d: 9,
    export_length_km: 110,
    capex_m_eur_per_mw: 5.4,
  },
];

export const NEW_FARM: FarmConfig = { ...BASE, name: "New design" };

interface FarmComparisonState {
  farms: FarmConfig[];
  priceEurMwh: number;
  results: FarmComparisonResponse | null;
  /** Inputs changed since the last comparison. */
  stale: boolean;
  loading: boolean;
  error: string | null;

  runComparison: () => Promise<void>;
  addFarm: (config: FarmConfig) => void;
  removeFarm: (index: number) => void;
  updateFarm: (index: number, partial: Partial<FarmConfig>) => void;
  setPrice: (price: number) => void;
  clearError: () => void;
}

export const useFarmComparisonStore = create<FarmComparisonState>((set, get) => ({
  farms: DEFAULT_FARMS,
  priceEurMwh: 72,
  results: null,
  stale: false,
  loading: false,
  error: null,

  runComparison: async () => {
    const { farms, priceEurMwh } = get();
    set({ loading: true, error: null });
    try {
      const results = await api.compareFarms(farms, priceEurMwh);
      set({ results, stale: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  addFarm: (config) =>
    set((s) => (s.farms.length >= MAX_FARMS ? s : { farms: [...s.farms, config], stale: true })),

  removeFarm: (index) =>
    set((s) => ({ farms: s.farms.filter((_, i) => i !== index), stale: true })),

  updateFarm: (index, partial) =>
    set((s) => ({
      farms: s.farms.map((f, i) => (i === index ? { ...f, ...partial } : f)),
      stale: true,
    })),

  setPrice: (priceEurMwh) => set({ priceEurMwh, stale: true }),

  clearError: () => set({ error: null }),
}));
