/**
 * Zustand store for M14 Weather Window & O&M Logistics dashboard state.
 *
 * Manages vessel access probability data and O&M cost breakdown.
 * Both API calls are fetched in parallel via fetchAll() for speed.
 *
 * Data flow: dashboard mounts → fetchAll() → WeatherWindowPanel +
 * OAMCostPanel populate with monthly access charts and cost breakdown.
 */

import { create } from "zustand";

import * as api from "../services/weatherWindowApi";
import type {
  AllVesselAccessResponse,
  OAMCostBreakdown,
} from "../types/weatherWindow";

// ── Store interface ───────────────────────────────────────────────

interface WeatherWindowState {
  vesselAccess: AllVesselAccessResponse | null;
  oamCost: OAMCostBreakdown | null;
  loading: boolean;
  error: string | null;

  fetchAll: () => Promise<void>;
  clearError: () => void;
}

// ── Store implementation ──────────────────────────────────────────

export const useWeatherWindowStore = create<WeatherWindowState>((set) => ({
  vesselAccess: null,
  oamCost: null,
  loading: false,
  error: null,

  // ── Data actions ──────────────────────────────────────────────

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      // Fetch both in parallel — independent requests
      const [vesselAccess, oamCost] = await Promise.all([
        api.getAllVesselAccess(),
        api.getOAMCost(),
      ]);
      set({ vesselAccess, oamCost });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  // ── Utility ───────────────────────────────────────────────────

  clearError: () => set({ error: null }),
}));
