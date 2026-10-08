/**
 * One-shot evaluation of a layout project: the numbers the layout canvas
 * shows (capacity, screening yield, array cables, cost, LCOE) and the
 * turbines that break a constraint. Used by the Academy layout challenge so
 * it scores exactly what the canvas displays.
 */

import type { LayersResponse, RasterResponse } from "../../services/siteApi";
import { routeCables, type CableResult } from "./cables";
import { layoutCost, type CostInputs, type CostResult } from "./cost";
import { layoutYield, moveDelta, UNIFORM_ROSE, type WindRose, type YieldModel, type YieldResult } from "./energy";
import { bearing, centroid, dist, insidePolygon, minSpacing, projection, type LonLat, type Projection, type XY } from "./geometry";
import { SB510_EXPORT_KM } from "../../constants/windFarmLayout";
import { REFERENCE_TURBINE, turbineById } from "../../utils/turbineCurves";

/** Reference turbine (IEA 15 MW, "V236 class"): rotor diameter [m] and rating [MW]. */
export const D = REFERENCE_TURBINE.rotorDiameterM;
export const RATED_MW = REFERENCE_TURBINE.ratedKw / 1000;
/** Teaching default for the spacing warning (illustrative; projects use 4–10 D by direction). */
export const MIN_SPACING_D = 4;
/**
 * Losses after wake for the LCOE: the P1 cascade defaults (backend
 * `aep_calculator.LOSS_SOURCES`: electrical 2 %, availability 5 %, environmental 1 %),
 * multiplied — 1 − 0.98 · 0.95 · 0.99 = 7.8 %. Blockage is not modelled here.
 */
export const OTHER_LOSSES = 1 - (1 - 0.02) * (1 - 0.05) * (1 - 0.01);
/** Site Weibull used by the canvas (P1 SB-510 hub-height fit). */
export const WEIBULL_A = 10.5;
export const WEIBULL_K = 2.2;
/** Layers a turbine may not stand in ("owf" = outlines of real wind farms). */
export const EXCLUDING_ROLES = ["protected", "shipping", "restricted", "owf"];

export type Ring = LonLat[];

