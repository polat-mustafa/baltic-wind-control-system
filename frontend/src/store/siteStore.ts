/**
 * Site & Permits store: region layers, suitability screening, the site the
 * user draws, its assessment report and the journey stage.
 *
 * Responses that arrive after a newer request was started are dropped. A
 * failed assessment keeps the last good report; `reportFor` records which
 * site + criteria it belongs to, so the page can mark it out of date.
 */

import { create } from "zustand";

import { readStored, writeStored } from "../lib/storage";
import * as api from "../services/siteApi";
import type {
  AssessResponse,
  CriteriaOverrides,
  LayersResponse,
  LonLat,
  SuitabilityResponse,
} from "../services/siteApi";
import type { StageId } from "../components/site/journey";

/** SB-510 site boundary (frontend/src/constants/windFarmLayout.ts SITE_BOUNDARY_GEO), [lon, lat]. */
export const CASE_STUDY_SITE: LonLat[] = [
  [16.31, 54.845],
  [16.485, 54.845],
  [16.485, 54.755],
  [16.31, 54.755],
];

const SITE_KEY = "of.site.v1";

/** Identifies the inputs a report was computed from (site corners + criteria). */
export const reportSignature = (site: LonLat[] | null, criteria: CriteriaOverrides): string =>
  JSON.stringify([site, Object.entries(criteria).sort(([a], [b]) => a.localeCompare(b))]);

interface Persisted {
  site: LonLat[] | null;
  stage: StageId;
  done: StageId[];
}

function load(): Persisted {
  try {
    const raw = readStored(SITE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Persisted>;
      const site = Array.isArray(p.site) && p.site.length >= 3 ? (p.site as LonLat[]) : null;
      return { site, stage: p.stage ?? "screening", done: Array.isArray(p.done) ? p.done : [] };
    }
  } catch {
    // corrupt value: start fresh
  }
  return { site: null, stage: "screening", done: [] };
}

interface SiteState {
  layers: LayersResponse | null;
  suitability: SuitabilityResponse | null;
  criteria: CriteriaOverrides;
  site: LonLat[] | null;
  drawing: LonLat[] | null; // corners while drawing; null when not drawing
  report: AssessResponse | null;
  /** reportSignature() of the inputs behind `report`. */
  reportFor: string | null;
  stage: StageId;
  done: StageId[];
  loading: boolean;
  assessing: boolean;
  /** Last assessment failure; the previous report (if any) is kept. */
  assessError: string | null;
  error: string | null;

  loadLayers: () => Promise<void>;
  runSuitability: () => Promise<void>;
  setCriteria: (patch: CriteriaOverrides) => void;
  startDrawing: () => void;
  addCorner: (p: LonLat) => void;
  undoCorner: () => void;
  finishDrawing: () => Promise<void>;
  cancelDrawing: () => void;
  setSite: (site: LonLat[] | null) => Promise<void>;
  assess: () => Promise<void>;
  setStage: (stage: StageId) => void;
  completeStage: (stage: StageId) => void;
  reset: () => void;
  clearError: () => void;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));
let suitabilityToken = 0;
let assessToken = 0;

const initial = load();

function persist(s: Pick<SiteState, "site" | "stage" | "done">) {
  writeStored(SITE_KEY, JSON.stringify({ site: s.site, stage: s.stage, done: s.done }));
}

export const useSiteStore = create<SiteState>((set, get) => ({
  layers: null,
  suitability: null,
  criteria: {},
  site: initial.site,
  drawing: null,
  report: null,
  reportFor: null,
  stage: initial.stage,
  done: initial.done,
  loading: false,
  assessing: false,
  assessError: null,
  error: null,

  loadLayers: async () => {
    if (get().layers) return;
    try {
      set({ layers: await api.getLayers() });
    } catch (err) {
      set({ error: message(err) });
    }
  },

  runSuitability: async () => {
    const token = ++suitabilityToken;
    set({ loading: true, error: null });
    try {
      const suitability = await api.postSuitability(get().criteria);
      if (token === suitabilityToken) set({ suitability, loading: false });
    } catch (err) {
      if (token === suitabilityToken) set({ error: message(err), loading: false });
    }
  },

  setCriteria: (patch) => {
    set({ criteria: { ...get().criteria, ...patch } });
    void get().runSuitability();
    if (get().site) void get().assess();
  },

  startDrawing: () => set({ drawing: [] }),
  addCorner: (p) => {
    const d = get().drawing;
    if (d) set({ drawing: [...d, p] });
  },
  undoCorner: () => {
    const d = get().drawing;
    if (d && d.length > 0) set({ drawing: d.slice(0, -1) });
  },
  finishDrawing: async () => {
    const d = get().drawing;
    if (!d || d.length < 3) return;
    set({ drawing: null });
    await get().setSite(d);
  },
  cancelDrawing: () => set({ drawing: null }),

  setSite: async (site) => {
    // A new site invalidates every stage done for the old one.
    set({ site, report: null, reportFor: null, assessError: null, done: [], stage: "screening" });
    persist(get());
    if (site) await get().assess();
  },

  assess: async () => {
    const site = get().site;
    if (!site) return;
    const criteria = get().criteria;
    const token = ++assessToken;
    set({ assessing: true, assessError: null });
    try {
      const report = await api.postAssess(site, criteria);
      if (token === assessToken) set({ report, reportFor: reportSignature(site, criteria), assessing: false });
    } catch (err) {
      if (token === assessToken) set({ assessError: message(err), assessing: false });
    }
  },

  setStage: (stage) => {
    set({ stage });
    persist(get());
  },

  completeStage: (stage) => {
    if (get().done.includes(stage)) return;
    set({ done: [...get().done, stage] });
    persist(get());
  },

  reset: () => {
    set({
      site: null,
      report: null,
      reportFor: null,
      assessError: null,
      drawing: null,
      stage: "screening",
      done: [],
      criteria: {},
    });
    persist(get());
    void get().runSuitability();
  },

  clearError: () => set({ error: null }),
}));
