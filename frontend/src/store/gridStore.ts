/**
 * Zustand store for the P2 Grid Analysis tab.
 *
 * "Run Analysis" fetches every study in parallel. FRT and the GFL/GFM
 * comparison also re-run on their own when their inline controls change —
 * both are fast (tens of ms server-side), so the charts follow the sliders.
 *
 * The farm is SB-510 or the own project (lib/project/farmHeader.ts); results
 * remember the farm they were computed for (`farmFor`) and are dropped when
 * the farm changes.
 */

import { create } from "zustand";

import { SB510_EXPORT_KM } from "../constants/windFarmLayout";
import { farmKey } from "../lib/project/farmHeader";
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

/** SB-510 design (backend network_model.SB510) until /network-spec answers. */
export const SB510_NETWORK: NetworkSpec = {
  name: "SB-510",
  source: "reference",
  total_capacity_mw: 510,
  num_turbines: 34,
  num_strings: 6,
  string_layout: [6, 6, 6, 6, 5, 5],
  section_a_strings: 3,
  max_turbines_per_string: 6,
  array_voltage_kv: 66,
  export_voltage_kv: 220,
  grid_voltage_kv: 400,
  array_cable_length_km: 1.5,
  export_length_km: SB510_EXPORT_KM,
  num_export_cables: 2,
  cable_q_mvar: 260,
  num_oss_transformers: 2,
  oss_trafo_mva: 300,
  num_onshore_transformers: 2,
  onshore_trafo_mva: 300,
  grid_ssc_mva: 10_000,
  statcom_rating_mvar: 120,
  num_reactors: 3,
  reactor_unit_mvar: 80,
  reactor_total_mvar: 240,
};

export const DEFAULT_FRT_PARAMS: FRTParams = {
  faultBus: "PSE_400kV",
  faultImpedancePu: 0.005,
  faultDurationS: 0.15,
  kFactor: 2,
};

interface GridState {
  networkSpec: NetworkSpec | null;
  /** farmKey() of the farm networkSpec and the results belong to. */
  farmFor: string | null;

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

  /** Design of the current farm; drops results computed for another farm. */
  fetchNetworkSpec: () => Promise<void>;
  runFullAnalysis: () => Promise<void>;
  runFrt: () => Promise<void>;
  runConverter: () => Promise<void>;

  clearError: () => void;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

const NO_RESULTS = {
  loadFlowResults: null,
  shortCircuit: null,
  statcomSizing: null,
  frtResult: null,
  converterComparison: null,
  analysisRun: false,
};

export const useGridStore = create<GridState>((set, get) => ({
  networkSpec: null,
  farmFor: null,

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
    const key = farmKey();
    if (key !== get().farmFor) set({ ...NO_RESULTS, networkSpec: null, farmFor: key });
    try {
      const networkSpec = await api.getNetworkSpec();
      if (farmKey() === key) set({ networkSpec, error: null });
    } catch (err) {
      set({ error: message(err) });
    }
  },

  runFullAnalysis: async () => {
    const { frtType, frtParams, converterScenario, phaseJumpDeg } = get();
    const key = farmKey();
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
      set({ loadFlowResults, shortCircuit, statcomSizing, frtResult, converterComparison, analysisRun: true, farmFor: key });
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

/** Design of the modelled farm (SB-510 until /network-spec answers). */
export const useNetwork = (): NetworkSpec => useGridStore((s) => s.networkSpec) ?? SB510_NETWORK;
export const currentNetwork = (): NetworkSpec => useGridStore.getState().networkSpec ?? SB510_NETWORK;
