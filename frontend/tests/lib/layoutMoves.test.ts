import { describe, expect, it } from "vitest";

import { TURBINE_MODELS } from "../../src/constants/turbineModels";
import { routeCables } from "../../src/lib/layout/cables";
import { DEFAULT_COSTS, layoutCost } from "../../src/lib/layout/cost";
import { layoutYield, moveDelta, prepareYield, yieldOf, type WindRose } from "../../src/lib/layout/energy";
import {
  classSampler,
  foundationFactor,
  foundationFor,
  layoutContext,
  nearest,
  rasterSampler,
  seabedLookup,
  statusAt,
  turbineWarnings,
} from "../../src/lib/layout/evaluate";
import type { LonLat, XY } from "../../src/lib/layout/geometry";
import { suggestMoves } from "../../src/lib/layout/suggest";
import type { LayersResponse, RasterResponse, SeabedClass } from "../../src/services/siteApi";

const D = TURBINE_MODELS["IEA-15-240-RWT"].rotorDiameterM;
const WEST: WindRose = { directions: [270], frequencies: [1] };
const ROSE: WindRose = { directions: [0, 90, 180, 240, 270], frequencies: [0.1, 0.1, 0.2, 0.3, 0.3] };
const row = (n: number, sd: number): XY[] => Array.from({ length: n }, (_, i) => ({ x: i * sd * D, y: 0 }));

describe("incremental yield", () => {
  it("prepareYield gives the same numbers as the full sum", () => {
    const t = [...row(4, 5), ...row(4, 5).map((p) => ({ x: p.x + 2 * D, y: 7 * D }))];
    const y = yieldOf(prepareYield(t, 10.5, 2.2, ROSE));
    expect(y.netGWh).toBeCloseTo(layoutYield(t, 10.5, 2.2, ROSE).netGWh, 9);
    expect(y.perTurbineNetGWh.reduce((s, x) => s + x, 0)).toBeCloseTo(y.netGWh, 9);
  });

  it("moveDelta equals recomputing the moved layout", () => {
    const t = [...row(4, 5), ...row(4, 5).map((p) => ({ x: p.x + 2 * D, y: 7 * D }))];
    const m = prepareYield(t, 10.5, 2.2, ROSE);
    for (const [i, to] of [
      [2, { x: 10 * D, y: 2.5 * D }],
      [0, { x: -3 * D, y: 1 * D }],
      [5, { x: 9 * D, y: 7.4 * D }],
    ] as [number, XY][]) {
      const moved = t.map((p, j) => (j === i ? to : p));
      const full = yieldOf(prepareYield(moved, 10.5, 2.2, ROSE));
      const e = moveDelta(m, i, to);
      expect(e.deltaGWh).toBeCloseTo(full.netGWh - yieldOf(m).netGWh, 6);
      expect(e.turbineGWh).toBeCloseTo(full.perTurbineNetGWh[i], 6);
      expect(e.turbineLossPct).toBeCloseTo(full.perTurbineLossPct[i], 6);
    }
  });

  it("a waked turbine sees a lower mean speed than the free stream", () => {
    const m = prepareYield(row(2, 5), 10.5, 2.2, WEST);
    expect(m.freeMeanMs).toBeCloseTo(10.5 * 0.886, 1); // Weibull mean A·Γ(1 + 1/k), k 2.2
    expect(m.meanMs[0]).toBeCloseTo(m.freeMeanMs, 9); // upwind turbine
    expect(m.meanMs[1]).toBeLessThan(0.9 * m.freeMeanMs); // 5 D downwind
    expect(moveDelta(m, 1, { x: 5 * D, y: 5 * D }).turbineMeanMs).toBeCloseTo(m.freeMeanMs, 2);
  });
});

