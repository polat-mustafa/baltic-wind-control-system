/**
 * Move suggestions for the layout canvas: try small moves of the most waked
 * turbines and keep the ones that lower the LCOE.
 *
 * Candidates: the `worst` turbines by wake loss × 8 compass directions ×
 * {0.5, 1, 2} D. A candidate must stay inside the site, out of constraint
 * areas and inside an energy basin, ≥ MIN_SPACING_D from every other turbine,
 * clear of existing subsea cables by the screening buffer, and its own array
 * cables must not cross the others. Score: ΔLCOE from the yield change
 * (moveDelta, exact for the screening model) and the length of the moved
 * turbine's own cables with the strings unchanged (re-routing the whole tree
 * would mix in the greedy heuristic's jumps); ties → ΔAEP.
 * The best move per turbine is kept; PyWake checks the top five on the backend
 * (POST /api/v1/wind/wake-moves).
 */

import type { CableResult } from "./cables";
import { layoutCost, type CostInputs } from "./cost";
import { moveDelta, yieldOf, type YieldModel } from "./energy";
import { MIN_SPACING_D, OTHER_LOSSES, statusAt, type LayoutContext } from "./evaluate";
import { dist, distToSegment, segmentsCross, type XY } from "./geometry";

export interface MoveSuggestion {
  index: number;
  id: string;
  to: XY;
  distM: number;
  /** Direction of the move [° from north]. */
  bearingDeg: number;
  /** Farm net AEP change, wake only [GWh/yr] and [%]. */
  deltaGWh: number;
  deltaPct: number;
  /** Array cable length change [km]. */
  deltaCableKm: number;
  /** LCOE change [€/MWh] (negative = cheaper energy). */
  deltaLcoe: number;
}

export interface SuggestInput {
  ctx: LayoutContext;
  model: YieldModel;
  ids: string[];
  oss: XY | null;
  /** The array cable tree of the current layout (null without an OSS). */
  tree: CableResult | null;
  costs: CostInputs;
  exportKm: number;
  maxDepthM: number | null;
  /** Existing subsea cables (local metres) and the buffer to keep from them [m]. */
  cables: XY[][];
  cableBufferM: number;
}

const BEARINGS = [0, 45, 90, 135, 180, 225, 270, 315];
const STEPS_D = [0.5, 1, 2];

function clearOfCables(p: XY, lines: XY[][], buffer: number): boolean {
  for (const l of lines) for (let k = 1; k < l.length; k++) if (distToSegment(p, l[k - 1], l[k]) < buffer) return false;
  return true;
}

export function suggestMoves(s: SuggestInput, worst = 10, top = 5): MoveSuggestion[] {
  const { ctx, model, oss } = s;
  const t = model.t;
  if (t.length < 2) return [];
  const base = yieldOf(model);
  const ratedMW = model.model.ratedKw / 1000;
  const capacity = t.length * ratedMW;
  const lcoe = (netGWh: number, cableKm: number) =>
    layoutCost(s.costs, capacity, cableKm, s.exportKm, s.maxDepthM, netGWh * (1 - OTHER_LOSSES)).lcoe ?? 0;
  const baseKm = s.tree?.totalKm ?? 0;
  const at = (k: number) => (k < 0 ? oss! : t[k]);
  /** Cable segments of the tree touching turbine i: [i, other end]. */
  const ownEdges = (i: number) => (s.tree?.edges ?? []).filter((e) => e.from === i || e.to === i).map((e) => (e.from === i ? e.to : e.from));
  const restEdges = (i: number) => (s.tree?.edges ?? []).filter((e) => e.from !== i && e.to !== i);
  const baseLcoe = lcoe(base.netGWh, baseKm);
  const order = base.perTurbineLossPct
    .map((loss, i) => ({ loss, i }))
    .sort((a, b) => b.loss - a.loss)
    .slice(0, worst);

  const best = new Map<number, MoveSuggestion>();
  for (const { i } of order) {
    const others = t.filter((_, j) => j !== i);
    const ends = oss ? ownEdges(i) : [];
    const rest = oss ? restEdges(i) : [];
    const ownKm = ends.reduce((sum, k) => sum + dist(t[i], at(k)), 0) / 1000;
    for (const b of BEARINGS)
      for (const step of STEPS_D) {
        const th = (b * Math.PI) / 180;
        const distM = step * ctx.d;
        const to = { x: t[i].x + distM * Math.sin(th), y: t[i].y + distM * Math.cos(th) };
        if (others.some((q) => dist(q, to) < MIN_SPACING_D * ctx.d)) continue;
        if (statusAt(ctx, ctx.proj.toLonLat(to), others).status !== "ok") continue;
        if (!clearOfCables(to, s.cables, s.cableBufferM)) continue;
        const effect = moveDelta(model, i, to);
        if (effect.deltaGWh <= 0) continue;
        if (ends.some((k) => rest.some((e) => segmentsCross(to, at(k), at(e.from), at(e.to))))) continue;
        const cableKm = baseKm - ownKm + ends.reduce((sum, k) => sum + dist(to, at(k)), 0) / 1000;
        const cand: MoveSuggestion = {
          index: i,
          id: s.ids[i],
          to,
          distM,
          bearingDeg: b,
          deltaGWh: effect.deltaGWh,
          deltaPct: (100 * effect.deltaGWh) / base.netGWh,
          deltaCableKm: cableKm - baseKm,
          deltaLcoe: lcoe(base.netGWh + effect.deltaGWh, cableKm) - baseLcoe,
        };
        const prev = best.get(i);
        if (!prev || cand.deltaLcoe < prev.deltaLcoe) best.set(i, cand);
      }
  }
  return [...best.values()]
    .filter((m) => m.deltaLcoe < 0)
    .sort((a, b) => a.deltaLcoe - b.deltaLcoe || b.deltaGWh - a.deltaGWh)
    .slice(0, top);
}
