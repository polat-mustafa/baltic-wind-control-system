/**
 * Tests for the P4 Forecast Zustand store.
 *
 * Tests async actions by mocking the API client and verifying
 * state transitions for the full forecast analysis lifecycle.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useForecastStore } from "../../src/store/forecastStore";
import * as api from "../../src/services/forecastApi";

vi.mock("../../src/services/forecastApi");

const mockApi = vi.mocked(api);

function resetStore() {
  useForecastStore.setState({
    turbineSpec: null,
    numTurbines: 34,
    numTimesteps: 52560,
    turbineIndex: 0,
    horizonSteps: 288,
    rampThresholdMwHr: 50,
    spotPriceEurMwh: 72,
    ensembleForecast: null,
    shapResult: null,
    modelComparison: null,
    rampDetection: null,
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
  it("setTurbineIndex updates state", () => {
    useForecastStore.getState().setTurbineIndex(5);
    expect(useForecastStore.getState().turbineIndex).toBe(5);
  });

  it("setHorizonSteps updates state", () => {
    useForecastStore.getState().setHorizonSteps(144);
    expect(useForecastStore.getState().horizonSteps).toBe(144);
  });

  it("setRampThresholdMwHr updates state", () => {
    useForecastStore.getState().setRampThresholdMwHr(75);
    expect(useForecastStore.getState().rampThresholdMwHr).toBe(75);
  });

  it("setSpotPriceEurMwh updates state", () => {
    useForecastStore.getState().setSpotPriceEurMwh(85);
    expect(useForecastStore.getState().spotPriceEurMwh).toBe(85);
  });
});

describe("fetchTurbineSpec", () => {
  it("loads turbine spec into state", async () => {
    const mockSpec = { name: "V236-15.0", rated_power_mw: 15 };
    mockApi.getTurbineSpec.mockResolvedValue(mockSpec as ReturnType<typeof api.getTurbineSpec> extends Promise<infer T> ? T : never);

    await useForecastStore.getState().fetchTurbineSpec();

    expect(useForecastStore.getState().turbineSpec).toEqual(mockSpec);
  });

  it("sets error on failure", async () => {
    mockApi.getTurbineSpec.mockRejectedValue(new Error("Network error"));

    await useForecastStore.getState().fetchTurbineSpec();

    expect(useForecastStore.getState().error).toBe("Network error");
  });
});

describe("runFullAnalysis", () => {
  it("calls all 4 API endpoints in parallel", async () => {
    mockApi.predictEnsemble.mockResolvedValue({} as ReturnType<typeof api.predictEnsemble> extends Promise<infer T> ? T : never);
    mockApi.compareModels.mockResolvedValue({} as ReturnType<typeof api.compareModels> extends Promise<infer T> ? T : never);
    mockApi.getXGBoostSHAP.mockResolvedValue({} as ReturnType<typeof api.getXGBoostSHAP> extends Promise<infer T> ? T : never);
    mockApi.detectRamps.mockResolvedValue({} as ReturnType<typeof api.detectRamps> extends Promise<infer T> ? T : never);

    await useForecastStore.getState().runFullAnalysis();

    expect(mockApi.predictEnsemble).toHaveBeenCalledWith(34, 52560, 0, 288);
    expect(mockApi.compareModels).toHaveBeenCalledWith(34, 52560, 0, 288);
    expect(mockApi.getXGBoostSHAP).toHaveBeenCalledWith(34, 52560, 0);
    expect(mockApi.detectRamps).toHaveBeenCalledWith(34, 52560, 0, 288, 50);
    expect(useForecastStore.getState().loading).toBe(false);
    expect(useForecastStore.getState().analysisRun).toBe(true);
  });

  it("sets error on failure", async () => {
    mockApi.predictEnsemble.mockRejectedValue(new Error("Forecast failed"));
    mockApi.compareModels.mockResolvedValue({} as ReturnType<typeof api.compareModels> extends Promise<infer T> ? T : never);
    mockApi.getXGBoostSHAP.mockResolvedValue({} as ReturnType<typeof api.getXGBoostSHAP> extends Promise<infer T> ? T : never);
    mockApi.detectRamps.mockResolvedValue({} as ReturnType<typeof api.detectRamps> extends Promise<infer T> ? T : never);

    await useForecastStore.getState().runFullAnalysis();

    expect(useForecastStore.getState().error).toBe("Forecast failed");
    expect(useForecastStore.getState().loading).toBe(false);
  });
});

describe("clearError", () => {
  it("clears the error state", () => {
    useForecastStore.setState({ error: "Something went wrong" });
    useForecastStore.getState().clearError();
    expect(useForecastStore.getState().error).toBeNull();
  });
});
