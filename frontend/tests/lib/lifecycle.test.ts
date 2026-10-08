/** Lifecycle engines: farm plan / hand-over register, campaign request, decommissioning inventory and cost. */

import { describe, expect, it } from "vitest";

import { TURBINE_POSITIONS } from "../../src/constants/windFarmLayout";
import { maxPerString } from "../../src/lib/layout/cables";
import { RATED_MW } from "../../src/lib/layout/evaluate";
import { DEFAULT_DECOM, endOfLifeCost, inventory, MASS } from "../../src/lib/lifecycle/decommissioning";
import { bayName, campaignRequest, farmPlan, foundationFor } from "../../src/lib/lifecycle/farm";

const noSite = { site: null, report: null };

/** 3 × 4 grid of turbines ~1.5 km apart east of an OSS. */
function grid() {
  const turbines = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 4; c++) turbines.push({ id: `T${String(r * 4 + c + 1).padStart(2, "0")}`, lon: 16.42 + c * 0.024, lat: 54.78 + r * 0.0135 });
  return { turbines, oss: [16.39, 54.793] as [number, number] };
}

describe("farmPlan", () => {
  it("falls back to SB-510 without a layout project", () => {
    const f = farmPlan({ turbines: [], oss: null }, noSite);
    expect(f.source).toBe("sb510");
    expect(f.turbines).toHaveLength(TURBINE_POSITIONS.length);
    expect(f.strings.reduce((a, b) => a + b, 0)).toBe(34);
    // SB-510's own numbering: strings 6-6-6-6-5-5, WTG-01 on S1 / BAY-OSS-66-01
    expect(f.strings).toEqual([6, 6, 6, 6, 5, 5]);
    const w1 = f.turbines.find((t) => t.id === "WTG-01");
    expect([w1?.string, w1?.bay]).toEqual([1, "BAY-OSS-66-01"]);
    expect(f.capacityMW).toBe(510);
    expect(f.exportKm).toBe(108);
    expect(f.foundation).toBe("jacket"); // 37–51 m
    // 28 in-string sections of 6D (≈ 1.45 km) ≈ 41 km, plus six gateway runs to the OSS at the
    // south-west corner (≈ 1.9 … 11.6 km, ≈ 40 km together)
    expect(f.arrayKm).toBeGreaterThan(70);
    expect(f.arrayKm).toBeLessThan(90);
  });

  it("builds a register from the learner's project", () => {
    const f = farmPlan(grid(), { site: null, report: { grid_km: 30, depth_m: [38, 46] } });
    expect(f.source).toBe("project");
    expect(f.turbines).toHaveLength(12);
    expect(f.foundation).toBe("jacket"); // deepest water 46 m > 40 m
    expect(f.exportKm).toBe(33); // 30 km straight line + 10 %
    const cap = maxPerString(RATED_MW);
    expect(f.strings.every((n) => n >= 1 && n <= cap)).toBe(true);
    expect(f.strings.reduce((a, b) => a + b, 0)).toBe(12);
    // every turbine reaches the OSS, register sorted by string
    const ids = new Set(f.turbines.map((t) => t.id));
    for (const t of f.turbines) expect(t.upstream === "OSS" || ids.has(t.upstream)).toBe(true);
    expect(f.turbines.map((t) => t.string)).toEqual([...f.turbines.map((t) => t.string)].sort((a, b) => a - b));
    expect(f.turbines.filter((t) => t.upstream === "OSS")).toHaveLength(f.strings.length);
    expect(f.turbines[0].bay).toBe("BAY-OSS-66-01");
    // the gateway cable carries the whole string
    for (let s = 1; s <= f.strings.length; s++) {
      const gw = f.turbines.find((t) => t.string === s && t.upstream === "OSS");
      expect(gw?.load).toBe(f.strings[s - 1]);
    }
    const km = Object.values(f.kmBySection).reduce((a, b) => a + b, 0);
    expect(km).toBeCloseTo(f.arrayKm, 6);
  });

  it("needs an OSS to use the project", () => {
    expect(farmPlan({ turbines: grid().turbines, oss: null }, noSite).source).toBe("sb510");
  });

  it("names bays and foundations", () => {
    expect(bayName(3)).toBe("BAY-OSS-66-03");
    expect(bayName(12)).toBe("BAY-OSS-66-12");
    expect(foundationFor(null)).toBe("monopile");
    expect(foundationFor([20, 40])).toBe("monopile");
    expect(foundationFor([30, 41])).toBe("jacket");
  });
});

