/**
 * BESS Integration store — M08.
 * Manages BESS status, frequency response, ramp smoothing, and degradation.
 * Spec: 50 MW / 200 MWh LFP, C-rate 0.25, SOC 10-90%.
 */

import { create } from "zustand";
import * as api from "../services/bessApi";
import type {
  BESSStatusResponse,
  FrequencyResponseResult,
  RampSmoothingResult,
  DegradationResponse,
  FrequencyResponseRequest,
  RampSmoothingRequest,
  DegradationRequest,
} from "../types/bess";

interface BESSState {
  status: BESSStatusResponse | null;
  freqResponse: FrequencyResponseResult | null;
  rampResult: RampSmoothingResult | null;
  degradation: DegradationResponse | null;
  // Simulation params
  fcrDroop: number;
  ffrThresholdHz: number;
  initialSocPct: number;
  maxRampRateMwPerMin: number;
  degradationYears: number;
  annualCycles: number;
  avgDodPct: number;
  loading: boolean;
  simLoading: boolean;
  error: string | null;

  fetchStatus(): Promise<void>;
  simFrequencyResponse(): Promise<void>;
  simRampSmoothing(): Promise<void>;
  calcDegradation(): Promise<void>;
  setFcrDroop(v: number): void;
  setFfrThresholdHz(v: number): void;
  setInitialSocPct(v: number): void;
  setMaxRampRate(v: number): void;
  setDegradationYears(v: number): void;
  clearError(): void;
}

// Realistic frequency excursion trace (Nordic system event, 60 s)
const FREQ_TRACE_HZ = Array.from({ length: 60 }, (_, i) => {
  if (i < 5) return 50.0;
  if (i < 10) return 50.0 - (i - 5) * 0.05;
  if (i < 20) return 49.65 + (i - 10) * 0.015;
  return 49.8 + (i - 20) * 0.005;
});

// Ramp-heavy wind power trace (MW over 30 min at 1 min intervals)
const WIND_TRACE_MW = [280, 295, 320, 350, 390, 420, 410, 385, 360, 330, 310, 290,
  275, 260, 245, 260, 280, 300, 320, 340, 360, 375, 390, 400, 410, 415, 405, 395, 380, 365];

export const useBESSStore = create<BESSState>((set, get) => ({
  status: null,
  freqResponse: null,
  rampResult: null,
  degradation: null,
  fcrDroop: 5,
  ffrThresholdHz: 49.7,
  initialSocPct: 60,
  maxRampRateMwPerMin: 25,
  degradationYears: 20,
  annualCycles: 365,
  avgDodPct: 80,
  loading: false,
  simLoading: false,
  error: null,

  fetchStatus: async () => {
    set({ loading: true, error: null });
    try {
      const status = await api.getBESSStatus();
      set({ status });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch BESS status" });
    } finally {
      set({ loading: false });
    }
  },

  simFrequencyResponse: async () => {
    const { fcrDroop, ffrThresholdHz, initialSocPct } = get();
    set({ simLoading: true, error: null });
    try {
      const req: FrequencyResponseRequest = {
        frequency_trace_hz: FREQ_TRACE_HZ,
        fcr_droop_pct: fcrDroop,
        ffr_threshold_hz: ffrThresholdHz,
        initial_soc_pct: initialSocPct,
      };
      const freqResponse = await api.simFrequencyResponse(req);
      set({ freqResponse });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Frequency response simulation failed" });
    } finally {
      set({ simLoading: false });
    }
  },

  simRampSmoothing: async () => {
    const { maxRampRateMwPerMin, initialSocPct } = get();
    set({ simLoading: true, error: null });
    try {
      const req: RampSmoothingRequest = {
        wind_power_trace_mw: WIND_TRACE_MW,
        max_ramp_rate_mw_per_min: maxRampRateMwPerMin,
        initial_soc_pct: initialSocPct,
      };
      const rampResult = await api.simRampSmoothing(req);
      set({ rampResult });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Ramp smoothing simulation failed" });
    } finally {
      set({ simLoading: false });
    }
  },

  calcDegradation: async () => {
    const { degradationYears, annualCycles, avgDodPct } = get();
    set({ simLoading: true, error: null });
    try {
      const req: DegradationRequest = {
        years: degradationYears,
        annual_cycles: annualCycles,
        avg_dod_pct: avgDodPct,
      };
      const degradation = await api.calcDegradation(req);
      set({ degradation });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Degradation calculation failed" });
    } finally {
      set({ simLoading: false });
    }
  },

  setFcrDroop: (v) => set({ fcrDroop: v }),
  setFfrThresholdHz: (v) => set({ ffrThresholdHz: v }),
  setInitialSocPct: (v) => set({ initialSocPct: v }),
  setMaxRampRate: (v) => set({ maxRampRateMwPerMin: v }),
  setDegradationYears: (v) => set({ degradationYears: v }),
  clearError: () => set({ error: null }),
}));
