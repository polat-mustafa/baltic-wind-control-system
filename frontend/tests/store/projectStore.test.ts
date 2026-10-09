import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/windResourceApi", () => ({
  runCustomWakeAnalysis: vi.fn(async (x: number[], ...rest: unknown[]) => {
    const nb = rest[6] as { x_m: number[] } | null | undefined;
    return {
      gross_aep_gwh: 60 * x.length,
      net_aep_gwh: 55 * x.length,
      wake_loss_percent: 8.3,
      capacity_factor: 0.42,
      per_turbine_aep_gwh: x.map(() => 55),
      per_turbine_wake_loss_percent: x.map(() => 8.3),
      ...(nb ? { external_wake_loss_percent: 4, net_aep_with_neighbours_gwh: 55 * x.length * 0.96, neighbour_count: nb.x_m.length } : {}),
    };
  }),
}));
vi.mock("../../src/services/siteApi", () => ({
  postNeighbours: vi.fn(async () => ({
    farms: [{ name: "Neighbour", status: "Planned", power_mw: 30, source: "point", distance_km: 20, turbines: [[17, 55], [17.01, 55]] }],
    density_mw_km2: 10,
    density_basis: "median of 5 mapped outlines",
    radius_km: 60,
    note: "Approximate neighbour layout",
  })),
}));

import { DEFAULT_COSTS } from "../../src/lib/layout/cost";
import { MAX_TURBINES, PROJECT_KEY, signature, useProjectStore } from "../../src/store/projectStore";

const reset = () => {
  useProjectStore.getState().clear();
  useProjectStore.setState({ oss: null, costs: { ...DEFAULT_COSTS }, error: null });
};

