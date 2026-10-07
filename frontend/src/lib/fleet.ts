/**
 * The live plant of the control room — the farm the landing simulation, the
 * map, the SCADA mimic and single-line diagram, the alarms and the plant
 * physics (utils/landingPhysics) run on.
 *
 * SB-510, or in own-project mode the layout project (lib/lifecycle/farm.ts)
 * with the network the backend sized for it (GET /grid/network-spec →
 * design(): export circuits, transformers, reactors, STATCOM). Own turbines
 * are named WTG-01 … in register order (string 1 first, OSS end first) — the
 * names the backend P3 services give them. hooks/useLiveFleet keeps it in
 * step with the project; the stores that hold per-turbine state reset when
 * it changes.
 */

import { create } from "zustand";

import {
  OSS_GEO,
  PSE_SUBSTATION_GEO,
  SB510_EXPORT_KM,
  SITE_BOUNDARY_GEO,
  TURBINE_POSITIONS,
  type TurbinePosition,
} from "../constants/windFarmLayout";
import type { NetworkSpec } from "../types/grid";
import type { FarmPlan } from "./lifecycle/farm";

/** SB-510 design (backend network_model.SB510). */
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

export interface Fleet {
  /** Identity: "sb510", or farmKey() plus the turbine positions. */
  key: string;
  source: "sb510" | "project";
  name: string;
  turbines: TurbinePosition[];
  /** Next node towards the OSS: a turbine id, or "OSS" at a string's gateway. */
  upstream: Record<string, string>;
  /** Turbine ids per string (string 1 first). */
  strings: string[][];
  oss: { lat: number; lon: number };
  /** Grid connection node (SB-510: PSE Słupsk-Wierzbięcino; own: the site report's nearest node, if known). */
  grid: { name: string; lat: number; lon: number } | null;
  /** Site boundary [lat, lon][] (own: the drawn site). */
  boundary: [number, number][];
  net: NetworkSpec;
}

export interface FleetSite {
  /** Drawn site polygon [lon, lat][]. */
  site: [number, number][] | null;
  grid: { name: string; lat: number; lon: number } | null;
}

/** 66 kV busbar section of string i (0-based): the first `section_a_strings` on A. */
export const sectionOf = (f: Fleet, i: number): "A" | "B" => (i < f.net.section_a_strings ? "A" : "B");

/** Strings (0-based) on a busbar section. */
export const stringsOn = (f: Fleet, s: "A" | "B"): number[] =>
  f.strings.map((_, i) => i).filter((i) => sectionOf(f, i) === s);

/** Legacy schematic units per km (SB-510: 8D string spacing ≈ 100 units) — landing wind variation only. */
const UNITS_PER_KM = 55;

/** Fleet of a farm plan (turbines in register order) on its sized network. */
export function fleetFromPlan(plan: FarmPlan, net: NetworkSpec, key: string, site: FleetSite = { site: null, grid: null }): Fleet {
  if (plan.source === "sb510") return SB510_FLEET;
  const name = new Map(plan.turbines.map((t, i) => [t.id, `WTG-${String(i + 1).padStart(2, "0")}`]));
  const lon0 = Math.min(...plan.turbines.map((t) => t.lon));
  const lat1 = Math.max(...plan.turbines.map((t) => t.lat));
  const kmLon = 111.32 * Math.cos((plan.oss[1] * Math.PI) / 180);
  const turbines = plan.turbines.map((t) => ({
    id: name.get(t.id)!,
    stringNumber: t.string,
    x: Math.round((t.lon - lon0) * kmLon * UNITS_PER_KM),
    y: Math.round((lat1 - t.lat) * 110.57 * UNITS_PER_KM),
    lat: t.lat,
    lon: t.lon,
  }));
  return {
    key: `${key}|${site.grid?.name ?? ""}|${plan.turbines.map((t) => `${t.lat.toFixed(5)},${t.lon.toFixed(5)}`).join(";")}`,
    source: "project",
    name: net.name,
    turbines,
    upstream: Object.fromEntries(plan.turbines.map((t) => [name.get(t.id)!, name.get(t.upstream) ?? "OSS"])),
    strings: plan.strings.map((_, s) => turbines.filter((t) => t.stringNumber === s + 1).map((t) => t.id)),
    oss: { lat: plan.oss[1], lon: plan.oss[0] },
    grid: site.grid,
    boundary: (site.site ?? []).map(([lon, lat]) => [lat, lon]),
    net,
  };
}

