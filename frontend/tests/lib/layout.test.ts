import { describe, expect, it } from "vitest";

import { gridFill, insidePolygon, minSpacing, polygonArea, projection, type XY } from "../../src/lib/layout/geometry";
import { maxPerString, mstLength, routeCables, sectionFor, stringCurrent } from "../../src/lib/layout/cables";
import { layoutYield } from "../../src/lib/layout/energy";
import { crf, DEFAULT_COSTS, layoutCost } from "../../src/lib/layout/cost";

const D = 236;
const square = (s: number): XY[] => [
  { x: 0, y: 0 },
  { x: s, y: 0 },
  { x: s, y: s },
  { x: 0, y: s },
];
const grid = (n: number, sd: number): XY[] =>
  Array.from({ length: n * n }, (_, k) => ({ x: (k % n) * sd * D, y: Math.floor(k / n) * sd * D }));

describe("geometry", () => {
  it("projects and back within a millimetre", () => {
    const p = projection([16.4, 54.8]);
    const xy = p.toXY([16.5, 54.9]);
    expect(xy.y).toBeCloseTo(11_132, 0);
    const [lon, lat] = p.toLonLat(xy);
    expect(lon).toBeCloseTo(16.5, 8);
    expect(lat).toBeCloseTo(54.9, 8);
  });

  it("tests points and areas", () => {
    expect(insidePolygon({ x: 5, y: 5 }, square(10))).toBe(true);
    expect(insidePolygon({ x: 15, y: 5 }, square(10))).toBe(false);
    expect(polygonArea(square(1000))).toBe(1e6);
  });

  it("fills a grid inside the polygon at the asked spacing", () => {
    const poly = square(10_000);
    const pts = gridFill(poly, { along: 7 * D, across: 7 * D, angleDeg: 0, staggered: false, inset: D / 2 });
    expect(pts.length).toBe(25); // 10 km / 7 D = 6.05 spacings → 5 × 5 centred
    expect(pts.every((p) => insidePolygon(p, poly))).toBe(true);
    expect(minSpacing(pts)!.m).toBeCloseTo(7 * D, 3);
  });
});

describe("array cables", () => {
  it("sizes strings from the cable rating", () => {
    // 15 MW at 66 kV, unity pf → 131 A per turbine; 800 mm² (900 A) carries 6
    expect(stringCurrent(1, 15)).toBeCloseTo(131.2, 1);
    expect(maxPerString(15)).toBe(6);
    expect(sectionFor(5, 15)!.id).toBe("500");
    expect(sectionFor(6, 15)!.id).toBe("630");
    expect(sectionFor(7, 15)).toBeNull();
  });

  it("connects every turbine within the string capacity, without crossings", () => {
    const t = grid(5, 7);
    const oss = { x: 2 * 7 * D, y: -1500 };
    const r = routeCables(oss, t, 15);
    expect(r.edges).toHaveLength(25);
    expect(r.edges.every((e) => e.load <= 6 && e.section)).toBe(true);
    expect(r.strings).toBeGreaterThanOrEqual(Math.ceil(25 / 6));
    expect(r.edges.filter((e) => e.to === -1).reduce((s, e) => s + e.load, 0)).toBe(25);
    expect(r.crossings).toBe(0);
    // capacity costs length: never shorter than the unconstrained MST
    expect(r.totalKm).toBeGreaterThanOrEqual(r.mstKm - 1e-9);
    expect(r.totalKm).toBeLessThan(1.5 * r.mstKm);
    expect(mstLength(oss, t) / 1000).toBeCloseTo(r.mstKm, 9);
  });
});

describe("layout yield", () => {
  it("one turbine has no wake loss and a plausible capacity factor", () => {
    const y = layoutYield([{ x: 0, y: 0 }], 10.5, 2.2);
    expect(y.wakeLossPct).toBeCloseTo(0, 9);
    expect(y.capacityFactor).toBeGreaterThan(0.4);
    expect(y.capacityFactor).toBeLessThan(0.65);
  });

  it("matches PyWake within 1 percentage point on square grids", () => {
    // PyWake 2.6, backend run_wake_analysis + create_uniform_site(10.5, 2.2, 0.06),
    // 5 × 5 V236 grid: wake loss 9.80 / 5.37 / 3.46 % at 4 / 6 / 8 D
    const ref: [number, number][] = [
      [4, 9.8],
      [6, 5.37],
      [8, 3.46],
    ];
    for (const [sd, pct] of ref) expect(Math.abs(layoutYield(grid(5, sd), 10.5, 2.2).wakeLossPct - pct)).toBeLessThan(1);
  });

  it("tighter spacing loses more; P never exceeds rated", () => {
    const tight = layoutYield(grid(5, 4), 10.5, 2.2);
    const wide = layoutYield(grid(5, 8), 10.5, 2.2);
    expect(wide.wakeLossPct).toBeGreaterThan(0);
    expect(tight.wakeLossPct).toBeGreaterThan(wide.wakeLossPct);
    expect(tight.netGWh).toBeLessThanOrEqual(25 * 15 * 8.76);
  });
});

describe("cost", () => {
  it("annuity factor matches the textbook value", () => {
    expect(crf(6, 25)).toBeCloseTo(0.07823, 5);
    expect(crf(0, 20)).toBeCloseTo(0.05, 9);
  });

  it("gives an LCOE in a sane range for a 510 MW farm", () => {
    const c = layoutCost(DEFAULT_COSTS, 510, 60, 45, 40, 2200);
    expect(c.capexMEURperMW).toBeGreaterThan(2);
    expect(c.capexMEURperMW).toBeLessThan(4);
    expect(c.lcoe!).toBeGreaterThan(40);
    expect(c.lcoe!).toBeLessThan(120);
    expect(layoutCost(DEFAULT_COSTS, 510, 60, 45, 40, 0).lcoe).toBeNull();
  });
});