describe("projectStore", () => {
  beforeEach(() => {
    localStorage.clear();
    reset();
  });

  it("adds, moves and removes turbines and persists them", () => {
    const s = useProjectStore.getState();
    s.addTurbine([16.4, 54.8]);
    s.addTurbine([16.42, 54.8]);
    const [a, b] = useProjectStore.getState().turbines;
    expect([a.id, b.id]).toEqual(["WTG-01", "WTG-02"]);
    s.moveTurbine("WTG-02", [16.43, 54.81]);
    s.removeTurbine("WTG-01");
    expect(useProjectStore.getState().turbines).toEqual([{ id: "WTG-02", lon: 16.43, lat: 54.81 }]);
    expect(JSON.parse(localStorage.getItem(PROJECT_KEY)!).turbines).toHaveLength(1);
  });

  it("keeps tags stable on delete, refills the lowest gap, renumbers only on request", () => {
    const s = useProjectStore.getState();
    for (let i = 0; i < 4; i++) s.addTurbine([16.4 + i * 0.02, 54.8]);
    s.removeTurbine("WTG-02");
    expect(useProjectStore.getState().turbines.map((t) => t.id)).toEqual(["WTG-01", "WTG-03", "WTG-04"]);
    s.addTurbine([16.5, 54.9]);
    expect(useProjectStore.getState().turbines.at(-1)!.id).toBe("WTG-02");
    s.renumber(["WTG-04", "WTG-03", "WTG-02", "WTG-01"]);
    expect(useProjectStore.getState().turbines.map((t) => t.id)).toEqual(["WTG-04", "WTG-02", "WTG-01", "WTG-03"]);
  });

  it("upgrades pre-2026-10 T01 tags to WTG-01", () => {
    expect(useProjectStore.getState().restore({ turbines: [{ id: "T07", lon: 16.4, lat: 54.8 }], oss: null, costs: {} })).toBe(true);
    expect(useProjectStore.getState().turbines[0].id).toBe("WTG-07");
  });

  it("caps the layout at the backend limit", () => {
    const pts = Array.from({ length: MAX_TURBINES + 5 }, (_, i): [number, number] => [16 + i * 0.01, 54.8]);
    useProjectStore.getState().setTurbines(pts);
    expect(useProjectStore.getState().turbines).toHaveLength(MAX_TURBINES);
    useProjectStore.getState().addTurbine([17, 55]);
    expect(useProjectStore.getState().error).toMatch(/At most/);
  });

  it("restores a layout and rejects an invalid turbine list", () => {
    const s = useProjectStore.getState();
    expect(s.restore({ turbines: [{ id: "T01", lon: 16.4, lat: 54.8 }], oss: [16.41, 54.8], costs: { waccPct: 7 } })).toBe(true);
    const st = useProjectStore.getState();
    expect(st.turbines).toHaveLength(1);
    expect(st.oss).toEqual([16.41, 54.8]);
    expect(st.costs.waccPct).toBe(7);
    expect(st.costs.lifetimeYears).toBe(DEFAULT_COSTS.lifetimeYears); // missing keys → defaults
    expect(s.restore({ turbines: [{ id: "T01", lon: "x" }] })).toBe(false);
    expect(useProjectStore.getState().turbines).toHaveLength(1);
  });

  it("keeps the PyWake result with the layout it was computed for", async () => {
    const s = useProjectStore.getState();
    s.addTurbine([16.4, 54.8]);
    s.addTurbine([16.45, 54.8]);
    await s.runPyWake(([lon, lat]) => ({ x: lon * 1000, y: lat * 1000 }));
    const st = useProjectStore.getState();
    expect(st.pywake?.net_aep_gwh).toBe(110);
    expect(st.pywakeFor).toBe(signature(st.turbines));
    s.moveTurbine("WTG-01", [16.41, 54.8]);
    expect(useProjectStore.getState().pywakeFor).not.toBe(signature(useProjectStore.getState().turbines));
  });

  it("runs PyWake on the saved project when a remote runner is given", async () => {
    const s = useProjectStore.getState();
    s.addTurbine([16.4, 54.8]);
    const remote = vi.fn(async () => ({
      gross_aep_gwh: 70,
      net_aep_gwh: 70,
      wake_loss_percent: 0,
      capacity_factor: 0.5,
      per_turbine_aep_gwh: [70],
      per_turbine_wake_loss_percent: [0],
    }));
    await s.runPyWake(([lon, lat]) => ({ x: lon, y: lat }), { weibullA: 10.6, weibullK: 2, sectorFrequencies: null }, remote);
    expect(remote).toHaveBeenCalledWith({ weibullA: 10.6, weibullK: 2, sectorFrequencies: null });
    expect(useProjectStore.getState().pywake?.net_aep_gwh).toBe(70);
  });

  it("estimates the external wake loss with the neighbours' virtual turbines", async () => {
    const { runCustomWakeAnalysis } = await import("../../src/services/windResourceApi");
    const s = useProjectStore.getState();
    s.addTurbine([16.4, 54.8]);
    await s.runNeighbourWake(([lon, lat]) => ({ x: lon * 1000, y: lat * 1000 }), [[16.3, 54.7], [16.5, 54.7], [16.5, 54.9]]);
    const st = useProjectStore.getState();
    expect(st.external).toMatchObject({ lossPct: 4, netWithGWh: 52.8, turbines: 2 });
    expect(st.external?.farms[0]).not.toHaveProperty("turbines");
    expect(st.externalFor).toBe(signature(st.turbines));
    const call = vi.mocked(runCustomWakeAnalysis).mock.calls.at(-1)!;
    expect(call[7]).toEqual({ x_m: [17000, 17010], y_m: [55000, 55000] });
  });

  it("ignores invalid cost inputs", () => {
    useProjectStore.getState().setCost("turbineMEURperMW", -1);
    useProjectStore.getState().setCost("turbineMEURperMW", Number.NaN);
    expect(useProjectStore.getState().costs.turbineMEURperMW).toBe(DEFAULT_COSTS.turbineMEURperMW);
  });
});
