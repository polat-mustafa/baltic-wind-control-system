/**
 * Zustand store for P4 AI Forecasting dashboard state.
 *
 * Manages forecast results from all P4 API endpoints,
 * user-selected parameters, and loading/error states.
 *
 * Data flow: user clicks "Run Forecast Analysis" →
 * runFullAnalysis() calls 4 endpoints in parallel → results populate panels.
 */

import { create } from "zustand";

import * as api from "../services/forecastApi";
import type {
  EnsemblePredictResponse,
  ModelCompareResponse,
  RampDetectResponse,
  SHAPResponse,
  TurbineSpec,
} from "../types/forecast";

// ── Store Interface ────────────────────────────────────────────

interface ForecastState {
  // Turbine spec (loaded on mount)
  turbineSpec: TurbineSpec | null;

  // User parameters
  numTurbines: number;
  numTimesteps: number;
  turbineIndex: number;
  horizonSteps: number;
  rampThresholdMwHr: number;
  spotPriceEurMwh: number;

  // Computation results
  ensembleForecast: EnsemblePredictResponse | null;
  shapResult: SHAPResponse | null;
  modelComparison: ModelCompareResponse | null;
  rampDetection: RampDetectResponse | null;

  // UI state
  loading: boolean;
  error: string | null;
  analysisRun: boolean;

  // Parameter setters
  setTurbineIndex: (i: number) => void;
  setHorizonSteps: (h: number) => void;
  setRampThresholdMwHr: (t: number) => void;
  setSpotPriceEurMwh: (p: number) => void;

  // Data actions
  fetchTurbineSpec: () => Promise<void>;
  runFullAnalysis: () => Promise<void>;

  // Utility
  clearError: () => void;
}

// ── Store Implementation ───────────────────────────────────────

export const useForecastStore = create<ForecastState>((set, get) => ({
  // Turbine spec
  turbineSpec: null,

  // Parameters
  numTurbines: 34,
  numTimesteps: 52560,
  turbineIndex: 0,
  horizonSteps: 288,
  rampThresholdMwHr: 50,
  spotPriceEurMwh: 72,

  // Results
  ensembleForecast: null,
  shapResult: null,
  modelComparison: null,
  rampDetection: null,

  // UI
  loading: false,
  error: null,
  analysisRun: false,

  // ── Parameter setters ──────────────────────────────────────

  setTurbineIndex: (i) => set({ turbineIndex: i }),
  setHorizonSteps: (h) => set({ horizonSteps: h }),
  setRampThresholdMwHr: (t) => set({ rampThresholdMwHr: t }),
  // TODO: wire to revenue impact calculation
  setSpotPriceEurMwh: (p) => set({ spotPriceEurMwh: p }),

  // ── Data actions ───────────────────────────────────────────

  fetchTurbineSpec: async () => {
    try {
      const turbineSpec = await api.getTurbineSpec();
      set({ turbineSpec });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  runFullAnalysis: async () => {
    const {
      numTurbines,
      numTimesteps,
      turbineIndex,
      horizonSteps,
      rampThresholdMwHr,
    } = get();

    set({ loading: true, error: null });

    try {
      // Run all analyses in parallel for speed
      const [ensembleForecast, modelComparison, shapResult, rampDetection] =
        await Promise.all([
          api.predictEnsemble(
            numTurbines,
            numTimesteps,
            turbineIndex,
            horizonSteps,
          ),
          api.compareModels(
            numTurbines,
            numTimesteps,
            turbineIndex,
            horizonSteps,
          ),
          api.getXGBoostSHAP(numTurbines, numTimesteps, turbineIndex),
          api.detectRamps(
            numTurbines,
            numTimesteps,
            turbineIndex,
            horizonSteps,
            rampThresholdMwHr,
          ),
        ]);

      set({
        ensembleForecast,
        modelComparison,
        shapResult,
        rampDetection,
        analysisRun: true,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  // ── Utility ────────────────────────────────────────────────

  clearError: () => set({ error: null }),
}));
