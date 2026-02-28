/**
 * Tests for the P1 wind resource Zustand store.
 *
 * Tests async actions by mocking the API client and verifying
 * state transitions for the full analysis lifecycle.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWindResourceStore } from "../../src/store/windResourceStore";
import * as api from "../../src/services/windResourceApi";

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
      rotor_diameter_m: 236,
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
