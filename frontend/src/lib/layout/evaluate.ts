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

export const D = 236; // V236 rotor diameter [m]
export const RATED_MW = 15;
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

/** Export cable length: straight line to the grid node + 10 % routing, 45 km (SB-510) without a report. */
export const defaultExportKm = (gridKm: number | null | undefined) => (gridKm != null ? Math.round(gridKm * 1.1) : 45);

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

export function evaluateLayout(i: LayoutInput): LayoutEvaluation {
  const proj = projection(centroid(i.site));
  const siteXY = i.site.map(proj.toXY);
  const xy = i.turbines.map((t) => proj.toXY([t.lon, t.lat]));
  const rings = exclusionRings(i.layers);
  const energy = energyRings(i.layers);
  const yieldRes = xy.length ? layoutYield(xy, WEIBULL_A, WEIBULL_K, i.rose ?? UNIFORM_ROSE) : null;
  const cables = i.oss && xy.length ? routeCables(proj.toXY(i.oss), xy, RATED_MW) : null;
  const spacing = minSpacing(xy);
  let close = 0;
  xy.forEach((p, a) => {
    if (xy.some((q, b) => b !== a && Math.hypot(p.x - q.x, p.y - q.y) < MIN_SPACING_D * D)) close++;
  });
  const inside = xy.map((p) => insidePolygon(p, siteXY));
  const capacityMW = xy.length * RATED_MW;
  const netGWh = (yieldRes?.netGWh ?? 0) * (1 - OTHER_LOSSES);
  return {
    count: xy.length,
    capacityMW,
    outside: inside.filter((v) => !v).length,
    excluded: i.turbines.filter((t, k) => inside[k] && blockedBy([t.lon, t.lat], rings, energy) !== null).length,
    close,
    minSpacingD: spacing ? spacing.m / D : null,
    yield: yieldRes,
    netGWh,
    cables,
    cost: layoutCost(i.costs, capacityMW, cables?.totalKm ?? 0, i.exportKm, i.maxDepthM, netGWh),
  };
}
