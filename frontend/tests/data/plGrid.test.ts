/**
 * The Polish grid map's data (backend/scripts/fetch_pl_grid.py): real routes,
 * every neighbour's interconnector, the farm's grid node, and the cross-check
 * with ENTSO-E's map print.
 */

import { describe, expect, it } from "vitest";

import grid from "../../src/data/plGrid.json";

describe("plGrid.json", () => {
  it("draws real routes, not bus-to-bus straight lines", () => {
    const ac = grid.lines.filter((l) => l.kind === "AC");
    expect(ac.filter((l) => l.c.length > 2).length).toBeGreaterThan(0.8 * ac.length);
  });

  it("carries the interconnectors to every neighbour and SwePol", () => {
    const to = new Set(grid.lines.map((l) => ("to" in l ? l.to : undefined)).filter(Boolean));
    for (const c of ["DE", "CZ", "SK", "LT", "UA", "SE"]) expect(to.has(c), c).toBe(true);
    expect(grid.lines.some((l) => l.kind === "DC" && l.kv === 450)).toBe(true);
  });

  it("has PSE's 400 and 220 kV network at national scale, with the SB-510 node", () => {
    const km = (kv: number) => grid.lines.filter((l) => l.kind === "AC" && l.kv === kv).reduce((s, l) => s + l.km, 0);
    // PSE: roughly 8 000 km of 400 kV and 7 000–8 000 km of 220 kV lines
    expect(km(400)).toBeGreaterThan(6000);
    expect(km(220)).toBeGreaterThan(6000);
    const names = grid.stations.map((s) => s.name).join(" | ");
    expect(names).toMatch(/Krzemienica/);
    expect(names).toMatch(/Słupsk/);
    expect(grid.entsoe_check.named / grid.entsoe_check.stations).toBeGreaterThan(0.6);
  });
});