export function inRing(p: LonLat, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Polygons of the constraint layers a turbine may not stand in. */
export function exclusionRings(layers: LayersResponse | null): { name: string; role: string; ring: Ring }[] {
  const out: { name: string; role: string; ring: Ring }[] = [];
  for (const l of layers?.layers ?? [])
    if (EXCLUDING_ROLES.includes(l.role))
      for (const f of l.features) if (f.geometry.type === "Polygon") out.push({ name: f.name, role: l.role, ring: f.geometry.coordinates[0] });
  return out;
}

/** Energy basins of the maritime spatial plan: in Poland the only sea areas open to offshore wind. */
export function energyRings(layers: LayersResponse | null): Ring[] {
  return (layers?.layers ?? [])
    .filter((l) => l.role === "msp_energy")
    .flatMap((l) => l.features.filter((f) => f.geometry.type === "Polygon").map((f) => f.geometry.coordinates[0] as Ring));
}

export const OUTSIDE_ENERGY_BASIN = "outside the plan's energy basins";

/** Why a turbine position is not allowed (constraint name), or null when it is. */
export function blockedBy(p: LonLat, rings: { name: string; ring: Ring }[], energy: Ring[]): string | null {
  const hit = rings.find((r) => inRing(p, r.ring));
  if (hit) return `inside ${hit.name}`;
  if (energy.length > 0 && !energy.some((r) => inRing(p, r))) return OUTSIDE_ENERGY_BASIN;
  return null;
}

/** Turbine position state on the canvas, worst first: outside > excluded > basin > close > ok. */
export type TurbineStatus = "ok" | "close" | "outside" | "excluded" | "basin";

/** What a position is checked against: site, constraint areas, energy basins, rotor diameter. */
export interface LayoutContext {
  proj: Projection;
  siteXY: XY[];
  rings: { name: string; role: string; ring: Ring }[];
  energy: Ring[];
  d: number;
}

export function layoutContext(site: LonLat[], layers: LayersResponse | null, d = D): LayoutContext {
  const proj = projection(centroid(site));
  return { proj, siteXY: site.map(proj.toXY), rings: exclusionRings(layers), energy: energyRings(layers), d };
}

/** Status of a turbine at `p` given the other turbines (local metres), with a one-line reason. */
export function statusAt(ctx: LayoutContext, p: LonLat, others: XY[]): { status: TurbineStatus; note: string; nearestM: number } {
  const xy = ctx.proj.toXY(p);
  const nearestM = Math.min(Infinity, ...others.map((q) => dist(q, xy)));
  if (!insidePolygon(xy, ctx.siteXY)) return { status: "outside", note: "outside the site boundary", nearestM };
  const why = blockedBy(p, ctx.rings, ctx.energy);
  if (why === OUTSIDE_ENERGY_BASIN) return { status: "basin", note: why, nearestM };
  if (why) return { status: "excluded", note: why, nearestM };
  if (nearestM < MIN_SPACING_D * ctx.d) return { status: "close", note: `${(nearestM / ctx.d).toFixed(1)} D to the nearest turbine`, nearestM };
  return { status: "ok", note: "", nearestM };
}

/** Bilinear sampler of a raster band (null outside the grid or next to no-data), like the backend's Raster.sample. */
export function rasterSampler(r: RasterResponse | null, band = "values"): (p: LonLat) => number | null {
  const v = r?.bands[band];
  if (!r || !v?.length) return () => null;
  const ny = v.length;
  const nx = v[0].length;
  return ([lon, lat]) => {
    const fx = (lon - r.lon0) / r.dlon;
    const fy = (lat - r.lat0) / r.dlat;
    if (fx < 0 || fy < 0 || fx > nx - 1 || fy > ny - 1) return null;
    const i = Math.min(Math.floor(fx), Math.max(nx - 2, 0));
    const j = Math.min(Math.floor(fy), Math.max(ny - 2, 0));
    const tx = fx - i;
    const ty = fy - j;
    const c = [v[j][i], v[j][i + 1] ?? null, v[j + 1]?.[i] ?? null, v[j + 1]?.[i + 1] ?? null];
    if (c.some((x) => x == null)) return null;
    const [a, b, e, f] = c as number[];
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + e * (1 - tx) * ty + f * tx * ty;
  };
}

/** Foundation type for a water depth from the criteria's depth bands (null outside them). */
export function foundationFor(depthM: number | null, bands: LayersResponse["depth_bands"] | undefined): string | null {
  if (depthM == null) return null;
  return bands?.find((b) => b.min_m <= depthM && depthM < b.max_m)?.foundation ?? null;
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export const compass = (deg: number) => COMPASS[Math.round(deg / 45) % 8];

export interface Neighbour {
  id: string;
  m: number;
  d: number;
  /** Bearing from the turbine to the neighbour [° from north]. */
  bearing: number;
}

/** The `n` nearest other turbines of `p`. */
export function nearest(p: XY, xy: XY[], ids: string[], skip: number, d: number, n = 2): Neighbour[] {
  return xy
    .map((q, j) => ({ id: ids[j], m: dist(p, q), d: dist(p, q) / d, bearing: bearing(p, q), j }))
    .filter((x) => x.j !== skip)
    .sort((a, b) => a.m - b.m)
    .slice(0, n)
    .map(({ id, m, d: dd, bearing: b }) => ({ id, m, d: dd, bearing: b }));
}

/** Teaching threshold for a "heavily waked" turbine (illustrative). */
export const HIGH_WAKE_LOSS_PCT = 12;

/** Warnings for one turbine: its position status, depth band and wake loss. */
export function turbineWarnings(status: { status: TurbineStatus; note: string }, depthM: number | null, foundation: string | null, lossPct: number): string[] {
  const w: string[] = [];
  if (status.status !== "ok") w.push(status.note);
  if (depthM == null) w.push("water depth unknown here");
  else if (!foundation) w.push(`${depthM.toFixed(0)} m is outside the screening depth bands`);
  else if (/floating/.test(foundation)) w.push(`${depthM.toFixed(0)} m: floating foundation`);
  if (lossPct > HIGH_WAKE_LOSS_PCT) w.push(`wake loss above ${HIGH_WAKE_LOSS_PCT} %: a move may pay`);
  return w;
}

export interface TurbineStats {
  id: string;
  status: TurbineStatus;
  /** Net AEP, wake only [GWh/yr]; wake loss [%]. */
  netGWh: number;
  lossPct: number;
  /** Farm net AEP change of a move in progress [GWh/yr], null when not moving. */
  deltaGWh: number | null;
  /** Mean hub-height speed: free stream and in the farm's wakes [m/s]. */
  freeMs: number;
  wakedMs: number;
  neighbours: Neighbour[];
  depthM: number | null;
  foundation: string | null;
  warnings: string[];
}

/** Card data for turbine `i`, at its place or (while dragged) at `at`. */
export function turbineStats(
  ctx: LayoutContext,
  model: YieldModel,
  ids: string[],
  i: number,
  at: LonLat | null,
  depthAt: (p: LonLat) => number | null,
  bands: LayersResponse["depth_bands"] | undefined,
): TurbineStats {
  const p = at ?? ctx.proj.toLonLat(model.t[i]);
  const xy = ctx.proj.toXY(p);
  const move = at ? moveDelta(model, i, xy) : null;
  const lossPct = move ? move.turbineLossPct : model.grossOneMWh > 0 ? 100 * (1 - model.netMWh[i] / model.grossOneMWh) : 0;
  const st = statusAt(ctx, p, model.t.filter((_, j) => j !== i));
  const depthM = depthAt(p);
  const foundation = foundationFor(depthM, bands);
  return {
    id: ids[i],
    status: st.status,
    netGWh: move ? move.turbineGWh : model.netMWh[i] / 1000,
    lossPct,
    deltaGWh: move ? move.deltaGWh : null,
    freeMs: model.freeMeanMs,
    wakedMs: move ? move.turbineMeanMs : model.meanMs[i],
    neighbours: nearest(xy, model.t, ids, i, ctx.d),
    depthM,
    foundation,
    warnings: turbineWarnings(st, depthM, foundation, lossPct),
  };
}

/** Export cable length: straight line to the grid node + 10 % routing, SB-510's without a report. */
export const defaultExportKm = (gridKm: number | null | undefined) => (gridKm != null ? Math.round(gridKm * 1.1) : SB510_EXPORT_KM);

export interface LayoutInput {
  site: LonLat[];
  turbines: { lon: number; lat: number }[];
  oss: LonLat | null;
  costs: CostInputs;
  layers: LayersResponse | null;
  /** Upper water depth of the site [m] (foundation type), null if unknown. */
  maxDepthM: number | null;
  exportKm: number;
  rose?: WindRose;
  /** Turbine model id (constants/turbineModels.ts); default the IEA 15 MW reference. */
  turbineId?: string;
}

export interface LayoutEvaluation {
  count: number;
  capacityMW: number;
  outside: number;
  excluded: number;
  /** Turbines closer than MIN_SPACING_D to their nearest neighbour. */
  close: number;
  minSpacingD: number | null;
  yield: YieldResult | null;
  /** Net AEP after wake and other losses [GWh]. */
  netGWh: number;
  cables: CableResult | null;
  cost: CostResult;
}

/** Turbines outside the site, in a constraint area (inside the site) or closer than MIN_SPACING_D. */
export function layoutProblems(
  site: LonLat[],
  turbines: { lon: number; lat: number }[],
  layers: LayersResponse | null,
  d = D,
): { outside: number; excluded: number; close: number } {
  const proj = projection(centroid(site));
  const siteXY = site.map(proj.toXY);
  const xy = turbines.map((t) => proj.toXY([t.lon, t.lat]));
  const rings = exclusionRings(layers);
  const energy = energyRings(layers);
  const inside = xy.map((p) => insidePolygon(p, siteXY));
  return {
    outside: inside.filter((v) => !v).length,
    excluded: turbines.filter((t, k) => inside[k] && blockedBy([t.lon, t.lat], rings, energy) !== null).length,
    close: xy.filter((p, a) => xy.some((q, b) => b !== a && Math.hypot(p.x - q.x, p.y - q.y) < MIN_SPACING_D * d)).length,
  };
}

export function evaluateLayout(i: LayoutInput): LayoutEvaluation {
  const proj = projection(centroid(i.site));
  const xy = i.turbines.map((t) => proj.toXY([t.lon, t.lat]));
  const model = turbineById(i.turbineId);
  const d = model.rotorDiameterM;
  const ratedMW = model.ratedKw / 1000;
  const yieldRes = xy.length ? layoutYield(xy, WEIBULL_A, WEIBULL_K, i.rose ?? UNIFORM_ROSE, model) : null;
  const cables = i.oss && xy.length ? routeCables(proj.toXY(i.oss), xy, ratedMW) : null;
  const spacing = minSpacing(xy);
  const capacityMW = xy.length * ratedMW;
  const netGWh = (yieldRes?.netGWh ?? 0) * (1 - OTHER_LOSSES);
  return {
    count: xy.length,
    capacityMW,
    ...layoutProblems(i.site, i.turbines, i.layers, d),
    minSpacingD: spacing ? spacing.m / d : null,
    yield: yieldRes,
    netGWh,
    cables,
    cost: layoutCost(i.costs, capacityMW, cables?.totalKm ?? 0, i.exportKm, i.maxDepthM, netGWh),
  };
}
