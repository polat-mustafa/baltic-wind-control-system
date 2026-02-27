/**
 * Zustand store for P2 HV Grid dashboard state.
 *
 * Manages computation results from all P2 API endpoints,
 * user-selected scenarios, and loading/error states.
 *
 * Data flow: user clicks "Run Analysis" →
 * runFullAnalysis() calls all endpoints → results populate panels.
 */

import { create } from "zustand";

import * as api from "../services/gridApi";
import type {
  ConverterComparisonResult,
  FRTSimulationResult,
  LoadFlowResult,
  NetworkSpec,
  ShortCircuitResult,
  STATCOMSizingResult,
} from "../types/grid";

// ── Store Interface ────────────────────────────────────────────

interface GridState {
  // Network spec
  networkSpec: NetworkSpec | null;

  // Computation results
  loadFlowResults: LoadFlowResult[] | null;
  shortCircuit: ShortCircuitResult | null;
  statcomSizing: STATCOMSizingResult | null;
  frtResult: FRTSimulationResult | null;
  converterComparison: ConverterComparisonResult | null;

  // User selections
  activeScenario: "full_load" | "partial_load" | "no_load" | "n_minus_1";
  frtType: "lvrt" | "hvrt";
  converterScenario: "strong_grid" | "weak_grid";

  // UI state
  loading: boolean;
  error: string | null;
  analysisRun: boolean;

  // Parameter setters
  setActiveScenario: (s: GridState["activeScenario"]) => void;
  setFrtType: (t: GridState["frtType"]) => void;
  setConverterScenario: (s: GridState["converterScenario"]) => void;

  // Data actions
  fetchNetworkSpec: () => Promise<void>;
  runFullAnalysis: () => Promise<void>;

  // Utility
  clearError: () => void;
}

// ── Store Implementation ───────────────────────────────────────

export const useGridStore = create<GridState>((set, get) => ({
  // Network spec
  networkSpec: null,

  // Results
  loadFlowResults: null,
  shortCircuit: null,
  statcomSizing: null,
  frtResult: null,
  converterComparison: null,

  // Selections
  activeScenario: "full_load",
  frtType: "lvrt",
  converterScenario: "strong_grid",

  // UI
  loading: false,
  error: null,
  analysisRun: false,

  // ── Parameter setters ──────────────────────────────────────

  setActiveScenario: (s) => set({ activeScenario: s }),
  setFrtType: (t) => set({ frtType: t }),
  setConverterScenario: (s) => set({ converterScenario: s }),

  // ── Data actions ───────────────────────────────────────────

  fetchNetworkSpec: async () => {
    try {
      const networkSpec = await api.getNetworkSpec();
      set({ networkSpec });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  runFullAnalysis: async () => {
    const { frtType, converterScenario } = get();

    set({ loading: true, error: null });

    try {
      // Run all analyses in parallel for speed
      const [
        loadFlowResults,
        shortCircuit,
        statcomSizing,
        frtResult,
        converterComparison,
      ] = await Promise.all([
        api.runLoadFlowAll(),
        api.calcShortCircuit("max"),
        api.getSTATCOMSizing(),
        api.runFRT(frtType),
        api.getConverterComparison(converterScenario),
      ]);

      set({
        loadFlowResults,
        shortCircuit,
        statcomSizing,
        frtResult,
        converterComparison,
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
