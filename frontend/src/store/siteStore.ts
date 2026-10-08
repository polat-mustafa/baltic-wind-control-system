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
import { STAGES, type StageId } from "../components/site/journey";

/** SB-510 site boundary (frontend/src/constants/windFarmLayout.ts SITE_BOUNDARY_GEO), [lon, lat]. */
export const CASE_STUDY_SITE: LonLat[] = [
  [16.4978, 55.099],
  [16.5452, 55.1059],
  [16.6056, 55.1083],
  [16.63, 55.1139],
  [16.63, 55.0474],
  [16.4496, 55.0054],
  [16.4417, 55.0018],
  [16.42, 54.9881],
  [16.42, 55.0688],
];

const SITE_KEY = "of.site.v1";

/** Identifies the inputs a report was computed from (site corners + criteria). */
export const reportSignature = (site: LonLat[] | null, criteria: CriteriaOverrides): string =>
  JSON.stringify([site, Object.entries(criteria).sort(([a], [b]) => a.localeCompare(b))]);

export interface SitePersisted {
  site: LonLat[] | null;
  stage: StageId;
  done: StageId[];
  /** Chosen grid connection point; null = the nearest. */
  gridNode: string | null;
}

const isLonLat = (v: unknown): v is LonLat =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && Number.isFinite(n));
const isStage = (v: unknown): v is StageId => STAGES.some((s) => s.id === v);

function parse(p: Record<string, unknown>): SitePersisted {
  const site = Array.isArray(p.site) && p.site.length >= 3 && p.site.every(isLonLat) ? (p.site as LonLat[]) : null;
  return {
    site,
    stage: isStage(p.stage) ? p.stage : "screening",
    done: Array.isArray(p.done) ? p.done.filter(isStage) : [],
    gridNode: typeof p.gridNode === "string" && p.gridNode ? p.gridNode : null,
  };
}

function load(): SitePersisted {
  try {
    const raw = readStored(SITE_KEY);
    if (raw) return parse(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    // corrupt value: start fresh
  }
  return { site: null, stage: "screening", done: [], gridNode: null };
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
  gridNode: string | null;
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
  /** Choose the grid connection point (null = the nearest) and re-assess. */
  setGridNode: (name: string | null) => Promise<void>;
  assess: () => Promise<void>;
  setStage: (stage: StageId) => void;
  completeStage: (stage: StageId) => void;
  /** Replace site, stage and done stages (project document) and re-assess. */
  restore: (p: Record<string, unknown>) => void;
  reset: () => void;
  clearError: () => void;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));
let suitabilityToken = 0;
let assessToken = 0;

const initial = load();

function persist(s: Pick<SiteState, "site" | "stage" | "done" | "gridNode">) {
  writeStored(SITE_KEY, JSON.stringify({ site: s.site, stage: s.stage, done: s.done, gridNode: s.gridNode }));
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
  gridNode: initial.gridNode,
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
      const suitability = await api.postSuitability(get().criteria, 2, get().layers?.region.region);
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
    set({ site, report: null, reportFor: null, assessError: null, done: [], stage: "screening", gridNode: null });
    persist(get());
    if (site) await get().assess();
  },

  setGridNode: async (gridNode) => {
    set({ gridNode });
    persist(get());
    await get().assess();
  },

  assess: async () => {
    const site = get().site;
    if (!site) return;
    const criteria = get().criteria;
    const token = ++assessToken;
    set({ assessing: true, assessError: null });
    try {
      const report = await api.postAssess(site, criteria, get().layers?.region.region, get().gridNode);
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

  restore: (p) => {
    set({ ...parse(p), report: null, reportFor: null, assessError: null, drawing: null });
    persist(get());
    if (get().site) void get().assess();
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
      gridNode: null,
    });
    persist(get());
    void get().runSuitability();
  },

  clearError: () => set({ error: null }),
}));
