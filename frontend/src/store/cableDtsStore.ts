/**
 * Cable DTS store — M10.
 * Manages distributed temperature sensing profile, hotspots, and dynamic rating.
 * IEC 60287 thermal model, 45 km export cable, J-tube zone factor = 1.4.
 */

import { create } from "zustand";
import * as api from "../services/cableDtsApi";
import type {
  DTSProfileResponse,
  HotspotResponse,
  DynamicRatingResponse,
} from "../types/cableDts";

interface CableDTSState {
  profile: DTSProfileResponse | null;
  hotspots: HotspotResponse | null;
  dynamicRating: DynamicRatingResponse | null;
  // Controls
  currentA: number;
  ambientTempC: number;
  loading: boolean;
  error: string | null;

  runAll(): Promise<void>;
  fetchProfile(): Promise<void>;
  fetchHotspots(): Promise<void>;
  fetchDynamicRating(): Promise<void>;
  setCurrentA(a: number): void;
  setAmbientTempC(c: number): void;
  clearError(): void;
}

export const useCableDTSStore = create<CableDTSState>((set, get) => ({
  profile: null,
  hotspots: null,
  dynamicRating: null,
  currentA: 600,
  ambientTempC: 15,
  loading: false,
  error: null,

  runAll: async () => {
    const { currentA, ambientTempC } = get();
    set({ loading: true, error: null });
    try {
      const [profile, hotspots, dynamicRating] = await Promise.all([
        api.getDTSProfile(currentA, ambientTempC),
        api.getHotspots(currentA, ambientTempC),
        api.getDynamicRating(currentA, ambientTempC),
      ]);
      set({ profile, hotspots, dynamicRating });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Cable DTS fetch failed" });
    } finally {
      set({ loading: false });
    }
  },

  fetchProfile: async () => {
    const { currentA, ambientTempC } = get();
    try {
      const profile = await api.getDTSProfile(currentA, ambientTempC);
      set({ profile });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "DTS profile fetch failed" });
    }
  },

  fetchHotspots: async () => {
    const { currentA, ambientTempC } = get();
    try {
      const hotspots = await api.getHotspots(currentA, ambientTempC);
      set({ hotspots });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Hotspot fetch failed" });
    }
  },

  fetchDynamicRating: async () => {
    const { currentA, ambientTempC } = get();
    try {
      const dynamicRating = await api.getDynamicRating(currentA, ambientTempC);
      set({ dynamicRating });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Dynamic rating fetch failed" });
    }
  },

  setCurrentA: (a) => set({ currentA: a }),
  setAmbientTempC: (c) => set({ ambientTempC: c }),
  clearError: () => set({ error: null }),
}));
