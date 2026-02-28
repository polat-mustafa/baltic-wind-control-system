/**
 * Tests for the P2 grid Zustand store.
 *
 * Tests async actions by mocking the API client and verifying
 * state transitions for the full analysis lifecycle.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGridStore } from "../../src/store/gridStore";
import * as api from "../../src/services/gridApi";

vi.mock("../../src/services/gridApi");

const mockApi = vi.mocked(api);

function resetStore() {
  useGridStore.setState({
    networkSpec: null,
    loadFlowResults: null,
    shortCircuit: null,
    statcomSizing: null,
    frtResult: null,
    converterComparison: null,
    activeScenario: "full_load",
    frtType: "lvrt",
    converterScenario: "strong_grid",
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
  it("setActiveScenario updates state", () => {
    useGridStore.getState().setActiveScenario("partial_load");
    expect(useGridStore.getState().activeScenario).toBe("partial_load");
  });

  it("setFrtType updates state", () => {
    useGridStore.getState().setFrtType("hvrt");
    expect(useGridStore.getState().frtType).toBe("hvrt");
  });
});

describe("fetchNetworkSpec", () => {
  it("loads network spec into state", async () => {
    const mockSpec = { total_capacity_mw: 510, num_turbines: 34 };
    mockApi.getNetworkSpec.mockResolvedValue(mockSpec as ReturnType<typeof api.getNetworkSpec> extends Promise<infer T> ? T : never);

    await useGridStore.getState().fetchNetworkSpec();

    expect(useGridStore.getState().networkSpec).toEqual(mockSpec);
  });

  it("sets error on failure", async () => {
    mockApi.getNetworkSpec.mockRejectedValue(new Error("Network error"));

    await useGridStore.getState().fetchNetworkSpec();

    expect(useGridStore.getState().error).toBe("Network error");
  });
});

describe("runFullAnalysis", () => {
  it("calls all API endpoints", async () => {
    mockApi.runLoadFlowAll.mockResolvedValue([] as ReturnType<typeof api.runLoadFlowAll> extends Promise<infer T> ? T : never);
    mockApi.calcShortCircuit.mockResolvedValue({} as ReturnType<typeof api.calcShortCircuit> extends Promise<infer T> ? T : never);
    mockApi.getSTATCOMSizing.mockResolvedValue({} as ReturnType<typeof api.getSTATCOMSizing> extends Promise<infer T> ? T : never);
    mockApi.runFRT.mockResolvedValue({} as ReturnType<typeof api.runFRT> extends Promise<infer T> ? T : never);
    mockApi.getConverterComparison.mockResolvedValue({} as ReturnType<typeof api.getConverterComparison> extends Promise<infer T> ? T : never);

    await useGridStore.getState().runFullAnalysis();

    expect(mockApi.runLoadFlowAll).toHaveBeenCalled();
    expect(mockApi.calcShortCircuit).toHaveBeenCalledWith("max");
    expect(mockApi.getSTATCOMSizing).toHaveBeenCalled();
    expect(mockApi.runFRT).toHaveBeenCalledWith("lvrt");
    expect(useGridStore.getState().loading).toBe(false);
    expect(useGridStore.getState().analysisRun).toBe(true);
  });

  it("sets error on failure", async () => {
    mockApi.runLoadFlowAll.mockRejectedValue(new Error("API down"));
    mockApi.calcShortCircuit.mockResolvedValue({} as ReturnType<typeof api.calcShortCircuit> extends Promise<infer T> ? T : never);
    mockApi.getSTATCOMSizing.mockResolvedValue({} as ReturnType<typeof api.getSTATCOMSizing> extends Promise<infer T> ? T : never);
    mockApi.runFRT.mockResolvedValue({} as ReturnType<typeof api.runFRT> extends Promise<infer T> ? T : never);
    mockApi.getConverterComparison.mockResolvedValue({} as ReturnType<typeof api.getConverterComparison> extends Promise<infer T> ? T : never);

    await useGridStore.getState().runFullAnalysis();

    expect(useGridStore.getState().error).toBe("API down");
    expect(useGridStore.getState().loading).toBe(false);
  });
});

describe("clearError", () => {
  it("clears the error state", () => {
    useGridStore.setState({ error: "Something went wrong" });
    useGridStore.getState().clearError();
    expect(useGridStore.getState().error).toBeNull();
  });
});
