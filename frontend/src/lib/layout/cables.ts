/**
 * Array cable routing: capacity-constrained tree from the offshore
 * substation (OSS) to every turbine.
 *
 * Esau–Williams heuristic (Esau & Williams 1966, "On teleprocessing system
 * design, part II", IBM Systems Journal 5(3)): start with every turbine on
 * its own string to the OSS; repeatedly join the string whose gateway gains
 * most by connecting to a nearby turbine instead of the OSS, if the joined
 * string stays within the cable capacity. A plain minimum spanning tree
 * (Prim) is the lower bound on length it is compared with.
 *
 * A join that would cross an existing cable is skipped.
 *
 * Cable sections: 66 kV 3-core Cu XLPE, ratings from the P2 network model
 * (backend/app/services/p2/network_model.py, IEC 60287 typical values).
 * Current at unity power factor: I = n·P / (√3·U).
 */

import { dist, segmentsCross, type XY } from "./geometry";

export interface CableSection {
  id: string;
  label: string;
  /** Continuous current rating [A]. */
  imax: number;
}

export const ARRAY_SECTIONS: CableSection[] = [
  { id: "500", label: "66 kV 500 mm²", imax: 715 },
  { id: "630", label: "66 kV 630 mm²", imax: 818 },
  { id: "800", label: "66 kV 800 mm²", imax: 900 },
];

export const ARRAY_KV = 66;

/** Current [A] of n turbines of `mw` each at unity power factor. */
export const stringCurrent = (n: number, mw: number) => (n * mw * 1e6) / (Math.sqrt(3) * ARRAY_KV * 1e3);

/** Most turbines one string can carry on the largest section. */
export function maxPerString(mw: number): number {
  const top = ARRAY_SECTIONS[ARRAY_SECTIONS.length - 1].imax;
  return Math.max(1, Math.floor(top / stringCurrent(1, mw)));
}

/** Smallest section that carries n turbines, or null if none does. */
export function sectionFor(n: number, mw: number): CableSection | null {
  const i = stringCurrent(n, mw);
  return ARRAY_SECTIONS.find((s) => s.imax >= i) ?? null;
}

export interface CableEdge {
  /** Turbine index, the far end. */
  from: number;
  /** Turbine index, or -1 for the OSS. */
  to: number;
  /** Turbines carried by this segment (its own and everything beyond). */
  load: number;
  lengthM: number;
  section: CableSection | null;
}

export interface CableResult {
  edges: CableEdge[];
  strings: number;
  totalKm: number;
  kmBySection: Record<string, number>;
  crossings: number;
  /** Minimum spanning tree length [km], the unconstrained lower bound. */
  mstKm: number;
}

/** Prim's MST over OSS + turbines; total length [m]. */
export function mstLength(oss: XY, t: XY[]): number {
  const pts = [oss, ...t];
  const n = pts.length;
  const inTree = new Array<boolean>(n).fill(false);
  const best = new Array<number>(n).fill(Infinity);
  best[0] = 0;
  let total = 0;
  for (let k = 0; k < n; k++) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!inTree[i] && (u < 0 || best[i] < best[u])) u = i;
    inTree[u] = true;
    total += best[u];
    for (let i = 0; i < n; i++) if (!inTree[i]) best[i] = Math.min(best[i], dist(pts[u], pts[i]));
  }
  return total;
}

export function routeCables(oss: XY, t: XY[], mw: number): CableResult {
  const n = t.length;
  const cap = maxPerString(mw);
  const comp = t.map((_, i) => i); // component representative
  const gateway = new Map<number, number>(t.map((_, i) => [i, i])); // component → turbine linked to the OSS
  const size = new Map<number, number>(t.map((_, i) => [i, 1]));
  const links: [number, number][] = [];
  const blocked = new Set<number>();

  const crosses = (i: number, j: number, droppedGateway: number) => {
    for (const [a, b] of links) if (segmentsCross(t[i], t[j], t[a], t[b])) return true;
    for (const g of gateway.values()) if (g !== droppedGateway && segmentsCross(t[i], t[j], t[g], oss)) return true;
    return false;
  };

  for (;;) {
    let best: { gain: number; i: number; j: number } | null = null;
    for (let i = 0; i < n; i++) {
      const ci = comp[i];
      const save = dist(t[gateway.get(ci)!], oss);
      for (let j = 0; j < n; j++) {
        const cj = comp[j];
        if (ci === cj || blocked.has(i * n + j)) continue;
        if (size.get(ci)! + size.get(cj)! > cap) continue;
        const gain = save - dist(t[i], t[j]);
        if (gain > 1e-6 && (!best || gain > best.gain)) best = { gain, i, j };
      }
    }
    if (!best) break;
    const { i, j } = best;
    const ci = comp[i];
    const cj = comp[j];
    if (crosses(i, j, gateway.get(ci)!)) {
      blocked.add(i * n + j);
      continue;
    }
    links.push([i, j]);
    for (let k = 0; k < n; k++) if (comp[k] === ci) comp[k] = cj;
    size.set(cj, size.get(ci)! + size.get(cj)!);
    size.delete(ci);
    gateway.delete(ci);
  }

  // Orient each string from its gateway outwards, then count the turbines beyond each segment.
  const adj: number[][] = t.map(() => []);
  for (const [a, b] of links) {
    adj[a].push(b);
    adj[b].push(a);
  }
  const parent = new Array<number>(n).fill(-1);
  const order: number[] = [];
  for (const g of gateway.values()) {
    const stack = [g];
    const seen = new Set([g]);
    while (stack.length) {
      const u = stack.pop()!;
      order.push(u);
      for (const w of adj[u])
        if (!seen.has(w)) {
          seen.add(w);
          parent[w] = u;
          stack.push(w);
        }
    }
  }
  const load = new Array<number>(n).fill(1);
  for (let k = order.length - 1; k >= 0; k--) {
    const u = order[k];
    if (parent[u] >= 0) load[parent[u]] += load[u];
  }

  const pos = (k: number) => (k < 0 ? oss : t[k]);
  const edges: CableEdge[] = t.map((_, k) => ({
    from: k,
    to: parent[k],
    load: load[k],
    lengthM: dist(t[k], pos(parent[k])),
    section: sectionFor(load[k], mw),
  }));
  const kmBySection: Record<string, number> = {};
  for (const e of edges) {
    const id = e.section?.id ?? "over";
    kmBySection[id] = (kmBySection[id] ?? 0) + e.lengthM / 1000;
  }
  let crossings = 0;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      if (segmentsCross(t[a], pos(parent[a]), t[b], pos(parent[b]))) crossings++;

  return {
    edges,
    strings: gateway.size,
    totalKm: edges.reduce((s, e) => s + e.lengthM, 0) / 1000,
    kmBySection,
    crossings,
    mstKm: mstLength(oss, t) / 1000,
  };
}
