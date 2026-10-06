/**
 * Layout project: the turbines, offshore substation and cost inputs the user
 * sets on the layout canvas (route /develop/layout), inside the site from
 * Site & Permits (siteStore). Persisted as `of.project.v1`; exported and
 * imported as a `.offshoreforge.json` file.
 *
 * The PyWake result is kept with the layout signature it was computed for,
 * so the page can tell when it is out of date.
 */

import { create } from "zustand";

import { TURBINE_POSITIONS, OSS_GEO } from "../constants/windFarmLayout";
import { DEFAULT_COSTS, type CostInputs } from "../lib/layout/cost";
import type { LonLat } from "../lib/layout/geometry";
import { readStored, writeStored } from "../lib/storage";
import { runCustomWakeAnalysis } from "../services/windResourceApi";
import type { WakeAnalysisResult } from "../types/windResource";

export const PROJECT_KEY = "of.project.v1";
export const PROJECT_SCHEMA = 1;
export const MAX_TURBINES = 150;

export interface Turbine {
  id: string;
  lon: number;
  lat: number;
}

export interface ProjectFile {
  schema: number;
  app: "OffshoreForge";
  turbineModel: "V236-15.0";
  site: LonLat[] | null;
  turbines: Turbine[];
  oss: LonLat | null;
  costs: CostInputs;
}

interface Persisted {
  turbines: Turbine[];
  oss: LonLat | null;
  costs: CostInputs;
}

const round5 = (v: number) => Number(v.toFixed(5));

export const signature = (t: Turbine[]) => t.map((x) => `${x.lon.toFixed(5)},${x.lat.toFixed(5)}`).join(";");

function nextId(t: Turbine[]): string {
  const used = new Set(t.map((x) => x.id));
  for (let i = 1; ; i++) {
    const id = `T${String(i).padStart(2, "0")}`;
    if (!used.has(id)) return id;
  }
}

function validTurbines(v: unknown): Turbine[] | null {
  if (!Array.isArray(v) || v.length > MAX_TURBINES) return null;
  const out: Turbine[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") return null;
    const { id, lon, lat } = x as Record<string, unknown>;
    if (typeof id !== "string" || typeof lon !== "number" || typeof lat !== "number") return null;
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    out.push({ id, lon, lat });
  }
  return out;
}

const validLonLat = (v: unknown): LonLat | null =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && Number.isFinite(n)) ? [v[0], v[1]] : null;

function validCosts(v: unknown): CostInputs {
  const out = { ...DEFAULT_COSTS };
  if (v && typeof v === "object")
    for (const k of Object.keys(DEFAULT_COSTS) as (keyof CostInputs)[]) {
      const n = (v as Record<string, unknown>)[k];
      if (typeof n === "number" && Number.isFinite(n) && n >= 0) out[k] = n;
    }
  if (out.lifetimeYears < 1) out.lifetimeYears = DEFAULT_COSTS.lifetimeYears;
  return out;
}

function load(): Persisted {
  try {
    const raw = readStored(PROJECT_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Record<string, unknown>;
      return { turbines: validTurbines(p.turbines) ?? [], oss: validLonLat(p.oss), costs: validCosts(p.costs) };
    }
  } catch {
    // corrupt value: start empty
  }
  return { turbines: [], oss: null, costs: { ...DEFAULT_COSTS } };
}

interface ProjectState extends Persisted {
  selected: string | null;
  addMode: boolean;
  pywake: WakeAnalysisResult | null;
  pywakeFor: string | null;
  running: boolean;
  error: string | null;

