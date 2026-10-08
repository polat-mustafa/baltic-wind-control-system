/**
 * One-shot evaluation of a layout project: the numbers the layout canvas
 * shows (capacity, screening yield, array cables, cost, LCOE) and the
 * turbines that break a constraint. Used by the Academy layout challenge so
 * it scores exactly what the canvas displays.
 */

import type { LayersResponse } from "../../services/siteApi";
import { routeCables, type CableResult } from "./cables";
import { layoutCost, type CostInputs, type CostResult } from "./cost";
import { layoutYield, UNIFORM_ROSE, type WindRose, type YieldResult } from "./energy";
import { centroid, insidePolygon, minSpacing, projection, type LonLat } from "./geometry";
import { SB510_EXPORT_KM } from "../../constants/windFarmLayout";
import { REFERENCE_TURBINE, turbineById } from "../../utils/turbineCurves";

/** Reference turbine (IEA 15 MW, "V236 class"): rotor diameter [m] and rating [MW]. */
export const D = REFERENCE_TURBINE.rotorDiameterM;
export const RATED_MW = REFERENCE_TURBINE.ratedKw / 1000;
/** Teaching default for the spacing warning (illustrative; projects use 4–10 D by direction). */
export const MIN_SPACING_D = 4;
/** Availability + electrical losses applied to the wake-only AEP for the LCOE (illustrative). */
export const OTHER_LOSSES = 0.08;
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
