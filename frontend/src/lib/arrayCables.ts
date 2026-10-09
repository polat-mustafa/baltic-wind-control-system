/**
 * 66 kV array cables of a fleet: every section from turbine to turbine (or to
 * the OSS) with its map geometry and straight length, cached per fleet. Each
 * section carries the live output of every turbine beyond it on the string
 * (lib/fleet arraySegments), on the backend's graded cable (500/630/800/1000 mm²,
 * utils/landingPhysics arrayCableGrade).
 */

import { arraySegments, type ArraySegment, type Fleet } from "./fleet";

/** Load colour of a cable (IEC 60287 rating): < 70 % normal · 70–95 % warning · ≥ 95 % alarm. */
export function loadColor(loadFrac: number): string {
  if (loadFrac < 0.7) return "#4cc38a";
  if (loadFrac < 0.95) return "#f0b13e";
  return "#f25c54";
}

/** A clicked array-cable segment: its string and the turbines it carries. */
export interface CableFocus extends ArraySegment {
  lengthKm: number;
}

export interface CableTree {
  segments: CableFocus[];
  pos: Map<string, { lat: number; lon: number }>;
  /** Section geometry as [lat, lon] points, turbine to turbine (or OSS). */
  path: (s: CableFocus) => [number, number][];
  stringSize: (n: number) => number;
}

/** Great-circle distance [m] (haversine, mean Earth radius). */
export function distanceM(a: [number, number], b: [number, number]): number {
  const R = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const treeCache = new WeakMap<Fleet, CableTree>();

/** Array cable sections of a fleet with their map geometry (cached per fleet). */
export function cableTree(f: Fleet): CableTree {
  const hit = treeCache.get(f);
  if (hit) return hit;
  const pos = new Map<string, { lat: number; lon: number }>(f.turbines.map((t) => [t.id, t]));
  pos.set("OSS", f.oss);
  const at = (id: string) => pos.get(id)!;
  const route = (s: ArraySegment): [number, number][] =>
    [at(s.fromId), ...s.via, at(s.toId)].map((p) => [p.lat, p.lon]);
  const segments = arraySegments(f).map((s) => {
    const pts = route(s);
    const m = pts.slice(1).reduce((sum, p, i) => sum + distanceM(pts[i], p), 0);
    return { ...s, lengthKm: m / 1000 };
  });
  const tree = {
    segments,
    pos,
    path: route,
    stringSize: (n: number) => f.strings[n - 1]?.length ?? 1,
  };
  treeCache.set(f, tree);
  return tree;
}
