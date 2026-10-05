/**
 * Zustand store for the P2 Grid Analysis tab.
 *
 * "Run Analysis" fetches every study in parallel. FRT and the GFL/GFM
 * comparison also re-run on their own when their inline controls change —
 * both are fast (tens of ms server-side), so the charts follow the sliders.
 */

import { create } from "zustand";

import * as api from "../services/gridApi";
import type {
  ConverterComparisonResult,
  FRTParams,
  FRTSimulationResult,
  FRTType,
  GridStrength,
  LoadFlowResult,
  LoadFlowScenario,
  NetworkSpec,
  ShortCircuitResult,
  STATCOMSizingResult,
} from "../types/grid";

export const DEFAULT_FRT_PARAMS: FRTParams = {
  faultBus: "PSE_400kV",
  faultImpedancePu: 0.005,
  faultDurationS: 0.15,
  kFactor: 2,
};

interface GridState {
  networkSpec: NetworkSpec | null;

  loadFlowResults: LoadFlowResult[] | null;
  shortCircuit: ShortCircuitResult | null;
  statcomSizing: STATCOMSizingResult | null;
  frtResult: FRTSimulationResult | null;
  converterComparison: ConverterComparisonResult | null;

  activeScenario: LoadFlowScenario;
  frtType: FRTType;
  frtParams: FRTParams;
  converterScenario: GridStrength;
  phaseJumpDeg: number;

  loading: boolean;
  /** Set while only FRT or only the converter study is re-running. */
  frtLoading: boolean;
  converterLoading: boolean;
  error: string | null;
  analysisRun: boolean;

  setActiveScenario: (s: LoadFlowScenario) => void;
  setFrtType: (t: FRTType) => void;
  setFrtParams: (p: Partial<FRTParams>) => void;
  setConverterScenario: (s: GridStrength) => void;
  setPhaseJumpDeg: (deg: number) => void;

  fetchNetworkSpec: () => Promise<void>;
  runFullAnalysis: () => Promise<void>;
  runFrt: () => Promise<void>;
  runConverter: () => Promise<void>;

  clearError: () => void;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export const useGridStore = create<GridState>((set, get) => ({
  networkSpec: null,

  loadFlowResults: null,
  shortCircuit: null,
  statcomSizing: null,
  frtResult: null,
  converterComparison: null,

  activeScenario: "full_load",
  frtType: "lvrt",
  frtParams: DEFAULT_FRT_PARAMS,
  converterScenario: "strong_grid",
  phaseJumpDeg: 20,

  loading: false,
  frtLoading: false,
  converterLoading: false,
  error: null,
  analysisRun: false,

  setActiveScenario: (s) => set({ activeScenario: s }),
  setFrtType: (t) => set({ frtType: t }),
  setFrtParams: (p) => set({ frtParams: { ...get().frtParams, ...p } }),
  setConverterScenario: (s) => set({ converterScenario: s }),
  setPhaseJumpDeg: (deg) => set({ phaseJumpDeg: deg }),

  fetchNetworkSpec: async () => {
    try {
      set({ networkSpec: await api.getNetworkSpec() });
    } catch (err) {
      set({ error: message(err) });
    }
  },

  runFullAnalysis: async () => {
    const { frtType, frtParams, converterScenario, phaseJumpDeg } = get();
    set({ loading: true, error: null });
    try {
      const [loadFlowResults, shortCircuit, statcomSizing, frtResult, converterComparison] =
        await Promise.all([
          api.runLoadFlowAll(),
          api.calcShortCircuit("max"),
          api.getSTATCOMSizing(),
          api.runFRT(frtType, frtParams),
          api.getConverterComparison(converterScenario, phaseJumpDeg),
        ]);
      set({ loadFlowResults, shortCircuit, statcomSizing, frtResult, converterComparison, analysisRun: true });
    } catch (err) {
      set({ error: message(err) });
    } finally {
      set({ loading: false });
    }
  },

  runFrt: async () => {
    const { frtType, frtParams } = get();
    set({ frtLoading: true, error: null });
    try {
      set({ frtResult: await api.runFRT(frtType, frtParams) });
    } catch (err) {
      set({ error: message(err) });
    } finally {
      set({ frtLoading: false });
    }
  },

  runConverter: async () => {
    const { converterScenario, phaseJumpDeg } = get();
    set({ converterLoading: true, error: null });
    try {
      set({ converterComparison: await api.getConverterComparison(converterScenario, phaseJumpDeg) });
    } catch (err) {
      set({ error: message(err) });
    } finally {
      set({ converterLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
