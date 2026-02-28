/**
 * Tests for the wind resource API client.
 *
 * Uses vitest mocks on global.fetch to verify:
 * - Correct URLs and HTTP methods
 * - JSON body serialization
 * - Error handling for non-2xx responses
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/services/windResourceApi";

const BASE = "/api/v1/wind";

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
    mockJsonResponse({ rotor_diameter_m: 236 });
    const result = await api.getTurbineSpec();
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/turbine-spec`,
      expect.anything(),
    );
    expect(result).toEqual({ rotor_diameter_m: 236 });
  });
});

describe("fitWeibull", () => {
  it("sends POST with parameters", async () => {
    mockJsonResponse({ fitted_a: 10.5, fitted_k: 2.2 });
    await api.fitWeibull(10.5, 2.2);
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/weibull-fit`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ weibull_a: 10.5, weibull_k: 2.2 }),
      }),
    );
  });
});

describe("computeWindRose", () => {
  it("sends POST with parameters", async () => {
    mockJsonResponse({ sector_centres_deg: [] });
    await api.computeWindRose(10.5, 2.2);
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/wind-rose`,
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("runWakeAnalysis", () => {
  it("sends POST with layout and wind params", async () => {
    mockJsonResponse({ wake_loss_percent: 8.5 });
    await api.runWakeAnalysis("regular", 10.5, 2.2, 0.06);
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/wake-analysis`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          layout: "regular",
          weibull_a: 10.5,
          weibull_k: 2.2,
          turbulence_intensity: 0.06,
        }),
      }),
    );
  });
});

describe("computeAEPCascade", () => {
  it("sends POST with all parameters", async () => {
    mockJsonResponse({ net_aep_gwh: 1850 });
    await api.computeAEPCascade("regular", 10.5, 2.2, 0.06, 72);
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/aep-cascade`,
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("getLayoutPositions", () => {
  it("sends GET with layout name", async () => {
    mockJsonResponse({ name: "regular", x_positions: [] });
    await api.getLayoutPositions("regular");
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/layouts/regular/positions`,
      expect.anything(),
    );
  });
});

describe("error handling", () => {
  it("throws on non-2xx with detail message", async () => {
    mockErrorResponse("Invalid parameters", 400);
    await expect(api.getTurbineSpec()).rejects.toThrow("Invalid parameters");
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