describe("per-turbine context", () => {
  const box = (x0: number, y0: number, x1: number, y1: number): LonLat[] => [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
    [x0, y0],
  ];
  const layer = (role: string, name: string, ring: LonLat[]) => ({
    id: role,
    role,
    geometry: "polygon",
    features: [{ name, geometry: { type: "Polygon", coordinates: [ring] }, properties: {} }],
  });
  const layers = {
    layers: [layer("msp_energy", "PZP_44", box(16.0, 55.0, 16.5, 55.2)), layer("protected", "Ławica", box(16.3, 55.0, 16.4, 55.05))],
  } as unknown as LayersResponse;
  const ctx = layoutContext(box(16.1, 55.0, 16.7, 55.2).slice(0, 4), layers);

  it("ranks the position problems", () => {
    const far = [ctx.proj.toXY([16.15, 55.15])];
    expect(statusAt(ctx, [16.2, 55.1], far).status).toBe("ok");
    expect(statusAt(ctx, [16.8, 55.1], far).status).toBe("outside");
    expect(statusAt(ctx, [16.6, 55.1], far).status).toBe("basin");
    expect(statusAt(ctx, [16.35, 55.02], far).status).toBe("excluded");
    const close = statusAt(ctx, [16.152, 55.15], far);
    expect(close.status).toBe("close");
    expect(close.note).toMatch(/0\.[0-9] D/);
  });

  it("finds the two nearest neighbours with bearings", () => {
    const xy = [
      { x: 0, y: 0 },
      { x: 0, y: 1000 },
      { x: 2000, y: 0 },
      { x: 5000, y: 0 },
    ];
    const n = nearest(xy[0], xy, ["A", "B", "C", "D"], 0, 250);
    expect(n.map((x) => x.id)).toEqual(["B", "C"]);
    expect(n[0].bearing).toBeCloseTo(0, 6);
    expect(n[1].bearing).toBeCloseTo(90, 6);
    expect(n[1].d).toBe(8);
  });

  it("samples the depth raster bilinearly and maps it to a foundation", () => {
    const r: RasterResponse = {
      role: "bathymetry",
      lon0: 16,
      lat0: 55,
      dlon: 0.1,
      dlat: 0.1,
      bands: {
        values: [
          [30, 40, 45],
          [50, 60, null],
        ],
      },
      source: "",
      license: "",
      retrieved: "",
    };
    const depth = rasterSampler(r);
    expect(depth([16.05, 55])).toBeCloseTo(35, 9);
    expect(depth([16.05, 55.05])).toBeCloseTo(45, 9);
    expect(depth([16.15, 55.05])).toBeNull(); // next to no data
    expect(depth([15.9, 55])).toBeNull();
    const bands = [
      { min_m: 20, max_m: 50, score: 1, foundation: "monopile / jacket" },
      { min_m: 50, max_m: 70, score: 0.6, foundation: "jacket" },
    ];
    expect(foundationFor(35, bands)).toBe("monopile / jacket");
    expect(foundationFor(55, bands)).toBe("jacket");
    expect(foundationFor(90, bands)).toBeNull();
  });
});

