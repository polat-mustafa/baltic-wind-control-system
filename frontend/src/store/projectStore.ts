/**
 * Layout project: the turbines, offshore substation and cost inputs the user
 * sets on the layout canvas (route /develop/layout), inside the site from
 * Site & Permits (siteStore). Persisted as `of.project.v1`; part of the
 * project document (lib/project/document.ts) that is exported and saved online.
 *
 * The PyWake result is kept with the layout signature it was computed for,
 * so the page can tell when it is out of date.
 */

import { create } from "zustand";

import { TURBINE_POSITIONS, OSS_GEO } from "../constants/windFarmLayout";
import { DEFAULT_COSTS, type CostInputs } from "../lib/layout/cost";
import type { LonLat } from "../lib/layout/geometry";
import { readStored, writeStored } from "../lib/storage";
import { postNeighbours, type NeighbourFarm } from "../services/siteApi";
import { runCustomWakeAnalysis } from "../services/windResourceApi";
import type { WakeAnalysisResult } from "../types/windResource";

export const PROJECT_KEY = "of.project.v1";
export const MAX_TURBINES = 150;

export interface Turbine {
  id: string;
  lon: number;
  lat: number;
}

export interface Persisted {
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

export function validTurbines(v: unknown): Turbine[] | null {
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

export const validLonLat = (v: unknown): LonLat | null =>
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

export interface PyWakeWind {
  weibullA: number;
  weibullK: number;
  sectorFrequencies: number[] | null;
}

export interface ExternalWake {
  lossPct: number;
  netWithGWh: number;
  farms: Omit<NeighbourFarm, "turbines">[];
  turbines: number;
  note: string;
  densityBasis: string;
}

interface ProjectState extends Persisted {
  selected: string | null;
  addMode: boolean;
  pywake: WakeAnalysisResult | null;
  pywakeFor: string | null;
  running: boolean;
  /** External wake loss from the neighbouring farms, for the layout `externalFor`. */
  external: ExternalWake | null;
  externalFor: string | null;
  externalRunning: boolean;
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
  /**
   * PyWake AEP of the layout; `wind` = the site climate (default: P1's synthetic rose).
   * `remote` runs it on the saved project instead (kept as AEP history).
   */
  runPyWake: (
    toXY: (p: LonLat) => { x: number; y: number },
    wind?: PyWakeWind,
    remote?: (wind?: PyWakeWind) => Promise<WakeAnalysisResult>,
  ) => Promise<void>;
  /**
   * External wake loss: the real farms within 60 km of the site as approximate layouts
   * (POST /site/neighbours), PyWake (TurbOPark) with and without them.
   */
  runNeighbourWake: (toXY: (p: LonLat) => { x: number; y: number }, site: LonLat[], wind?: PyWakeWind) => Promise<void>;
  /** Replace turbines, OSS and costs (project document); false if the turbine list is invalid. */
  restore: (p: Record<string, unknown>) => boolean;
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
  let externalRequest = 0;

  return {
    ...load(),
    selected: null,
    addMode: false,
    pywake: null,
    external: null,
    externalFor: null,
    externalRunning: false,
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

    runPyWake: async (toXY, wind, remote) => {
      const t = get().turbines;
      if (!t.length) return;
      const id = ++request;
      const sig = signature(t);
      set({ running: true, error: null });
      try {
        const xy = t.map((x) => toXY([x.lon, x.lat]));
        const res = remote
          ? await remote(wind)
          : await runCustomWakeAnalysis(
              xy.map((p) => Math.round(p.x * 10) / 10),
              xy.map((p) => Math.round(p.y * 10) / 10),
              wind?.weibullA,
              wind?.weibullK,
              undefined,
              undefined,
              wind?.sectorFrequencies ?? null,
            );
        if (id === request) set({ pywake: res, pywakeFor: sig, running: false });
      } catch (e) {
        if (id === request) set({ running: false, error: e instanceof Error ? e.message : String(e) });
      }
    },

    runNeighbourWake: async (toXY, site, wind) => {
      const t = get().turbines;
      if (!t.length) return;
      const id = ++externalRequest;
      const sig = signature(t);
      set({ externalRunning: true, error: null });
      try {
        const nb = await postNeighbours(site);
        const pts = nb.farms.flatMap((f) => f.turbines.map(toXY));
        const xy = t.map((x) => toXY([x.lon, x.lat]));
        const r = (v: number) => Math.round(v * 10) / 10;
        const res = await runCustomWakeAnalysis(
          xy.map((p) => r(p.x)),
          xy.map((p) => r(p.y)),
          wind?.weibullA,
          wind?.weibullK,
          undefined,
          undefined,
          wind?.sectorFrequencies ?? null,
          pts.length ? { x_m: pts.map((p) => r(p.x)), y_m: pts.map((p) => r(p.y)) } : null,
        );
        const external: ExternalWake = {
          lossPct: res.external_wake_loss_percent ?? 0,
          netWithGWh: res.net_aep_with_neighbours_gwh ?? res.net_aep_gwh,
          farms: nb.farms.map(({ turbines: _, ...f }) => f),
          turbines: pts.length,
          note: nb.note,
          densityBasis: nb.density_basis,
        };
        if (id === externalRequest) set({ external, externalFor: sig, externalRunning: false });
      } catch (e) {
        if (id === externalRequest) set({ externalRunning: false, error: e instanceof Error ? e.message : String(e) });
      }
    },

    restore: (p) => {
      const turbines = validTurbines(p.turbines);
      if (!turbines) return false;
      update({ turbines, oss: validLonLat(p.oss), costs: validCosts(p.costs), selected: null, pywake: null, pywakeFor: null, error: null });
      return true;
    },

    clearError: () => set({ error: null }),
  };
});
