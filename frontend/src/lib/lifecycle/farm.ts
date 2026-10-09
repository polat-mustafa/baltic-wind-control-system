/**
 * The farm the lifecycle pages work on: the learner's layout project
 * (projectStore + siteStore) or, without one, the SB-510 reference farm.
 *
 * It is the hand-over package between design and build: turbine register
 * with string and OSS feeder bay, cable tree with sections, export route,
 * foundation type — and the inputs of the construction / decommissioning
 * campaign (POST /api/v1/lifecycle/campaign).
 */

import { OSS_GEO, SB510_DEPTH_M, SB510_EXPORT_KM, TURBINE_POSITIONS } from "../../constants/windFarmLayout";
import { mstLength, routeCables, sectionFor, type CableEdge, type CableResult } from "../layout/cables";
import { defaultExportKm, RATED_MW } from "../layout/evaluate";
import { centroid, dist, projection, type LonLat, type XY } from "../layout/geometry";
import type { SitePort } from "../../services/siteApi";
import type { CampaignRequest } from "../../types/lifecycle";

/** Monopile up to 40 m water depth, jacket beyond (same rule as the layout cost model). */
export const MONOPILE_MAX_DEPTH_M = 40;

export interface RegisterRow {
  id: string;
  lon: number;
  lat: number;
  /** 1-based string number, numbered clockwise from north around the OSS. */
  string: number;
  /** OSS 66 kV feeder bay of the string (P3/P5 naming). */
  bay: string;
  /** Next node towards the OSS. */
  upstream: string;
  /** Section of the cable to `upstream` (null: overloaded). */
  section: string | null;
  cableKm: number;
  /** Turbines carried by that cable. */
  load: number;
}

export interface FarmPlan {
  source: "project" | "sb510";
  name: string;
  turbines: RegisterRow[];
  oss: LonLat;
  /** Turbines per string, string 1 first. */
  strings: number[];
  arrayKm: number;
  kmBySection: Record<string, number>;
  exportKm: number;
  depthM: [number, number] | null;
  foundation: "monopile" | "jacket";
  capacityMW: number;
  crossings: number;
  /** Nearest installation and O&M port by sea (site assessment); null for SB-510 until assessed. */
  installPort: { name: string; km: number } | null;
  omPort: { name: string; km: number } | null;
}

/** SB-510's ports by sea (backend site assessment, pinned by its tests). */
export const SB510_PORTS = {
  installation: { name: "Rønne (DK)", km: 116.7 },
  om: { name: "Ustka", km: 52.5 },
} as const;

/** Nearest port of one use with a sea route, from the assessment's list. */
export const nearestPort = (ports: SitePort[] | undefined, use: SitePort["use"]) => {
  const p = ports?.find((x) => x.use === use && x.km != null);
  return p ? { name: p.name, km: p.km! } : null;
};

export const bayName = (s: number) => `BAY-OSS-66-${String(s).padStart(2, "0")}`;

export const foundationFor = (depth: [number, number] | null): "monopile" | "jacket" =>
  depth != null && depth[1] > MONOPILE_MAX_DEPTH_M ? "jacket" : "monopile";

