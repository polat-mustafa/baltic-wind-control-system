/**
 * Plane geometry for the layout canvas.
 *
 * Positions are projected to local metres (x east, y north) with an
 * equirectangular projection about the site centroid — within ±1 % over a
 * site a few tens of km across, the same approximation the backend uses
 * (services/site_assessment/geo.py).
 */

export type LonLat = [number, number];
export interface XY {
  x: number;
  y: number;
}

const M_PER_DEG = 111_320;

export interface Projection {
  toXY: (p: LonLat) => XY;
  toLonLat: (p: XY) => LonLat;
}

export function projection(origin: LonLat): Projection {
  const kx = M_PER_DEG * Math.cos((origin[1] * Math.PI) / 180);
  return {
    toXY: ([lon, lat]) => ({ x: (lon - origin[0]) * kx, y: (lat - origin[1]) * M_PER_DEG }),
    toLonLat: ({ x, y }) => [origin[0] + x / kx, origin[1] + y / M_PER_DEG],
  };
}

export function centroid(poly: LonLat[]): LonLat {
  const n = poly.length || 1;
  return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
}

/** Ray casting; points on the edge may fall either way. */
export function insidePolygon(p: XY, poly: XY[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Shoelace area [m²]. */
export function polygonArea(poly: XY[]): number {
  let s = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) s += poly[j].x * poly[i].y - poly[i].x * poly[j].y;
  return Math.abs(s) / 2;
}

export const dist = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y);

const cross = (o: XY, a: XY, b: XY) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** Proper crossing of segments ab and cd (shared end points do not count). */
export function segmentsCross(a: XY, b: XY, c: XY, d: XY): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Smallest centre-to-centre distance and the pair that has it. */
export function minSpacing(points: XY[]): { m: number; i: number; j: number } | null {
  let best: { m: number; i: number; j: number } | null = null;
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) {
      const m = dist(points[i], points[j]);
      if (!best || m < best.m) best = { m, i, j };
    }
  return best;
}

export interface GridOptions {
  /** Spacing along the rows [m] (the row direction is `angleDeg`). */
  along: number;
  /** Spacing between rows [m]. */
  across: number;
  /** Row direction, degrees clockwise from north. */
  angleDeg: number;
  /** Offset every other row by half a spacing. */
  staggered: boolean;
  /** Keep this distance [m] from the boundary (half a rotor at least). */
  inset: number;
}

export function distToSegment(p: XY, a: XY, b: XY): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

export function distToBoundary(p: XY, poly: XY[]): number {
  let m = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) m = Math.min(m, distToSegment(p, poly[j], poly[i]));
  return m;
}

/** Point of the polygon outline nearest to p. */
export function nearestOnBoundary(p: XY, poly: XY[]): XY {
  let best = poly[0];
  let m = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j];
    const dx = poly[i].x - a.x;
    const dy = poly[i].y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const q = { x: a.x + t * dx, y: a.y + t * dy };
    const d = dist(p, q);
    if (d < m) [m, best] = [d, q];
  }
  return best;
}

/** Bearing from a to b, degrees clockwise from north. */
export const bearing = (a: XY, b: XY) => ((Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI + 360) % 360;

/** Regular (or staggered) grid clipped to the polygon. */
export function gridFill(poly: XY[], o: GridOptions): XY[] {
  if (poly.length < 3 || o.along <= 0 || o.across <= 0) return [];
  const th = (o.angleDeg * Math.PI) / 180;
  const u = { x: Math.sin(th), y: Math.cos(th) }; // along the rows
  const v = { x: Math.cos(th), y: -Math.sin(th) }; // across the rows
  const c = poly.reduce((s, p) => ({ x: s.x + p.x / poly.length, y: s.y + p.y / poly.length }), { x: 0, y: 0 });
  const r = Math.max(...poly.map((p) => dist(p, c)));
  const out: XY[] = [];
  const nRows = Math.ceil(r / o.across);
  const nCols = Math.ceil(r / o.along) + 1;
  for (let i = -nRows; i <= nRows; i++) {
    const shift = o.staggered && i % 2 !== 0 ? 0.5 * o.along : 0;
    for (let j = -nCols; j <= nCols; j++) {
      const a = j * o.along + shift;
      const b = i * o.across;
      const p = { x: c.x + a * u.x + b * v.x, y: c.y + a * u.y + b * v.y };
      if (insidePolygon(p, poly) && distToBoundary(p, poly) >= o.inset) out.push(p);
    }
  }
  return out;
}
