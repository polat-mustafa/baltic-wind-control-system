/**
 * Tests for the grid API client.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/services/gridApi";

const BASE = "/api/v1/grid";

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

describe("getNetworkSpec", () => {
  it("sends GET to correct URL", async () => {
    mockJsonResponse({ total_capacity_mw: 510 });
    const result = await api.getNetworkSpec();
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/network-spec`,
      expect.anything(),
    );
    expect(result).toEqual({ total_capacity_mw: 510 });
  });
});

describe("runLoadFlowAll", () => {
  it("sends GET to correct URL", async () => {
    mockJsonResponse([]);
    await api.runLoadFlowAll();
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/load-flow-all`,
      expect.anything(),
    );
  });
});

describe("calcShortCircuit", () => {
  it("sends GET with case parameter", async () => {
    mockJsonResponse({ max_ikss_ka: 25 });
    await api.calcShortCircuit("max");
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/short-circuit/max`,
      expect.anything(),
    );
  });
});

describe("getSTATCOMSizing", () => {
  it("sends GET to correct URL", async () => {
    mockJsonResponse({ statcom_rating_mvar: 120 });
    await api.getSTATCOMSizing();
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/statcom-sizing`,
      expect.anything(),
    );
  });
});

describe("runFRT", () => {
  it("sends POST with fault parameters", async () => {
    mockJsonResponse({ stayed_connected: true });
    await api.runFRT("lvrt");
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/frt/lvrt`,
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("getConverterComparison", () => {
  it("sends GET with scenario", async () => {
    mockJsonResponse({ scenario: "strong_grid" });
    await api.getConverterComparison("strong_grid");
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/converter-comparison/strong_grid`,
      expect.anything(),
    );
  });
});

describe("error handling", () => {
  it("throws on non-2xx with detail message", async () => {
    mockErrorResponse("Grid not found", 404);
    await expect(api.getNetworkSpec()).rejects.toThrow("Grid not found");
  });

  it("throws statusText when no JSON body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("no json")),
    });
    await expect(api.getNetworkSpec()).rejects.toThrow("Internal Server Error");
  });
});
