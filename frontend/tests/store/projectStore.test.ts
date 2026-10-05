import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/windResourceApi", () => ({
  runCustomWakeAnalysis: vi.fn(async (x: number[]) => ({
    gross_aep_gwh: 60 * x.length,
    net_aep_gwh: 55 * x.length,
    wake_loss_percent: 8.3,
    capacity_factor: 0.42,
    per_turbine_aep_gwh: x.map(() => 55),
    per_turbine_wake_loss_percent: x.map(() => 8.3),
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
    expect([a.id, b.id]).toEqual(["T01", "T02"]);
    s.moveTurbine("T02", [16.43, 54.81]);
    s.removeTurbine("T01");
    expect(useProjectStore.getState().turbines).toEqual([{ id: "T02", lon: 16.43, lat: 54.81 }]);
    expect(JSON.parse(localStorage.getItem(PROJECT_KEY)!).turbines).toHaveLength(1);
  });

  it("caps the layout at the backend limit", () => {
    const pts = Array.from({ length: MAX_TURBINES + 5 }, (_, i): [number, number] => [16 + i * 0.01, 54.8]);
    useProjectStore.getState().setTurbines(pts);
    expect(useProjectStore.getState().turbines).toHaveLength(MAX_TURBINES);
    useProjectStore.getState().addTurbine([17, 55]);
    expect(useProjectStore.getState().error).toMatch(/At most/);
  });

  it("round-trips a project file and rejects foreign files", () => {
    const s = useProjectStore.getState();
    s.loadCaseStudy();
    s.setCost("waccPct", 7);
    const site: [number, number][] = [
      [16.3, 54.75],
      [16.5, 54.75],
      [16.5, 54.85],
    ];
    const text = s.exportFile(site);
    reset();
    expect(useProjectStore.getState().importFile(text)).toEqual(site);
    expect(useProjectStore.getState().turbines).toHaveLength(34);
    expect(useProjectStore.getState().oss).not.toBeNull();
    expect(useProjectStore.getState().costs.waccPct).toBe(7);

    expect(useProjectStore.getState().importFile("{nope")).toBeNull();
    expect(useProjectStore.getState().importFile(JSON.stringify({ app: "Other", schema: 1 }))).toBeNull();
    expect(useProjectStore.getState().error).toMatch(/OffshoreForge/);
  });

  it("keeps the PyWake result with the layout it was computed for", async () => {
    const s = useProjectStore.getState();
    s.addTurbine([16.4, 54.8]);
    s.addTurbine([16.45, 54.8]);
    await s.runPyWake(([lon, lat]) => ({ x: lon * 1000, y: lat * 1000 }));
    const st = useProjectStore.getState();
    expect(st.pywake?.net_aep_gwh).toBe(110);
    expect(st.pywakeFor).toBe(signature(st.turbines));
    s.moveTurbine("T01", [16.41, 54.8]);
    expect(useProjectStore.getState().pywakeFor).not.toBe(signature(useProjectStore.getState().turbines));
  });

  it("ignores invalid cost inputs", () => {
    useProjectStore.getState().setCost("turbineMEURperMW", -1);
    useProjectStore.getState().setCost("turbineMEURperMW", Number.NaN);
    expect(useProjectStore.getState().costs.turbineMEURperMW).toBe(DEFAULT_COSTS.turbineMEURperMW);
  });
});