  setTurbines: (t: LonLat[]) => void;
  addTurbine: (p: LonLat) => void;
  moveTurbine: (id: string, p: LonLat) => void;
  removeTurbine: (id: string) => void;
  select: (id: string | null) => void;
  setAddMode: (on: boolean) => void;
  setOss: (p: LonLat | null) => void;
  setCost: (k: keyof CostInputs, v: number) => void;
  resetCosts: () => void;
  loadCaseStudy: () => void;
  clear: () => void;
  runPyWake: (toXY: (p: LonLat) => { x: number; y: number }) => Promise<void>;
  exportFile: (site: LonLat[] | null) => string;
  importFile: (text: string) => LonLat[] | null;
  clearError: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => {
  const save = () => {
    const { turbines, oss, costs } = get();
    writeStored(PROJECT_KEY, JSON.stringify({ turbines, oss, costs }));
  };
  const update = (patch: Partial<ProjectState>) => {
    set(patch);
    save();
  };
  let request = 0;

  return {
    ...load(),
    selected: null,
    addMode: false,
    pywake: null,
    pywakeFor: null,
    running: false,
    error: null,

    setTurbines: (pts) =>
      update({
        turbines: pts.slice(0, MAX_TURBINES).map(([lon, lat], i) => ({ id: `T${String(i + 1).padStart(2, "0")}`, lon: round5(lon), lat: round5(lat) })),
        selected: null,
      }),
    addTurbine: ([lon, lat]) => {
      const t = get().turbines;
      if (t.length >= MAX_TURBINES) {
        set({ error: `At most ${MAX_TURBINES} turbines per layout.` });
        return;
      }
      const id = nextId(t);
      update({ turbines: [...t, { id, lon: round5(lon), lat: round5(lat) }], selected: id });
    },
    moveTurbine: (id, [lon, lat]) =>
      update({ turbines: get().turbines.map((x) => (x.id === id ? { id, lon: round5(lon), lat: round5(lat) } : x)) }),
    removeTurbine: (id) =>
      update({ turbines: get().turbines.filter((x) => x.id !== id), selected: get().selected === id ? null : get().selected }),
    select: (id) => set({ selected: id }),
    setAddMode: (on) => set({ addMode: on }),
    setOss: (p) => update({ oss: p ? [round5(p[0]), round5(p[1])] : null }),
    setCost: (k, v) => {
      if (!Number.isFinite(v) || v < 0) return;
      update({ costs: { ...get().costs, [k]: v } });
    },
    resetCosts: () => update({ costs: { ...DEFAULT_COSTS } }),
    loadCaseStudy: () =>
      update({
        turbines: TURBINE_POSITIONS.map((t) => ({ id: t.id, lon: t.lon, lat: t.lat })),
        oss: [OSS_GEO.lon, OSS_GEO.lat],
        selected: null,
      }),
    clear: () => update({ turbines: [], selected: null, pywake: null, pywakeFor: null }),

    runPyWake: async (toXY) => {
      const t = get().turbines;
      if (!t.length) return;
      const id = ++request;
      const sig = signature(t);
      set({ running: true, error: null });
      try {
        const xy = t.map((x) => toXY([x.lon, x.lat]));
        const res = await runCustomWakeAnalysis(
          xy.map((p) => Math.round(p.x * 10) / 10),
          xy.map((p) => Math.round(p.y * 10) / 10),
        );
        if (id === request) set({ pywake: res, pywakeFor: sig, running: false });
      } catch (e) {
        if (id === request) set({ running: false, error: e instanceof Error ? e.message : String(e) });
      }
    },

    exportFile: (site) => {
      const { turbines, oss, costs } = get();
      const file: ProjectFile = { schema: PROJECT_SCHEMA, app: "OffshoreForge", turbineModel: "V236-15.0", site, turbines, oss, costs };
      return JSON.stringify(file, null, 2);
    },

    importFile: (text) => {
      let p: Record<string, unknown>;
      try {
        p = JSON.parse(text) as Record<string, unknown>;
      } catch {
        set({ error: "Not a JSON file." });
        return null;
      }
      if (p.app !== "OffshoreForge" || p.schema !== PROJECT_SCHEMA) {
        set({ error: "Not an OffshoreForge project file (schema 1)." });
        return null;
      }
      const turbines = validTurbines(p.turbines);
      if (!turbines) {
        set({ error: `Invalid turbine list (at most ${MAX_TURBINES}).` });
        return null;
      }
      update({ turbines, oss: validLonLat(p.oss), costs: validCosts(p.costs), selected: null, pywake: null, pywakeFor: null, error: null });
      const site = Array.isArray(p.site) ? (p.site.map(validLonLat).filter(Boolean) as LonLat[]) : [];
      return site.length >= 3 ? site : null;
    },

    clearError: () => set({ error: null }),
  };
});
