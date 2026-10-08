import { describe, expect, it } from "vitest";

import { gridFill, insidePolygon, minSpacing, polygonArea, projection, type XY } from "../../src/lib/layout/geometry";
import { maxPerString, mstLength, routeCables, sectionFor, stringCurrent } from "../../src/lib/layout/cables";
import { layoutYield } from "../../src/lib/layout/energy";
import { COST_DEFAULTS, crf, DEFAULT_COSTS, exportCircuits, layoutCost } from "../../src/lib/layout/cost";
import { blockedBy, energyRings, exclusionRings, OUTSIDE_ENERGY_BASIN } from "../../src/lib/layout/evaluate";
import type { LayersResponse, LayerInfo, LonLat } from "../../src/services/siteApi";
import { TURBINE_MODELS } from "../../src/constants/turbineModels";

const D = TURBINE_MODELS["IEA-15-240-RWT"].rotorDiameterM; // 241.35 m
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
    // PyWake 2.6.19, backend run_wake_analysis + create_uniform_site(10.5, 2.2, 0.06),
    // 5 × 5 grid of the IEA 15 MW reference: wake loss 12.53 / 6.80 / 4.34 % at 4 / 6 / 8 D
    const ref: [number, number][] = [
      [4, 12.53],
      [6, 6.8],
      [8, 4.34],
    ];
    for (const [sd, pct] of ref) expect(Math.abs(layoutYield(grid(5, sd), 10.5, 2.2).wakeLossPct - pct)).toBeLessThan(1);
    // IEA 22 MW (D = 284 m): 13.17 / 7.23 / 4.69 %
    const big = TURBINE_MODELS["IEA-22-280-RWT"];
    const gridBig = (sd: number): XY[] =>
      Array.from({ length: 25 }, (_, k) => ({ x: (k % 5) * sd * big.rotorDiameterM, y: Math.floor(k / 5) * sd * big.rotorDiameterM }));
    for (const [sd, pct] of [
      [4, 13.17],
      [6, 7.23],
      [8, 4.69],
    ] as const)
      expect(Math.abs(layoutYield(gridBig(sd), 10.5, 2.2, undefined, big).wakeLossPct - pct)).toBeLessThan(1);
  });

  it("tighter spacing loses more; P never exceeds rated", () => {
    const tight = layoutYield(grid(5, 4), 10.5, 2.2);
    const wide = layoutYield(grid(5, 8), 10.5, 2.2);
    expect(wide.wakeLossPct).toBeGreaterThan(0);
    expect(tight.wakeLossPct).toBeGreaterThan(wide.wakeLossPct);
    expect(tight.netGWh).toBeLessThanOrEqual(25 * 15 * 8.76);
    // gross of one IEA 15 MW at A = 10.5, k = 2.2: PyWake 74.70 GWh
    expect(layoutYield([{ x: 0, y: 0 }], 10.5, 2.2).grossGWh).toBeCloseTo(74.7, 0);
  });
});

describe("cost", () => {
  it("annuity factor matches the textbook value", () => {
    expect(crf(6, 25)).toBeCloseTo(0.07823, 5);
    expect(crf(0, 20)).toBeCloseTo(0.05, 9);
  });

  it("gives an LCOE in a sane range for a 510 MW farm", () => {
    // NREL 2024 fixed-bottom reference: 5 411 $/kW ≈ 5.0 M€/MW, LCOE 117 $/MWh ≈ 108 €/MWh
    const c = layoutCost(DEFAULT_COSTS, 510, 60, 45, 40, 2200);
    expect(c.capexMEURperMW).toBeGreaterThan(4.5);
    expect(c.capexMEURperMW).toBeLessThan(5.5);
    expect(c.lcoe!).toBeGreaterThan(90);
    expect(c.lcoe!).toBeLessThan(140);
    expect(layoutCost(DEFAULT_COSTS, 510, 60, 45, 40, 0).lcoe).toBeNull();
  });

  it("defaults are the NREL / ORBIT values in 2023 € and carry their source", () => {
    expect(DEFAULT_COSTS.turbineMEURperMW).toBe(1.64); // 1 770 $/kW / 1.0813
    expect(DEFAULT_COSTS.opexKEURperMWyr).toBe(125); // 135 $/kW-yr / 1.0813
    expect(DEFAULT_COSTS.exportCircuitMEURperKm).toBe(1.39); // ORBIT 1 500 902 $/km
    for (const c of Object.values(COST_DEFAULTS)) {
      expect(c.source).not.toBe("");
      if (c.quality !== "illustrative") expect(c.license && c.retrieved).toBeTruthy();
    }
  });

  it("prices the export cable per circuit with the backend design() rule", () => {
    expect(exportCircuits(510, 76.5)).toBe(2); // SB-510: 2 × 220 kV
    expect(exportCircuits(300, 50)).toBe(1);
    expect(exportCircuits(0, 50)).toBe(0); // no turbines, no export cable
    expect(exportCircuits(900, 76.5)).toBe(3);
    const one = layoutCost(DEFAULT_COSTS, 300, 0, 50, 30, 1000).lines.find((l) => l.label.startsWith("Export"))!;
    expect(one.meur).toBeCloseTo(1.39 * 50, 6);
  });
});

describe("turbine constraints", () => {
  const box = (lon0: number, lat0: number, lon1: number, lat1: number): LonLat[] => [
    [lon0, lat0],
    [lon1, lat0],
    [lon1, lat1],
    [lon0, lat1],
    [lon0, lat0],
  ];
  const layer = (role: string, name: string, ring: LonLat[]): LayerInfo => ({
    id: role,
    title: role,
    role,
    geometry: "polygon",
    source: "test",
    license: "test",
    retrieved: "2026-10-06",
    features: [{ name, geometry: { type: "Polygon", coordinates: [ring] }, properties: {} }],
  });
  const layers = {
    layers: [
      layer("msp_energy", "PZP_44 — energy basin", box(16.0, 54.0, 17.0, 55.0)),
      layer("owf", "Baltic Power", box(16.6, 54.6, 16.8, 54.8)),
      layer("shipping", "PZP_15 — shipping priority", box(16.0, 54.9, 17.0, 55.0)),
    ],
  } as unknown as LayersResponse;
  const rings = exclusionRings(layers);
  const energy = energyRings(layers);

  it("allows a free spot inside an energy basin", () => {
    expect(blockedBy([16.3, 54.3], rings, energy)).toBeNull();
  });

  it("blocks real wind farms, shipping basins and anything outside the energy basins", () => {
    expect(blockedBy([16.7, 54.7], rings, energy)).toBe("inside Baltic Power");
    expect(blockedBy([16.3, 54.95], rings, energy)).toBe("inside PZP_15 — shipping priority");
    expect(blockedBy([17.5, 54.5], rings, energy)).toBe(OUTSIDE_ENERGY_BASIN);
  });

  it("skips the basin rule when the region has no spatial plan layer", () => {
    expect(blockedBy([17.5, 54.5], rings, [])).toBeNull();
  });
});
