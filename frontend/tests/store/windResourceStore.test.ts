/**
 * Tests for the P1 wind resource Zustand store.
 *
 * Tests async actions by mocking the API client and verifying
 * state transitions for the full analysis lifecycle.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWindResourceStore } from "../../src/store/windResourceStore";
import * as api from "../../src/services/windResourceApi";
import { useModeStore } from "../../src/store/modeStore";
import { useProjectStore } from "../../src/store/projectStore";
import { useSiteStore } from "../../src/store/siteStore";

vi.mock("../../src/services/windResourceApi");

const mockApi = vi.mocked(api);

function resetStore() {
  useWindResourceStore.setState({
    turbineSpec: null,
    weibullFit: null,
    windRose: null,
    wakeAnalysis: null,
    aepCascade: null,
    layoutComparison: null,
    layoutPositions: null,
    loading: false,
    error: null,
    analysisRun: false,
  });
}

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parameter setters", () => {
  it("setWeibullA updates state", () => {
    useWindResourceStore.getState().setWeibullA(11.0);
    expect(useWindResourceStore.getState().weibullA).toBe(11.0);
  });

  it("setWeibullK updates state", () => {
    useWindResourceStore.getState().setWeibullK(2.5);
    expect(useWindResourceStore.getState().weibullK).toBe(2.5);
  });

  it("setActiveLayout updates state", () => {
    useWindResourceStore.getState().setActiveLayout("staggered");
    expect(useWindResourceStore.getState().activeLayout).toBe("staggered");
  });
});

describe("fetchTurbineSpec", () => {
  it("loads turbine spec into state", async () => {
    const mockSpec = {
      model_id: "IEA-15-240-RWT",
      name: "IEA 15 MW reference turbine",
      source: "test",
      license: "Apache-2.0",
      rotor_diameter_m: 241.35,
      hub_height_m: 150,
      rated_power_kw: 15000,
      cut_in_speed_ms: 3,
      rated_speed_ms: 12.5,
      cut_out_speed_ms: 31,
      num_turbines: 34,
    };
    mockApi.getTurbineSpec.mockResolvedValue(mockSpec);

    await useWindResourceStore.getState().fetchTurbineSpec();

    expect(useWindResourceStore.getState().turbineSpec).toEqual(mockSpec);
  });

  it("sets error on failure", async () => {
    mockApi.getTurbineSpec.mockRejectedValue(new Error("Network error"));

    await useWindResourceStore.getState().fetchTurbineSpec();

    expect(useWindResourceStore.getState().error).toBe("Network error");
  });
});

describe("runFullAnalysis", () => {
  it("calls all API endpoints in parallel", async () => {
    mockApi.fitWeibull.mockResolvedValue({} as ReturnType<typeof api.fitWeibull> extends Promise<infer T> ? T : never);
    mockApi.computeWindRose.mockResolvedValue({} as ReturnType<typeof api.computeWindRose> extends Promise<infer T> ? T : never);
    mockApi.runWakeAnalysis.mockResolvedValue({} as ReturnType<typeof api.runWakeAnalysis> extends Promise<infer T> ? T : never);
    mockApi.computeAEPCascade.mockResolvedValue({} as ReturnType<typeof api.computeAEPCascade> extends Promise<infer T> ? T : never);
    mockApi.compareLayouts.mockResolvedValue({} as ReturnType<typeof api.compareLayouts> extends Promise<infer T> ? T : never);
    mockApi.getLayoutPositions.mockResolvedValue({} as ReturnType<typeof api.getLayoutPositions> extends Promise<infer T> ? T : never);

    await useWindResourceStore.getState().runFullAnalysis();

    expect(mockApi.fitWeibull).toHaveBeenCalled();
    expect(mockApi.computeWindRose).toHaveBeenCalled();
    expect(mockApi.runWakeAnalysis).toHaveBeenCalled();
    expect(mockApi.computeAEPCascade).toHaveBeenCalled();
    expect(mockApi.compareLayouts).toHaveBeenCalled();
    expect(mockApi.getLayoutPositions).toHaveBeenCalled();
    expect(useWindResourceStore.getState().loading).toBe(false);
    expect(useWindResourceStore.getState().analysisRun).toBe(true);
  });

  it("sets error on failure", async () => {
    mockApi.fitWeibull.mockRejectedValue(new Error("API down"));
    mockApi.computeWindRose.mockResolvedValue({} as ReturnType<typeof api.computeWindRose> extends Promise<infer T> ? T : never);
    mockApi.runWakeAnalysis.mockResolvedValue({} as ReturnType<typeof api.runWakeAnalysis> extends Promise<infer T> ? T : never);
    mockApi.computeAEPCascade.mockResolvedValue({} as ReturnType<typeof api.computeAEPCascade> extends Promise<infer T> ? T : never);
    mockApi.compareLayouts.mockResolvedValue({} as ReturnType<typeof api.compareLayouts> extends Promise<infer T> ? T : never);
    mockApi.getLayoutPositions.mockResolvedValue({} as ReturnType<typeof api.getLayoutPositions> extends Promise<infer T> ? T : never);

    await useWindResourceStore.getState().runFullAnalysis();

    expect(useWindResourceStore.getState().error).toBe("API down");
    expect(useWindResourceStore.getState().loading).toBe(false);
  });
});

describe("clearError", () => {
  it("clears the error state", () => {
    useWindResourceStore.setState({ error: "Something went wrong" });
    useWindResourceStore.getState().clearError();
    expect(useWindResourceStore.getState().error).toBeNull();
  });
});

describe("runFullAnalysis — own project", () => {
  afterEach(() => {
    useModeStore.setState({ mode: null });
    useProjectStore.setState({ turbines: [], oss: null });
    useSiteStore.setState({ site: null, report: null });
  });

  it("runs the own layout with its site wind and skips SB-510's layout comparison", async () => {
    const rose = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0]; // all from 270°
    useModeStore.setState({ mode: "own" });
    useProjectStore.setState({
      turbines: [
        { id: "a", lon: 16.5, lat: 55.0 },
        { id: "b", lon: 16.53, lat: 55.0 },
        { id: "c", lon: 16.5, lat: 55.02 },
      ],
      oss: [16.51, 55.01],
    });
    useSiteStore.setState({
      site: null,
      report: { wind: { weibull_a: 9.8, weibull_k: 2.2, sector_frequencies: rose, approximate: false } } as never,
    });
    const wr = {
      sector_centres_deg: Array.from({ length: 12 }, (_, i) => i * 30),
      frequencies: Array(12).fill(1 / 12),
      mean_speeds_ms: Array(12).fill(9),
      energy_fractions: Array(12).fill(1 / 12),
      dominant_direction_deg: 240,
      circular_std_deg: 60,
      num_sectors: 12,
      speed_bin_edges_ms: [0, 4],
      sector_speed_frequencies: Array.from({ length: 12 }, () => [0.25 / 12, 0.75 / 12]),
    };
    mockApi.fitWeibull.mockResolvedValue({} as never);
    mockApi.computeWindRose.mockResolvedValue(wr);
    mockApi.runCustomWakeAnalysis.mockResolvedValue({ per_turbine_aep_gwh: [1, 2, 3] } as never);
    mockApi.computeCustomAEPCascade.mockResolvedValue({ net_aep_gwh: 100 } as never);

    await useWindResourceStore.getState().runFullAnalysis();

    const s = useWindResourceStore.getState();
    expect(s.error).toBeNull();
    expect(mockApi.runWakeAnalysis).not.toHaveBeenCalled();
    expect(mockApi.compareLayouts).not.toHaveBeenCalled();
    const body = mockApi.computeCustomAEPCascade.mock.calls[0][0];
    expect(body.x_m).toHaveLength(3);
    expect(body.weibull_a).toBe(9.8); // the site's wind, not SB-510's
    expect(body.sector_frequencies).toEqual(rose);
    // ~0.03° of longitude at 55° N ≈ 1.9 km
    expect(s.layoutPositions?.min_spacing_m).toBeGreaterThan(1500);
    expect(s.layoutPositions?.num_turbines).toBe(3);
    expect(s.layoutComparison).toBeNull();
    // the chart shows the rose the wake run used
    expect(s.windRose?.dominant_direction_deg).toBe(270);
    expect(s.windRose?.sector_speed_frequencies[9]).toEqual([0.25, 0.75]);
    expect(s.farmFor).not.toBe("sb510");
  });
});