/** Bearing [deg, 0 = north, clockwise] of b seen from a, in local metres. */
const bearing = (a: XY, b: XY) => (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI + 360;

/**
 * Turn a cable tree into the register: follow every turbine to the OSS,
 * number the strings clockwise from north (or keep the given numbers),
 * order turbines by string and then by hops from the OSS.
 */
export function registerFromTree(
  ids: string[],
  pts: LonLat[],
  xy: XY[],
  ossXY: XY,
  edges: CableEdge[],
  fixedString?: number[],
): { rows: RegisterRow[]; strings: number[] } {
  const up = new Map(edges.map((e) => [e.from, e]));
  const gateway: number[] = [];
  const hops: number[] = [];
  for (let i = 0; i < ids.length; i++) {
    let k = i;
    let h = 0;
    for (let guard = 0; guard <= ids.length; guard++) {
      const e = up.get(k);
      if (!e || e.to < 0) break;
      k = e.to;
      h++;
    }
    gateway.push(k);
    hops.push(h);
  }
  const gates = [...new Set(gateway)].sort((a, b) => (bearing(ossXY, xy[a]) % 360) - (bearing(ossXY, xy[b]) % 360));
  const stringOf = new Map(gates.map((g, s) => [g, fixedString ? fixedString[g] : s + 1]));
  const rows: RegisterRow[] = ids.map((id, i) => {
    const e = up.get(i);
    const s = stringOf.get(gateway[i]) ?? 0;
    return {
      id,
      lon: pts[i][0],
      lat: pts[i][1],
      string: s,
      bay: bayName(s),
      upstream: !e || e.to < 0 ? "OSS" : ids[e.to],
      section: e?.section?.id ?? null,
      cableKm: e ? e.lengthM / 1000 : 0,
      load: e?.load ?? 1,
    };
  });
  const order = ids.map((_, i) => i).sort((a, b) => rows[a].string - rows[b].string || hops[a] - hops[b]);
  const numbers = [...stringOf.values()].sort((a, b) => a - b);
  const strings = numbers.map((n) => rows.filter((r) => r.string === n).length);
  return { rows: order.map((i) => rows[i]), strings };
}

/** SB-510: strings run N–S; each is a chain whose end nearest the OSS is the gateway. */
function sb510Edges(xy: XY[], ossXY: XY): CableEdge[] {
  const edges: CableEdge[] = [];
  const groups = new Map<number, number[]>();
  TURBINE_POSITIONS.forEach((t, i) => groups.set(t.stringNumber, [...(groups.get(t.stringNumber) ?? []), i]));
  for (const members of groups.values()) {
    const chain = [...members].sort((a, b) => TURBINE_POSITIONS[b].lat - TURBINE_POSITIONS[a].lat);
    if (dist(xy[chain[chain.length - 1]], ossXY) < dist(xy[chain[0]], ossXY)) chain.reverse();
    // chain[0] is the gateway
    chain.forEach((i, k) => {
      const to = k === 0 ? -1 : chain[k - 1];
      const load = chain.length - k;
      const lengthM = dist(xy[i], to < 0 ? ossXY : xy[to]);
      edges.push({ from: i, to, load, lengthM, section: sectionFor(load, RATED_MW) });
    });
  }
  return edges;
}

/** True when the turbines are SB-510's 34, unmoved (reference case, or an untouched "From SB-510" copy). */
export const isSb510Layout = (t: { id: string; lon: number; lat: number }[]) =>
  t.length === TURBINE_POSITIONS.length &&
  t.every((x, i) => x.id === TURBINE_POSITIONS[i].id && x.lon === TURBINE_POSITIONS[i].lon && x.lat === TURBINE_POSITIONS[i].lat);

/**
 * SB-510's designed array (6 radial strings, 6-6-6-6-5-5, as P2/P3/P5) instead
 * of the Layout page's automatic router, which would split it differently.
 * `xy` in TURBINE_POSITIONS order.
 */
export function sb510Cables(xy: XY[], ossXY: XY): CableResult {
  const edges = sb510Edges(xy, ossXY);
  const kmBySection: Record<string, number> = {};
  for (const e of edges) kmBySection[e.section?.id ?? "over"] = (kmBySection[e.section?.id ?? "over"] ?? 0) + e.lengthM / 1000;
  return {
    edges,
    strings: new Set(TURBINE_POSITIONS.map((t) => t.stringNumber)).size,
    totalKm: edges.reduce((s, e) => s + e.lengthM, 0) / 1000,
    kmBySection,
    crossings: 0,
    mstKm: mstLength(ossXY, xy) / 1000,
  };
}

interface ProjectLike {
  turbines: { id: string; lon: number; lat: number }[];
  oss: LonLat | null;
}

interface SiteLike {
  site: LonLat[] | null;
  /** Length of the checked export route [km], if any. */
  routeKm?: number | null;
  report: { grid_km: number | null; depth_m: [number, number] | null; ports?: SitePort[] } | null;
}

/** The learner's project when it has turbines and an OSS, else SB-510. */
export function farmPlan(project: ProjectLike, site: SiteLike): FarmPlan {
  const own = project.turbines.length > 0 && project.oss != null;
  const ids = own ? project.turbines.map((t) => t.id) : TURBINE_POSITIONS.map((t) => t.id);
  const pts: LonLat[] = own ? project.turbines.map((t) => [t.lon, t.lat]) : TURBINE_POSITIONS.map((t) => [t.lon, t.lat]);
  const oss: LonLat = own && project.oss ? project.oss : [OSS_GEO.lon, OSS_GEO.lat];
  const proj = projection(centroid([...pts, oss]));
  const xy = pts.map(proj.toXY);
  const ossXY = proj.toXY(oss);
  let edges: CableEdge[];
  let crossings = 0;
  if (own) {
    const c = routeCables(ossXY, xy, RATED_MW);
    edges = c.edges;
    crossings = c.crossings;
  } else {
    edges = sb510Edges(xy, ossXY);
  }
  // SB-510 keeps its own string numbers (WTG-01 … WTG-06 = S1), as on the P3/P5 pages
  const fixed = own ? undefined : TURBINE_POSITIONS.map((t) => t.stringNumber);
  const { rows, strings } = registerFromTree(ids, pts, xy, ossXY, edges, fixed);
  const kmBySection: Record<string, number> = {};
  for (const e of edges) {
    const k = e.section?.id ?? "over";
    kmBySection[k] = (kmBySection[k] ?? 0) + e.lengthM / 1000;
  }
  const depthM = own ? (site.report?.depth_m ?? null) : SB510_DEPTH_M;
  return {
    source: own ? "project" : "sb510",
    name: own ? "Your layout project" : "SB-510 reference farm",
    turbines: rows,
    oss,
    strings,
    arrayKm: edges.reduce((s, e) => s + e.lengthM, 0) / 1000,
    kmBySection,
    exportKm: own ? defaultExportKm(site.report?.grid_km, site.routeKm) : SB510_EXPORT_KM,
    depthM,
    foundation: foundationFor(depthM),
    capacityMW: ids.length * RATED_MW,
    crossings,
    installPort: own ? nearestPort(site.report?.ports, "installation") : SB510_PORTS.installation,
    omPort: own ? nearestPort(site.report?.ports, "O&M") : SB510_PORTS.om,
  };
}

/** Campaign request for this farm (backend limits: ≤ 150 turbines, ≤ 12 per string). */
export function campaignRequest(
  f: FarmPlan,
  o: Pick<CampaignRequest, "mode" | "start_date" | "alpha" | "runs"> & Partial<CampaignRequest>,
): CampaignRequest {
  const strings = f.strings.every((n) => n >= 1 && n <= 12) ? f.strings : undefined;
  return {
    n_turbines: f.turbines.length,
    strings,
    array_km: Math.max(0.1, Math.round(f.arrayKm * 10) / 10),
    export_km: Math.min(300, Math.max(1, Math.round(f.exportKm))),
    foundation: f.foundation,
    ...(f.installPort ? { port_km: Math.round(f.installPort.km * 10) / 10 } : {}),
    ...o,
  };
}
