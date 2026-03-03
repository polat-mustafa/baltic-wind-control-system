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
  progress: number; // 0-100
  progressMessage: string;

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
  numTimesteps: 8760,
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
  progress: 0,
  progressMessage: "",

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

    set({ loading: true, error: null, progress: 0, progressMessage: "" });

    try {
      // Step 1: Ensemble first — this builds+caches all 3 models on backend.
      // Subsequent calls will hit the cache and return fast.
      set({ progress: 5, progressMessage: "Training XGBoost + LSTM + TFT models..." });
      const ensembleForecast = await api.predictEnsemble(
        numTurbines,
        numTimesteps,
        turbineIndex,
        horizonSteps,
      );
      set({ ensembleForecast, progress: 50, progressMessage: "Models cached. Running analysis..." });

      // Step 2: Remaining 3 endpoints run in parallel — all hit cached forecasts
      const [modelComparison, shapResult, rampDetection] = await Promise.all([
        api.compareModels(numTurbines, numTimesteps, turbineIndex, horizonSteps),
        api.getXGBoostSHAP(numTurbines, numTimesteps, turbineIndex),
        api.detectRamps(numTurbines, numTimesteps, turbineIndex, horizonSteps, rampThresholdMwHr),
      ]);

      set({
        modelComparison,
        shapResult,
        rampDetection,
        analysisRun: true,
        progress: 100,
        progressMessage: "Analysis complete",
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
