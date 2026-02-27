/**
 * Tests for the commissioning API client.
 *
 * Uses vitest mocks on global.fetch to verify:
 * - Correct URLs and HTTP methods
 * - JSON body serialization
 * - Error handling for non-2xx responses
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/services/commissioningApi";

const BASE = "/api/v1/commissioning";

// Mock fetch globally
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

describe("Programme endpoints", () => {
  it("createProgramme sends POST with pic_name", async () => {
    const mockProg = { programme_id: "p-1", title: "Test", pic_name: "Jan" };
    mockJsonResponse(mockProg, 201);

    const result = await api.createProgramme("Jan");

    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/programmes`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ pic_name: "Jan" }),
      }),
    );
    expect(result).toEqual(mockProg);
  });

  it("listProgrammes sends GET", async () => {
    mockJsonResponse([]);
    const result = await api.listProgrammes();
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/programmes`,
      expect.objectContaining({ headers: { "Content-Type": "application/json" } }),
    );
    expect(result).toEqual([]);
  });

  it("getProgrammeDetail sends GET with ID", async () => {
    const detail = { programme_id: "p-1", steps: [] };
    mockJsonResponse(detail);
    const result = await api.getProgrammeDetail("p-1");
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/programmes/p-1`,
      expect.anything(),
    );
    expect(result).toEqual(detail);
  });

  it("startProgramme sends POST", async () => {
    mockJsonResponse({ programme_id: "p-1", status: "in_progress" });
    await api.startProgramme("p-1");
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/programmes/p-1/start`,
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("Step execution", () => {
  it("executeStep sends correct URL and body", async () => {
    mockJsonResponse({ success: true, step_id: "S-001" });
    await api.executeStep("p-1", "S-001", {
      executed_by: "Jan",
      pic_confirmed: true,
    });
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/programmes/p-1/steps/S-001/execute`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ executed_by: "Jan", pic_confirmed: true }),
      }),
    );
  });
});

describe("PiC decision", () => {
  it("picDecision sends go decision", async () => {
    mockJsonResponse({ decision: "go", programme_status: "in_progress" });
    await api.picDecision("p-1", {
      pic_name: "Jan",
      decision: "go",
      reason: "",
    });
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/programmes/p-1/pic-decision`,
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("LOTO", () => {
  it("applyLOTO sends POST to correct point", async () => {
    mockJsonResponse({ success: true, point_id: "LOTO-01" });
    await api.applyLOTO("p-1", "LOTO-01", { performed_by: "Jan" });
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/programmes/p-1/loto/LOTO-01/apply`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("removeLOTO sends POST to correct point", async () => {
    mockJsonResponse({ success: true, point_id: "LOTO-01" });
    await api.removeLOTO("p-1", "LOTO-01", { performed_by: "Jan" });
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/programmes/p-1/loto/LOTO-01/remove`,
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("FAT/SAT", () => {
  it("createFATCampaign sends equipment_tag", async () => {
    mockJsonResponse({ campaign_id: "fat-1" }, 201);
    await api.createFATCampaign("TX-OSS-01");
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/fat`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ equipment_tag: "TX-OSS-01" }),
      }),
    );
  });

  it("recordFATResult sends correct params", async () => {
    mockJsonResponse({ test_id: "FAT-001", verdict: "pass" });
    await api.recordFATResult("fat-1", "FAT-001", 99.5, "Jan", "Good");
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/fat/fat-1/tests/FAT-001/record`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          measured_value: 99.5,
          recorded_by: "Jan",
          notes: "Good",
        }),
      }),
    );
  });
});

describe("Error handling", () => {
  it("throws on non-2xx with detail message", async () => {
    mockErrorResponse("Programme not found", 404);
    await expect(api.getProgrammeDetail("bad-id")).rejects.toThrow(
      "Programme not found",
    );
  });

  it("throws statusText when no JSON body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("no json")),
    });
    await expect(api.listProgrammes()).rejects.toThrow("Internal Server Error");
  });
});
