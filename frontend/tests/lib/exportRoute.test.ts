import { describe, expect, it } from "vitest";

import { defaultExportKm } from "../../src/lib/layout/evaluate";
import { farmPlan } from "../../src/lib/lifecycle/farm";
import { routeEnds } from "../../src/lib/site/exportRoute";
import type { LonLat } from "../../src/lib/layout/geometry";

const SITE: LonLat[] = [
  [16.4, 55.0],
  [16.6, 55.0],
  [16.6, 55.1],
  [16.4, 55.1],
];
const NODE: LonLat = [16.89, 54.5];

describe("export route ends", () => {
  it("starts at the offshore substation, else at the site edge facing the first waypoint", () => {
    expect(routeEnds(SITE, [16.5, 55.05], null, NODE).start).toEqual([16.5, 55.05]);
    const edge = routeEnds(SITE, null, [[16.5, 54.8]], NODE).start;
    expect(edge[1]).toBeCloseTo(55.0, 5); // south edge, straight above the waypoint
    expect(edge[0]).toBeCloseTo(16.5, 3);
  });

  it("ends at the grid node unless the drawn route already reaches it (2 km)", () => {
    expect(routeEnds(SITE, null, [[16.7, 54.6]], NODE).end).toEqual(NODE);
    expect(routeEnds(SITE, null, [[16.88, 54.505]], NODE).end).toBeNull(); // 0.9 km away
    expect(routeEnds(SITE, null, null, NODE).end).toEqual(NODE);
  });
});

describe("export length", () => {
  it("takes the checked route, else the straight line + 10 %", () => {
    expect(defaultExportKm(60, 71.26)).toBe(71.3);
    expect(defaultExportKm(60, null)).toBe(66);
    const turbines = [
      { id: "T1", lon: 16.45, lat: 55.05 },
      { id: "T2", lon: 16.5, lat: 55.05 },
    ];
    const report = { grid_km: 60, depth_m: [38, 46] as [number, number] };
    expect(farmPlan({ turbines, oss: [16.47, 55.04] }, { site: SITE, report, routeKm: 71.26 }).exportKm).toBe(71.3);
    expect(farmPlan({ turbines, oss: [16.47, 55.04] }, { site: SITE, report }).exportKm).toBe(66);
  });
});
