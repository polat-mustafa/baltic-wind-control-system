/**
 * Digital Twin store — run parameters, farm run, selected turbine detail.
 *
 * A run is identified by (scenario, duration, seed); the backend caches it, so
 * the turbine detail always belongs to the run the overview shows. Responses
 * that arrive after the user started a newer request are dropped. Results
 * belong to one farm (farmKey): switching project clears them.
 */

import { create } from "zustand";

import { farmKey } from "../lib/project/farmHeader";
import * as api from "../services/digitalTwinApi";
import type {
  AnalyzeResponse,
  ChannelKey,
  ModelCard,
  ReferenceCurve,
  RunParams,
  ScenarioName,
  TurbineDetail,
} from "../services/digitalTwinApi";

export type TwinTab = "fleet" | "turbine" | "model";

interface DigitalTwinState {
  /** farmKey() of the farm the model card and the run belong to. */
  farm: string | null;
  modelCard: ModelCard | null;
  referenceCurve: ReferenceCurve | null;
  analysis: AnalyzeResponse | null;
  detail: TurbineDetail | null;

  scenario: ScenarioName;
  durationDays: number;
  seed: number;
  tab: TwinTab;
  selectedTurbineId: number | null;
  selectedChannel: ChannelKey;

  loading: boolean;
  detailLoading: boolean;
  error: string | null;

  setScenario: (s: ScenarioName) => void;
  setDurationDays: (d: number) => void;
  setSeed: (s: number) => void;
  setTab: (t: TwinTab) => void;
  setSelectedChannel: (c: ChannelKey) => void;
  loadModel: () => Promise<void>;
  runAnalysis: () => Promise<void>;
  selectTurbine: (id: number, openTab?: boolean) => Promise<void>;
  clearError: () => void;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

let analysisToken = 0;
let detailToken = 0;

export const useDigitalTwinStore = create<DigitalTwinState>((set, get) => {
  /** Drop results of another farm (own project ↔ SB-510, edited layout). */
  const syncFarm = () => {
    const key = farmKey();
    if (get().farm !== key) {
      set({ farm: key, modelCard: null, analysis: null, detail: null, selectedTurbineId: null });
    }
  };
  return {
  farm: null,
  modelCard: null,
  referenceCurve: null,
  analysis: null,
  detail: null,

  scenario: "combined",
  durationDays: 7,
  seed: 42,
  tab: "fleet",
  selectedTurbineId: null,
  selectedChannel: "power",

  loading: false,
  detailLoading: false,
  error: null,

  setScenario: (scenario) => set({ scenario }),
  setDurationDays: (durationDays) => set({ durationDays }),
  setSeed: (seed) => set({ seed: Number.isFinite(seed) ? Math.max(0, Math.round(seed)) : 0 }),
  setTab: (tab) => set({ tab }),
  setSelectedChannel: (selectedChannel) => set({ selectedChannel }),

  loadModel: async () => {
    syncFarm();
    if (get().modelCard && get().referenceCurve) return;
    try {
      const [modelCard, referenceCurve] = await Promise.all([
        api.getModelCard(),
        api.getReferenceCurve(),
      ]);
      set({ modelCard, referenceCurve });
    } catch (err) {
      set({ error: message(err) });
    }
  },

  runAnalysis: async () => {
    syncFarm();
    const { scenario, durationDays, seed } = get();
    const token = ++analysisToken;
    set({ loading: true, error: null });
    try {
      const analysis = await api.postAnalyze({ scenario, duration_days: durationDays, seed });
      if (token !== analysisToken) return;
      // Keep the selected turbine if it still exists; otherwise focus the worst one.
      const worst = [...analysis.turbines].sort((a, b) => a.health_index - b.health_index)[0];
      const keep = get().selectedTurbineId;
      set({ analysis, detail: null, loading: false });
      await get().selectTurbine(keep != null && keep < analysis.turbines.length ? keep : worst.turbine_id, false);
    } catch (err) {
      if (token === analysisToken) set({ error: message(err), loading: false });
    }
  },

  selectTurbine: async (id, openTab = true) => {
    const analysis = get().analysis;
    set({ selectedTurbineId: id, ...(openTab ? { tab: "turbine" as const } : {}) });
    if (!analysis) return;
    const params: RunParams = {
      scenario: analysis.scenario,
      duration_days: analysis.duration_days,
      seed: analysis.seed,
    };
    const token = ++detailToken;
    set({ detailLoading: true });
    try {
      const detail = await api.postTurbineDetail({ ...params, turbine_id: id });
      if (token === detailToken) set({ detail, detailLoading: false });
    } catch (err) {
      if (token === detailToken) set({ error: message(err), detailLoading: false });
    }
  },

  clearError: () => set({ error: null }),
  };
});