describe("move suggestions", () => {
  it("pulls a turbine out of the wake and the move pays", () => {
    // Three turbines in a west–east row 5 D apart, wind only from the west.
    const site: LonLat[] = [
      [16.0, 55.0],
      [16.3, 55.0],
      [16.3, 55.1],
      [16.0, 55.1],
    ];
    const ctx = layoutContext(site, null);
    const t = row(3, 5).map((p) => ({ x: p.x - 5 * D, y: p.y }));
    const model = prepareYield(t, 10.5, 2.2, WEST);
    const s = suggestMoves({
      ctx,
      model,
      ids: ["T01", "T02", "T03"],
      oss: { x: 0, y: -3000 },
      tree: routeCables({ x: 0, y: -3000 }, t, 15),
      costs: DEFAULT_COSTS,
      exportKm: 50,
      maxDepthM: 40,
      cables: [],
      cableBufferM: 500,
    });
    expect(s.length).toBeGreaterThan(0);
    for (const m of s) {
      expect(m.deltaGWh).toBeGreaterThan(0);
      expect(m.deltaLcoe).toBeLessThan(0);
      const others = t.filter((_, j) => j !== m.index);
      for (const q of others) expect(Math.hypot(q.x - m.to.x, q.y - m.to.y)).toBeGreaterThanOrEqual(4 * D - 1e-6);
      const moved = t.map((p, j) => (j === m.index ? m.to : p));
      const full = yieldOf(prepareYield(moved, 10.5, 2.2, WEST)).netGWh - yieldOf(model).netGWh;
      expect(m.deltaGWh).toBeCloseTo(full, 6);
    }
    // Moving the turbine keeps its strings: the cable change is its own segments only.
    expect(Math.abs(s[0].deltaCableKm)).toBeLessThanOrEqual((2 * s[0].distM) / 1000 + 1e-9);
    // Sideways (north or south) is the obvious escape from a westerly wake.
    expect([0, 180, 45, 135, 225, 315]).toContain(s[0].bearingDeg);
  });

  it("keeps clear of existing subsea cables", () => {
    const site: LonLat[] = [
      [16.0, 55.0],
      [16.3, 55.0],
      [16.3, 55.1],
      [16.0, 55.1],
    ];
    const ctx = layoutContext(site, null);
    const t = row(2, 5);
    const model = prepareYield(t, 10.5, 2.2, WEST);
    const fence = [
      [
        { x: -1e5, y: 100 },
        { x: 1e5, y: 100 },
      ],
      [
        { x: -1e5, y: -100 },
        { x: 1e5, y: -100 },
      ],
    ];
    const s = suggestMoves({ ctx, model, ids: ["A", "B"], oss: null, tree: null, costs: DEFAULT_COSTS, exportKm: 50, maxDepthM: 40, cables: fence, cableBufferM: 2.5 * D });
    for (const m of s) expect(Math.abs(m.to.y)).toBeGreaterThan(100 + 2.5 * D);
  });
});

describe("seabed sediment", () => {
  const classes: SeabedClass[] = [
    { code: 2, name: "Sand", piling: "Drives well.", burial: "Easy.", foundation_factor: 1, hard: false, quality: "illustrative" },
    { code: 5, name: "Rock and boulders", piling: "Piles may not drive.", burial: "Rock placement.", foundation_factor: 1.25, hard: true, quality: "illustrative" },
  ];
  const r: RasterResponse = {
    role: "seabed",
    lon0: 16,
    lat0: 55,
    dlon: 0.01,
    dlat: 0.01,
    bands: { values: [[2, 5, null]] },
    classes: { "2": "Sand", "5": "Rock and boulders" },
    source: "t",
    license: "t",
    retrieved: "t",
  };

  it("takes the class of the nearest cell, never an interpolated code", () => {
    const at = seabedLookup(classSampler(r), classes);
    expect(at([16.004, 55])?.name).toBe("Sand");
    expect(at([16.006, 55])?.name).toBe("Rock and boulders");
    expect(at([16.02, 55])).toBeNull(); // no data
    expect(at([15.9, 55])).toBeNull(); // outside
  });

  it("scales the foundation cost by the mean factor over the turbines", () => {
    const at = seabedLookup(classSampler(r), classes);
    const f = foundationFactor([[16, 55], [16.01, 55], [16.02, 55]], at); // sand, rock, unknown
    expect(f).toBeCloseTo((1 + 1.25 + 1) / 3, 12);
    const plain = layoutCost(DEFAULT_COSTS, 510, 80, 76.5, 45, 2200);
    const rocky = layoutCost(DEFAULT_COSTS, 510, 80, 76.5, 45, 2200, f);
    const found = (c: typeof plain) => c.lines.find((l) => l.label.startsWith("Foundations"))!;
    expect(found(rocky).meur).toBeCloseTo(found(plain).meur * f, 6);
    expect(found(rocky).label).toBe("Foundations (jacket, seabed × 1.08)");
    expect(found(rocky).source?.quality).toBe("illustrative");
    expect(found(plain).source).toBeUndefined();
    expect(rocky.capexMEUR - plain.capexMEUR).toBeCloseTo(found(plain).meur * (f - 1), 6);
  });

  it("warns on hard ground in the turbine card", () => {
    expect(turbineWarnings({ status: "ok", note: "" }, 45, "jacket", 5, classes[1])).toContain("rock and boulders: piles may not drive");
    expect(turbineWarnings({ status: "ok", note: "" }, 45, "jacket", 5, classes[0])).toEqual([]);
  });
});
