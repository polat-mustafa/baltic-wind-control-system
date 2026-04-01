/**
 * Zustand store for M13 Availability Tracking dashboard state.
 *
 * Manages fleet availability response and downtime breakdown from
 * the IEC 61400-26 availability API. Both fetches are independent
 * and can be called separately — dashboard calls both on mount.
 *
 * Data flow: component mounts → fetchFleetAvailability() + fetchBreakdown()
 * → panels populate with TBA/EBA/PBA metrics and waterfall chart.
 */

import { create } from "zustand";

import * as api from "../services/availabilityApi";
import type {
  DowntimeBreakdownResponse,
  FarmAvailabilityResponse,
} from "../types/availability";

// ── Store interface ───────────────────────────────────────────────

interface AvailabilityState {
  fleetData: FarmAvailabilityResponse | null;
  breakdown: DowntimeBreakdownResponse | null;
  loading: boolean;
  error: string | null;
  loaded: boolean;

  fetchFleetAvailability: () => Promise<void>;
  fetchBreakdown: (scope: string) => Promise<void>;
  clearError: () => void;
}

// ── Store implementation ──────────────────────────────────────────

export const useAvailabilityStore = create<AvailabilityState>((set) => ({
  fleetData: null,
  breakdown: null,
  loading: false,
  error: null,
  loaded: false,

  // ── Data actions ──────────────────────────────────────────────

  fetchFleetAvailability: async () => {
    set({ loading: true, error: null });
    try {
      const fleetData = await api.getFleetAvailability();
      set({ fleetData, loaded: true });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  fetchBreakdown: async (scope: string) => {
    set({ loading: true, error: null });
    try {
      const breakdown = await api.getDowntimeBreakdown(scope);
      set({ breakdown });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  // ── Utility ───────────────────────────────────────────────────

  clearError: () => set({ error: null }),
}));