/** SB-510 (as drawn on the control-room map): strings run N–S, the southern turbine connects to the OSS. */
function sb510Upstream(): Record<string, string> {
  const up: Record<string, string> = {};
  for (const n of new Set(TURBINE_POSITIONS.map((t) => t.stringNumber))) {
    const chain = TURBINE_POSITIONS.filter((t) => t.stringNumber === n).sort((a, b) => a.lat - b.lat);
    chain.forEach((t, k) => (up[t.id] = k === 0 ? "OSS" : chain[k - 1].id));
  }
  return up;
}

export const SB510_FLEET: Fleet = {
  key: "sb510",
  source: "sb510",
  name: "SB-510",
  turbines: TURBINE_POSITIONS,
  upstream: sb510Upstream(),
  strings: [...new Set(TURBINE_POSITIONS.map((t) => t.stringNumber))]
    .sort((a, b) => a - b)
    .map((n) => TURBINE_POSITIONS.filter((t) => t.stringNumber === n).map((t) => t.id).sort()),
  oss: OSS_GEO,
  grid: { name: "PSE Słupsk-Wierzbięcino", ...PSE_SUBSTATION_GEO },
  boundary: SITE_BOUNDARY_GEO,
  net: SB510_NETWORK,
};

interface FleetState {
  fleet: Fleet;
  setFleet: (f: Fleet) => void;
}

export const useFleetStore = create<FleetState>((set, get) => ({
  fleet: SB510_FLEET,
  setFleet: (fleet) => {
    if (fleet.key !== get().fleet.key || fleet.net !== get().fleet.net) set({ fleet });
  },
}));

/** The live fleet outside React (stores, physics). */
export const liveFleet = () => useFleetStore.getState().fleet;
export const useFleet = () => useFleetStore((s) => s.fleet);

// ── 66 kV array cable tree ──────────────────────────────────────

/** One array cable section: from a turbine to the next node towards the OSS. */
export interface ArraySegment {
  key: string;
  stringNumber: number;
  fromId: string;
  /** Upstream turbine, or "OSS" for the string's feeder cable. */
  toId: string;
  /** Turbines whose power (and fibre) runs through it: fromId and all beyond, far end first. */
  feedIds: string[];
  /** Sections between it and the OSS (0 = feeder cable). */
  segmentFromOss: number;
}

const segCache = new WeakMap<Fleet, ArraySegment[]>();

/** Turbines from `id` to the string's gateway, following the cable towards the OSS. */
export function pathToOss(f: Fleet, id: string): string[] {
  const path: string[] = [];
  for (let k = id; k !== "OSS" && path.length <= f.turbines.length; k = f.upstream[k] ?? "OSS") path.push(k);
  return path;
}

/** Every array cable section of the fleet (radial strings or branched trees). */
export function arraySegments(f: Fleet = liveFleet()): ArraySegment[] {
  const hit = segCache.get(f);
  if (hit) return hit;
  const depth = new Map(f.turbines.map((t) => [t.id, pathToOss(f, t.id).length - 1]));
  const segs = f.turbines.map((t) => {
    const to = f.upstream[t.id] ?? "OSS";
    const feedIds = f.turbines
      .filter((o) => pathToOss(f, o.id).includes(t.id))
      .map((o) => o.id)
      .sort((a, b) => depth.get(b)! - depth.get(a)!);
    return {
      key: to === "OSS" ? `string-${t.stringNumber}-oss` : `cable-${t.id}-${to}`,
      stringNumber: t.stringNumber,
      fromId: t.id,
      toId: to,
      feedIds,
      segmentFromOss: depth.get(t.id)!,
    };
  });
  segCache.set(f, segs);
  return segs;
}
