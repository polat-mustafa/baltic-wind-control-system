import { describe, expect, it } from "vitest";

import { CASE_STUDY_SITE } from "../../src/store/siteStore";
import { OSS_GEO, TURBINE_POSITIONS } from "../../src/constants/windFarmLayout";
import { DEFAULT_COSTS } from "../../src/lib/layout/cost";
import { evaluateLayout, type LayoutInput } from "../../src/lib/layout/evaluate";
import { depthScore, scoreDiagnosis, scoreLayout, scoreSite } from "../../src/academy/scoring";
import { report } from "../components/site/fixtures";

const sum = (s: { lines: { points: number }[] }) => s.lines.reduce((a, l) => a + l.points, 0);

describe("site selection score", () => {
  it("gives full marks to a consentable 500 MW site near the grid in monopile depth", () => {
    const s = scoreSite(report());
    expect(s.score).toBe(100);
    expect(s.lines.every((l) => l.points === l.max)).toBe(true);
  });

  it("drops the permit points when the site would be refused", () => {
    const s = scoreSite({ ...report({ shipping: "fail" }), excluded_fraction: 0.7, capacity_mw: 140 });
    expect(s.lines[0].points).toBe(0);
    expect(s.score).toBeLessThan(50);
    expect(s.score).toBe(Math.round(sum(s)));
  });

  it("uses the backend depth bands", () => {
    expect([15, 30, 60, 80, 5].map(depthScore)).toEqual([0.7, 1, 0.6, 0.3, 0]);
  });
});

describe("layout challenge score", () => {
  const base: LayoutInput = {
    site: CASE_STUDY_SITE,
    turbines: TURBINE_POSITIONS,
    oss: [OSS_GEO.lon, OSS_GEO.lat],
    costs: DEFAULT_COSTS,
    layers: null,
    maxDepthM: 39.8,
    exportKm: 50,
  };

  it("rates the SB-510 reference layout as a pass without constraint layers", () => {
    const e = evaluateLayout(base);
    expect(e.capacityMW).toBe(510);
    expect(e.outside).toBe(0);
    const s = scoreLayout(e);
    expect(s.lines[0].points).toBe(25);
    expect(s.score).toBeGreaterThanOrEqual(70);
    expect(s.score).toBeLessThan(100);
  });

  it("penalises turbines outside the site", () => {
    const moved = TURBINE_POSITIONS.map((t, i) => (i < 2 ? { ...t, lon: t.lon + 1 } : t));
    const e = evaluateLayout({ ...base, turbines: moved });
    expect(e.outside).toBe(2);
    const s = scoreLayout(e);
    expect(s.lines.at(-1)).toMatchObject({ points: -20 });
    expect(s.score).toBe(Math.round(sum(s)));
  });

  it("gives no capacity or cost points to an empty layout", () => {
    const s = scoreLayout(evaluateLayout({ ...base, turbines: [], oss: null }));
    expect(s.score).toBe(0);
  });
});

describe("diagnosis score", () => {
  const truth = [{ turbine: "WTG-20", kind: "pitch_offset" as const }];

  it("splits the credit between finding and naming the fault", () => {
    expect(scoreDiagnosis(truth, [{ turbine: "WTG-20", kind: "pitch_offset" }]).score).toBe(100);
    expect(scoreDiagnosis(truth, [{ turbine: "WTG-20", kind: "aero_efficiency" }]).score).toBe(50);
    expect(scoreDiagnosis(truth, []).score).toBe(0);
  });

  it("costs 15 points per healthy turbine flagged", () => {
    expect(scoreDiagnosis(truth, [{ turbine: "WTG-20", kind: "pitch_offset" }, { turbine: "WTG-02", kind: null }]).score).toBe(85);
  });

  it("rewards leaving a healthy fleet alone", () => {
    expect(scoreDiagnosis([], []).score).toBe(100);
    expect(scoreDiagnosis([], [{ turbine: "WTG-02", kind: "pitch_offset" }]).score).toBe(75);
  });

  it("weights multi-turbine faults per turbine", () => {
    const icing = ["WTG-05", "WTG-06", "WTG-07", "WTG-08"].map((turbine) => ({ turbine, kind: "aero_efficiency" as const }));
    expect(scoreDiagnosis(icing, icing.slice(0, 2)).score).toBe(50);
  });
});
