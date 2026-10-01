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
  TrainingLive,
  TurbineSpec,
} from "../types/forecast";

export type ForecastTab = "forecast" | "monitor" | "academy" | "map";

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
  /** Live training monitor snapshot (stages, losses, log, ETA). */
  live: TrainingLive | null;
  tab: ForecastTab;
  /** Academy chapter to open (set by the concept map). */
  chapter: string;
  setTab: (t: ForecastTab) => void;
  openChapter: (id: string) => void;
  fetchTrainingProgress: () => Promise<void>;

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
  live: null,
  tab: "forecast",
  chapter: "why",
  setTab: (tab) => set({ tab }),
  openChapter: (chapter) => set({ chapter, tab: "academy" }),
  fetchTrainingProgress: async () => {
    try {
      set({ live: await api.getTrainingProgress() });
    } catch {
      /* backend not reachable — the monitor shows its empty state */
    }
  },

  // ── Parameter setters ──────────────────────────────────────

  setTurbineIndex: (i) => set({ turbineIndex: i }),
  setHorizonSteps: (h) => set({ horizonSteps: h }),
  setRampThresholdMwHr: (t) => set({ rampThresholdMwHr: t }),
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

    set({ loading: true, error: null, progress: 0, progressMessage: "Queued — checking the model cache", tab: "monitor" });

    try {
      // Step 1: Ensemble first — builds and caches all 3 models on the
      // backend (tens of minutes the first time, seconds once cached). The
      // trainers stream real progress: stage, fold, epoch, losses, ETA.
      const ensembleForecast = await api.predictEnsemble(
        numTurbines,
        numTimesteps,
        turbineIndex,
        horizonSteps,
        undefined,
        (progress, live) => {
          const running = live?.stages.find((st) => st.status === "running");
          set({
            progress: Math.min(progress, 90),
            live: live ?? get().live,
            progressMessage: live?.active
              ? `${running?.label ?? "Training"}${running?.detail ? ` — ${running.detail}` : ""}`
              : "Loading trained models from the cache",
          });
        },
      );
      set({ ensembleForecast, progress: 92, progressMessage: "Comparing models, SHAP explanations, ramp detection" });

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
        tab: "forecast",
      });
      void get().fetchTrainingProgress();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  // ── Utility ────────────────────────────────────────────────

  clearError: () => set({ error: null }),
}));