describe("campaignRequest", () => {
  it("maps the farm to the backend limits", () => {
    const f = farmPlan(grid(), noSite);
    const r = campaignRequest(f, { mode: "install", start_date: "2028-04-01", alpha: 0.8, runs: 100 });
    expect(r.n_turbines).toBe(12);
    expect(r.strings?.reduce((a, b) => a + b, 0)).toBe(12);
    expect(r.export_km).toBe(108); // no site report → SB-510's 108 km
    expect(r.array_km).toBeGreaterThan(0);
    expect(r.mode).toBe("install");
  });

  it("sails from the nearest installation port of the site assessment", () => {
    const ports = [
      { name: "Ustka", use: "O&M" as const, status: "under construction", km: 40.2, basis: "" },
      { name: "Far terminal", use: "installation" as const, status: "operating", km: null, basis: "" },
      { name: "Gdańsk T5", use: "installation" as const, status: "under construction", km: 131.26, basis: "" },
    ];
    const own = farmPlan(grid(), { site: null, report: { grid_km: 30, depth_m: [38, 46], ports } });
    expect(own.installPort).toEqual({ name: "Gdańsk T5", km: 131.26 });
    expect(own.omPort).toEqual({ name: "Ustka", km: 40.2 });
    expect(campaignRequest(own, { mode: "install", start_date: "2028-04-01", alpha: 0.8, runs: 50 }).port_km).toBe(131.3);
    const sb510 = farmPlan({ turbines: [], oss: null }, noSite);
    expect(sb510.installPort?.name).toBe("Rønne (DK)");
    expect(campaignRequest(sb510, { mode: "install", start_date: "2028-04-01", alpha: 0.8, runs: 50 }).port_km).toBe(116.7);
    const unassessed = farmPlan(grid(), { site: null, report: { grid_km: 30, depth_m: [38, 46] } });
    expect(campaignRequest(unassessed, { mode: "install", start_date: "2028-04-01", alpha: 0.8, runs: 50 }).port_km).toBeUndefined();
  });
});

describe("decommissioning", () => {
  const farm = { turbines: 34, arrayKm: 60, exportKm: 45, foundation: "monopile" as const };

  it("leaves the embedded pile, cables and rock in situ by default", () => {
    const lines = inventory(farm, DEFAULT_DECOM);
    const left = lines.filter((l) => l.fate === "left in situ").map((l) => l.item);
    expect(left).toEqual(["Piles below the cut", "Array cables", "Export cable (offshore part)", "Scour protection (rock)"]);
    const pile = lines.find((l) => l.item === "Piles below the cut");
    expect(pile?.tonnes).toBeCloseTo(34 * MASS.monopilePerTurbine * MASS.monopileLeftWhenCut, 6);
  });

  it("full removal leaves nothing and conserves mass", () => {
    const light = inventory(farm, DEFAULT_DECOM);
    const full = inventory(farm, { foundations: "full", removeArray: true, removeExport: true, removeScour: true });
    expect(full.every((l) => l.fate !== "left in situ")).toBe(true);
    const total = (ls: typeof light) => ls.reduce((s, l) => s + l.tonnes, 0);
    expect(total(full)).toBeCloseTo(total(light), 6);
  });

  it("cost adds the vessel campaign and credits scrap", () => {
    const lines = inventory(farm, DEFAULT_DECOM);
    const a = endOfLifeCost(lines, 100, 510);
    const b = endOfLifeCost(lines, 150, 510);
    expect(b.totalMEUR).toBeGreaterThan(a.totalMEUR);
    expect(a.lines.find((l) => l.label === "Steel scrap credit")?.meur).toBeLessThan(0);
    expect(a.perMW).toBeCloseTo(a.totalMEUR / 510, 9);
    expect(a.recycledShare).toBeGreaterThan(0.8); // steel dominates the recovered mass
    expect(a.recycledShare).toBeLessThanOrEqual(1);
    expect(a.leftT).toBeGreaterThan(0);
  });
});
