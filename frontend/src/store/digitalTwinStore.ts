/**
 * Zustand store for Digital Twin dashboard state.
 *
 * Manages scenario selection, analysis results, selected turbine,
 * and loading/error state.
 *
 * Selector discipline: only destructure primitives to avoid React #185
 * infinite re-render loops (filter/map return new array refs every call).
 */

import { create } from "zustand";

import * as api from "../services/digitalTwinApi";
import type {
  AnalyzeResponse,
  DigitalTwinConfig,
  ScenarioInfo,
} from "../services/digitalTwinApi";

// ── Types ────────────────────────────────────────────────────────

interface DigitalTwinState {
  // Data from API
  config: DigitalTwinConfig | null;
  scenarios: ScenarioInfo[] | null;
  analysis: AnalyzeResponse | null;

  // User selections
  selectedScenario: string;
  selectedTurbineId: number | null;
  numTimesteps: number;
  numTurbines: number;

  // UI state
  loading: boolean;
  error: string | null;
  analysisRun: boolean;
  progress: number;
  progressMessage: string;

  // Actions
  setSelectedScenario: (s: string) => void;
  setSelectedTurbineId: (id: number | null) => void;
  setNumTimesteps: (n: number) => void;
  setNumTurbines: (n: number) => void;
  fetchConfig: () => Promise<void>;
  fetchScenarios: () => Promise<void>;
  runAnalysis: () => Promise<void>;
  clearError: () => void;
}

// ── Store Implementation ─────────────────────────────────────────

export const useDigitalTwinStore = create<DigitalTwinState>((set, get) => ({
  // Data
  config: null,
  scenarios: null,
  analysis: null,

  // User selections
  selectedScenario: "healthy",
  selectedTurbineId: null,
  numTimesteps: 144,
  numTurbines: 34,

  // UI
  loading: false,
  error: null,
  analysisRun: false,
  progress: 0,
  progressMessage: "",

  // ── Setters ─────────────────────────────────────────────────

  setSelectedScenario: (s) => set({ selectedScenario: s }),
  setSelectedTurbineId: (id) => set({ selectedTurbineId: id }),
  setNumTimesteps: (n) => set({ numTimesteps: n }),
  setNumTurbines: (n) => set({ numTurbines: n }),

  // ── Data actions ────────────────────────────────────────────

  fetchConfig: async () => {
    try {
      const config = await api.getConfig();
      set({ config });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  fetchScenarios: async () => {
    try {
      const scenarios = await api.getScenarios();
      set({ scenarios });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  runAnalysis: async () => {
    const state = get();
    set({
      loading: true,
      error: null,
      progress: 10,
      progressMessage: "Building twin lookup table...",
    });

    try {
      set({ progress: 30, progressMessage: "Running digital twin analysis..." });

      const analysis = await api.postAnalyze(
        state.selectedScenario,
        state.numTimesteps,
        state.numTurbines,
      );

      set({
        analysis,
        analysisRun: true,
        selectedTurbineId: analysis.farm_health.worst_turbine_id,
        progress: 100,
        progressMessage: "Analysis complete",
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  // ── Utility ─────────────────────────────────────────────────

  clearError: () => set({ error: null }),
}));
