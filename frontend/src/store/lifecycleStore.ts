/**
 * Lifecycle pages state: construction and decommissioning campaign inputs
 * (persisted as `of.lifecycle.v1`) and the last simulation results (kept for
 * the session, so the hand-over page can quote the construction dates).
 */

import { create } from "zustand";

import { DEFAULT_DECOM, type DecomOptions } from "../lib/lifecycle/decommissioning";
import { readStored, writeStored } from "../lib/storage";
import { runCampaign } from "../services/lifecycleApi";
import type { CampaignRequest, CampaignResult, VesselId, VesselLimit } from "../types/lifecycle";

export const LIFECYCLE_KEY = "of.lifecycle.v1";

export interface CampaignSettings {
  /** ISO date (yyyy-mm-dd) of the first offshore operation. */
  start: string;
  /** DNV-ST-N001 alpha factor, 0.5–1. */
  alpha: number;
  runs: number;
  /** Operational limits the learner changed (others: vessel defaults). */
  limits: Partial<Record<VesselId, { hs_m: number; wind_ms: number }>>;
}

export interface LifecyclePersisted {
  build: CampaignSettings;
  decom: CampaignSettings & { options: DecomOptions };
}

export const DEFAULT_BUILD: CampaignSettings = { start: "2028-04-01", alpha: 0.8, runs: 200, limits: {} };
export const DEFAULT_REMOVE: LifecyclePersisted["decom"] = { start: "2053-04-01", alpha: 0.8, runs: 200, limits: {}, options: { ...DEFAULT_DECOM } };

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

function settings(v: unknown, d: CampaignSettings): CampaignSettings {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const limits: CampaignSettings["limits"] = {};
  if (o.limits && typeof o.limits === "object")
    for (const [k, l] of Object.entries(o.limits as Record<string, unknown>)) {
      const x = l as Record<string, unknown> | null;
      if (["HLV", "WTIV", "CLV", "CTV", "SURVEY"].includes(k) && x && typeof x.hs_m === "number" && typeof x.wind_ms === "number")
        limits[k as VesselId] = { hs_m: clamp(x.hs_m, 0.3, 6, 2), wind_ms: clamp(x.wind_ms, 3, 30, 12) };
    }
  return {
    start: isDate(o.start) ? o.start : d.start,
    alpha: clamp(o.alpha, 0.5, 1, d.alpha),
    runs: Math.round(clamp(o.runs, 20, 500, d.runs)),
    limits,
  };
}

function parse(p: Record<string, unknown>): LifecyclePersisted {
  const dm = (p.decom ?? {}) as Record<string, unknown>;
  const op = (dm.options ?? {}) as Record<string, unknown>;
  return {
    build: settings(p.build, DEFAULT_BUILD),
    decom: {
      ...settings(p.decom, DEFAULT_REMOVE),
      options: {
        foundations: op.foundations === "full" ? "full" : "cut",
        removeArray: op.removeArray === true,
        removeExport: op.removeExport === true,
        removeScour: op.removeScour === true,
      },
    },
  };
}

function load(): LifecyclePersisted {
  try {
    const raw = readStored(LIFECYCLE_KEY);
    if (raw) return parse(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    // corrupt value: defaults
  }
  return { build: { ...DEFAULT_BUILD }, decom: { ...DEFAULT_REMOVE, options: { ...DEFAULT_DECOM } } };
}

export const limitList = (l: CampaignSettings["limits"]): VesselLimit[] =>
  Object.entries(l).map(([vessel, x]) => ({ vessel: vessel as VesselId, hs_m: x.hs_m, wind_ms: x.wind_ms }));

type Mode = "build" | "decom";

interface LifecycleState extends LifecyclePersisted {
  results: Partial<Record<Mode, CampaignResult>>;
  /** Signature of the request each result was computed for. */
  resultFor: Partial<Record<Mode, string>>;
  running: Partial<Record<Mode, boolean>>;
  error: string | null;
  setBuild: (p: Partial<CampaignSettings>) => void;
  setDecom: (p: Partial<LifecyclePersisted["decom"]>) => void;
  setLimit: (mode: Mode, v: VesselId, l: { hs_m: number; wind_ms: number } | null) => void;
  run: (mode: Mode, req: CampaignRequest) => Promise<void>;
  /** Replace the campaign inputs (project document); results are dropped. */
  restore: (p: Record<string, unknown>) => void;
  clearError: () => void;
}

export const requestSignature = (r: CampaignRequest) => JSON.stringify(r);

export const useLifecycleStore = create<LifecycleState>((set, get) => {
  const save = () => {
    const { build, decom } = get();
    writeStored(LIFECYCLE_KEY, JSON.stringify({ build, decom }));
  };
  const seq: Record<Mode, number> = { build: 0, decom: 0 };
  return {
    ...load(),
    results: {},
    resultFor: {},
    running: {},
    error: null,
    setBuild: (p) => {
      set({ build: settings({ ...get().build, ...p }, DEFAULT_BUILD) });
      save();
    },
    setDecom: (p) => {
      const next = { ...get().decom, ...p };
      set({ decom: { ...settings(next, DEFAULT_REMOVE), options: next.options } });
      save();
    },
    setLimit: (mode, v, l) => {
      const cur = mode === "build" ? get().build : get().decom;
      const limits = { ...cur.limits };
      if (l) limits[v] = l;
      else delete limits[v];
      if (mode === "build") get().setBuild({ limits });
      else get().setDecom({ limits });
    },
    run: async (mode, req) => {
      const id = ++seq[mode];
      set({ running: { ...get().running, [mode]: true }, error: null });
      try {
        const res = await runCampaign(req);
        if (id === seq[mode])
          set({
            results: { ...get().results, [mode]: res },
            resultFor: { ...get().resultFor, [mode]: requestSignature(req) },
            running: { ...get().running, [mode]: false },
          });
      } catch (e) {
        if (id === seq[mode]) set({ running: { ...get().running, [mode]: false }, error: e instanceof Error ? e.message : String(e) });
      }
    },
    restore: (p) => {
      set({ ...parse(p), results: {}, resultFor: {} });
      save();
    },
    clearError: () => set({ error: null }),
  };
});
