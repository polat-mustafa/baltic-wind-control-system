import { describe, expect, it } from "vitest";

import { arraySegments, fleetFromPlan, pathToOss, SB510_FLEET, SB510_NETWORK, type Fleet } from "../../src/lib/fleet";
import { farmPlan } from "../../src/lib/lifecycle/farm";
import type { NetworkSpec } from "../../src/types/grid";
import { exportCableState, plantNet, reactiveBalance } from "../../src/utils/landingPhysics";

const OSS: [number, number] = [16.4, 54.8];
// 8 turbines ≈ 6 D apart around the OSS
const TURBINES = Array.from({ length: 8 }, (_, i) => ({
  id: `T${i + 1}`,
  lon: 16.37 + (i % 4) * 0.022,
  lat: 54.79 + Math.floor(i / 4) * 0.013,
}));

/** Backend design() results (services/p2/network_model.py), MW / km / MVAr / MVA. */
const net = (o: Partial<NetworkSpec>): NetworkSpec => ({ ...SB510_NETWORK, source: "project", name: "Own", ...o });
const FOUR = net({ total_capacity_mw: 120, num_turbines: 8, export_length_km: 20, num_export_cables: 1, cable_q_mvar: 57.8, statcom_rating_mvar: 30, num_reactors: 2, reactor_unit_mvar: 50, oss_trafo_mva: 100, onshore_trafo_mva: 100 });
const GW = net({ total_capacity_mw: 1080, num_turbines: 72, export_length_km: 45, num_export_cables: 4, cable_q_mvar: 520, statcom_rating_mvar: 260, num_reactors: 5, reactor_unit_mvar: 80, oss_trafo_mva: 600, onshore_trafo_mva: 600 });
const FAR = net({ total_capacity_mw: 375, num_turbines: 25, export_length_km: 75, num_export_cables: 2, cable_q_mvar: 433.4, statcom_rating_mvar: 100, num_reactors: 3, reactor_unit_mvar: 180, oss_trafo_mva: 250, onshore_trafo_mva: 250 });

const own = (): Fleet => {
  const plan = farmPlan({ turbines: TURBINES, oss: OSS }, { site: null, report: null });
  return fleetFromPlan(plan, FOUR, "own");
};

describe("live fleet of an own project", () => {
  it("names turbines WTG-01 … in register order and keeps the cable tree", () => {
    const f = own();
    expect(f.source).toBe("project");
    expect(f.turbines.map((t) => t.id)).toEqual(TURBINES.map((_, i) => `WTG-0${i + 1}`));
    expect(f.strings.flat().sort()).toEqual(f.turbines.map((t) => t.id).sort());
    for (const t of f.turbines) expect(pathToOss(f, t.id).at(-1) && f.upstream[pathToOss(f, t.id).at(-1)!]).toBe("OSS");
    expect(f.oss).toEqual({ lat: OSS[1], lon: OSS[0] });
  });

  it("has one cable section per turbine; each feeder cable carries its whole string", () => {
    const f = own();
    const segs = arraySegments(f);
    expect(segs).toHaveLength(8);
    const feeders = segs.filter((s) => s.toId === "OSS");
    expect(feeders).toHaveLength(f.strings.length);
    for (const s of feeders) expect([...s.feedIds].sort()).toEqual([...f.strings[s.stringNumber - 1]].sort());
  });
});

describe("SB-510 fleet", () => {
  it("draws strings north → south, the southern turbine on the OSS", () => {
    const segs = arraySegments(SB510_FLEET);
    const feeder1 = segs.find((s) => s.key === "string-1-oss")!;
    expect(feeder1.fromId).toBe("WTG-06");
    expect(feeder1.feedIds).toEqual(["WTG-01", "WTG-02", "WTG-03", "WTG-04", "WTG-05", "WTG-06"]);
    expect(segs.find((s) => s.key === "cable-WTG-01-WTG-02")!.feedIds).toEqual(["WTG-01"]);
    expect(segs).toHaveLength(34);
  });
});

describe("plant physics on the fleet's network", () => {
  it.each([
    ["SB-510", SB510_NETWORK],
    ["120 MW / 20 km / 1 circuit", FOUR],
    ["1080 MW / 45 km / 4 circuits", GW],
    ["375 MW / 75 km / 2 circuits", FAR],
  ])("%s: reactors + STATCOM close Q ≈ 0 inside the STATCOM rating", (_, n) => {
    const pn = plantNet({ ...SB510_FLEET, net: n });
    for (let p = 0; p <= pn.ratedMW; p += pn.ratedMW / 20) {
      const b = reactiveBalance(p, pn);
      expect(Math.abs(b.statcomMVAr)).toBeLessThanOrEqual(pn.statcomMVAr);
      expect(Math.abs(b.cableMVAr + b.reactorsMVAr + b.seriesLossMVAr + b.statcomMVAr)).toBeLessThan(1e-9);
    }
  });

  it("one 20 km circuit at 120 MW: active current + half the charging current, well inside 950 A", () => {
    const pn = plantNet({ ...SB510_FLEET, net: FOUR });
    const s = exportCableState(120, pn);
    const iActive = 120e6 / (Math.sqrt(3) * 220e3); // ≈ 315 A
    expect(s.currentA).toBeGreaterThan(iActive);
    expect(s.chargingMVArPerCircuit).toBeCloseTo(57.8, 0); // ωCV²L, 20 km
    expect(s.loadingPct).toBeLessThan(40);
  });
});

describe("SB-510 feeder routing", () => {
  // Equirectangular metres around 55° N — plenty for 100 m-scale checks.
  const xy = (p: { lat: number; lon: number }) => [p.lon * 111_320 * Math.cos((55 * Math.PI) / 180), p.lat * 110_570];
  const distToLeg = (p: number[], a: number[], b: number[]) => {
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  };
  const route = (s: ReturnType<typeof arraySegments>[number]) => {
    const at = (id: string) => (id === "OSS" ? SB510_FLEET.oss : SB510_FLEET.turbines.find((t) => t.id === id)!);
    return [at(s.fromId), ...s.via, at(s.toId)].map(xy);
  };

  it("keeps every feeder at least 300 m from the turbines of other strings", () => {
    for (const s of arraySegments(SB510_FLEET).filter((x) => x.toId === "OSS")) {
      const pts = route(s);
      for (const t of SB510_FLEET.turbines.filter((o) => o.stringNumber !== s.stringNumber)) {
        const d = Math.min(...pts.slice(1).map((b, i) => distToLeg(xy(t), pts[i], b)));
        expect(d, `string ${s.stringNumber} feeder vs ${t.id}`).toBeGreaterThan(250);
      }
    }
  });

  it("never lets two feeders cross before the OSS", () => {
    const legs = arraySegments(SB510_FLEET)
      .filter((x) => x.toId === "OSS")
      .map((s) => ({ n: s.stringNumber, pts: route(s) }));
    const cross = (a: number[], b: number[], c: number[], d: number[]) => {
      const o = (p: number[], q: number[], r: number[]) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
      return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
    };
    for (const f of legs)
      for (const g of legs.filter((x) => x.n > f.n))
        for (let i = 1; i < f.pts.length; i++)
          for (let j = 1; j < g.pts.length; j++)
            expect(cross(f.pts[i - 1], f.pts[i], g.pts[j - 1], g.pts[j]), `S${f.n} × S${g.n}`).toBe(false);
  });
});
