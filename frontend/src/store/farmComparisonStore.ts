/**
 * Zustand store for M04 Multi-Farm Comparison dashboard state.
 *
 * Manages the list of farm configurations and comparison results.
 * Initialised with 3 default configurations (Baltic Wind Alpha/Beta/Gamma)
 * so the user can run a comparison immediately on first visit.
 *
 * Data flow: user edits FarmConfigCards → runComparison() → POST to API
 * → FarmComparisonPanel shows AEP/LCOE grouped bar chart.
 */

import { create } from "zustand";

import * as api from "../services/farmComparisonApi";
import type {
  FarmComparisonResponse,
  FarmConfig,
} from "../types/farmComparison";

// ── Default farm configurations ───────────────────────────────────

const DEFAULT_FARMS: FarmConfig[] = [
  {
    name: "Baltic Wind Alpha",
    n_turbines: 34,
    turbine_rated_mw: 15.0,
    weibull_a: 9.8,
    weibull_k: 2.1,
    array_voltage_kv: 66,
    export_length_km: 45,
  },
  {
    name: "Baltic Wind Beta",
    n_turbines: 25,
    turbine_rated_mw: 15.0,
    weibull_a: 10.5,
    weibull_k: 2.3,
    array_voltage_kv: 66,
    export_length_km: 38,
  },
  {
    name: "Baltic Wind Gamma",
    n_turbines: 40,
    turbine_rated_mw: 12.0,
    weibull_a: 9.2,
    weibull_k: 2.0,
    array_voltage_kv: 66,
    export_length_km: 52,
  },
];

// ── Store interface ───────────────────────────────────────────────

interface FarmComparisonState {
  results: FarmComparisonResponse | null;
  farms: FarmConfig[];
  loading: boolean;
  error: string | null;

  runComparison: () => Promise<void>;
  addFarm: (config: FarmConfig) => void;
  removeFarm: (index: number) => void;
  updateFarm: (index: number, partial: Partial<FarmConfig>) => void;
  clearError: () => void;
}

// ── Store implementation ──────────────────────────────────────────

export const useFarmComparisonStore = create<FarmComparisonState>((set, get) => ({
  results: null,
  farms: DEFAULT_FARMS,
  loading: false,
  error: null,

  // ── Data actions ──────────────────────────────────────────────

  runComparison: async () => {
    const { farms } = get();
    set({ loading: true, error: null });
    try {
      const results = await api.compareFarms(farms);
      set({ results });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  // ── Farm list management ──────────────────────────────────────

  addFarm: (config: FarmConfig) =>
    set((state) => ({ farms: [...state.farms, config] })),

  removeFarm: (index: number) =>
    set((state) => ({
      farms: state.farms.filter((_, i) => i !== index),
    })),

  updateFarm: (index: number, partial: Partial<FarmConfig>) =>
    set((state) => ({
      farms: state.farms.map((f, i) =>
        i === index ? { ...f, ...partial } : f,
      ),
    })),

  // ── Utility ───────────────────────────────────────────────────

  clearError: () => set({ error: null }),
}));
