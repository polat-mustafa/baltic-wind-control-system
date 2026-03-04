/**
 * Tests for the Forecast API client.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/services/forecastApi";

const BASE = "/api/v1/forecast";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockJsonResponse(data: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    json: () => Promise.resolve(data),
  });
}

function mockErrorResponse(detail: string, status = 400) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: "Bad Request",
    json: () => Promise.resolve({ detail }),
  });
}

describe("getTurbineSpec", () => {
  it("sends GET to correct URL", async () => {
    mockJsonResponse({ name: "V236-15.0" });
    const result = await api.getTurbineSpec();
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/turbine-spec`,
      expect.anything(),
    );
    expect(result).toEqual({ name: "V236-15.0" });
  });
});

describe("predictEnsemble", () => {
  it("sends POST with parameters and polls for result", async () => {
    // 1. POST returns 202 with task_id
    mockJsonResponse({ task_id: "test-task-id", status: "running" }, 202);
    // 2. Poll GET returns completed result
    mockJsonResponse({
      status: "completed",
      progress: 100,
      result: { num_steps: 288 },
      error: null,
    });

    vi.useFakeTimers();
    const promise = api.predictEnsemble(34, 52560, 0, 288);
    // Advance past the 3s poll delay
    await vi.runAllTimersAsync();
    const result = await promise;
    vi.useRealTimers();

    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/predict-ensemble`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/predict-ensemble/status/test-task-id`,
      expect.anything(),
    );
    expect(result).toEqual({ num_steps: 288 });
  });
});

describe("compareModels", () => {
  it("sends POST with parameters", async () => {
    mockJsonResponse({ best_rmse: "XGBoost" });
    await api.compareModels(34, 52560, 0, 288);
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/compare-models`,
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("getXGBoostSHAP", () => {
  it("sends POST with parameters", async () => {
    mockJsonResponse({ feature_importance: [] });
    await api.getXGBoostSHAP(34, 52560, 0);
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/xgboost-shap`,
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("detectRamps", () => {
  it("sends POST with parameters", async () => {
    mockJsonResponse({ ramp_events: [] });
    await api.detectRamps(34, 52560, 0, 288, 50);
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/detect-ramps`,
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("error handling", () => {
  it("throws on non-2xx with detail message", async () => {
    mockErrorResponse("Invalid turbine index", 400);
    await expect(api.getTurbineSpec()).rejects.toThrow("Invalid turbine index");
  });

  it("throws statusText when no JSON body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("no json")),
    });
    await expect(api.getTurbineSpec()).rejects.toThrow("Internal Server Error");
  });
});
