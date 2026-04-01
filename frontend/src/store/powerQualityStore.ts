/**
 * Power Quality store — M06 (IEC 61000-3-6 / IEC 61000-3-7).
 * Manages harmonics, resonance scan, flicker, and filter design.
 */

import { create } from "zustand";
import * as api from "../services/powerQualityApi";
import type {
  HarmonicAnalysisResponse,
  ResonanceScanResponse,
  FlickerResponse,
  FilterDesignResponse,
  HarmonicLimitsResponse,
  HarmonicSpectrumRequest,
  ResonanceScanRequest,
  FlickerRequest,
  FilterDesignRequest,
} from "../types/powerQuality";

interface PowerQualityState {
  harmonics: HarmonicAnalysisResponse | null;
  resonance: ResonanceScanResponse | null;
  flicker: FlickerResponse | null;
  filterDesign: FilterDesignResponse | null;
  limits: HarmonicLimitsResponse | null;
  // Default input params
  thd_pct: number;         // Approximated from harmonic magnitudes
  rated_mw: number;
  voltage_kv: number;
  grid_fault_mva: number;
  loading: boolean;
  error: string | null;

  runAll(): Promise<void>;
  runHarmonicAnalysis(req: HarmonicSpectrumRequest): Promise<void>;
  runResonanceScan(req: ResonanceScanRequest): Promise<void>;
  computeFlicker(req: FlickerRequest): Promise<void>;
  designFilter(req: FilterDesignRequest): Promise<void>;
  fetchLimits(): Promise<void>;
  setRatedMW(mw: number): void;
  setVoltageKV(kv: number): void;
  setGridFaultMVA(mva: number): void;
  clearError(): void;
}

const DEFAULT_HARMONICS: HarmonicSpectrumRequest = {
  harmonic_magnitudes: { 5: 3.2, 7: 2.1, 11: 1.4, 13: 0.9, 17: 0.6, 19: 0.4, 23: 0.3, 25: 0.2 },
  voltage_kv: 66,
  rated_mw: 510,
};

export const usePowerQualityStore = create<PowerQualityState>((set, get) => ({
  harmonics: null,
  resonance: null,
  flicker: null,
  filterDesign: null,
  limits: null,
  thd_pct: 4.1,
  rated_mw: 510,
  voltage_kv: 66,
  grid_fault_mva: 2500,
  loading: false,
  error: null,

  runAll: async () => {
    set({ loading: true, error: null });
    try {
      const { rated_mw, voltage_kv, grid_fault_mva } = get();
      const [harmonics, resonance, flicker, limits] = await Promise.all([
        api.analyzeHarmonics(DEFAULT_HARMONICS),
        api.runResonanceScan({ cable_length_km: 45, voltage_kv, grid_fault_level_mva: grid_fault_mva, scan_max_hz: 2500 }),
        api.computeFlicker({ rated_mw, grid_fault_level_mva: grid_fault_mva, grid_impedance_angle_deg: 75, annual_switching_operations: 1200 }),
        api.getHarmonicLimits(),
      ]);
      set({ harmonics, resonance, flicker, limits });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Power quality analysis failed" });
    } finally {
      set({ loading: false });
    }
  },

  runHarmonicAnalysis: async (req) => {
    try {
      const harmonics = await api.analyzeHarmonics(req);
      set({ harmonics });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Harmonic analysis failed" });
    }
  },

  runResonanceScan: async (req) => {
    try {
      const resonance = await api.runResonanceScan(req);
      set({ resonance });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Resonance scan failed" });
    }
  },

  computeFlicker: async (req) => {
    try {
      const flicker = await api.computeFlicker(req);
      set({ flicker });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Flicker computation failed" });
    }
  },

  designFilter: async (req) => {
    try {
      const filterDesign = await api.designFilter(req);
      set({ filterDesign });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Filter design failed" });
    }
  },

  fetchLimits: async () => {
    try {
      const limits = await api.getHarmonicLimits();
      set({ limits });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch harmonic limits" });
    }
  },

  setRatedMW: (mw) => set({ rated_mw: mw }),
  setVoltageKV: (kv) => set({ voltage_kv: kv }),
  setGridFaultMVA: (mva) => set({ grid_fault_mva: mva }),
  clearError: () => set({ error: null }),
}));
