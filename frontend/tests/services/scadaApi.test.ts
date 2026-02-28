/**
 * Tests for the SCADA API client.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/services/scadaApi";

const BASE = "/api/v1/scada";

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

describe("getSubstationSummary", () => {
  it("sends GET to correct URL", async () => {
    mockJsonResponse({ total_devices: 42 });
    const result = await api.getSubstationSummary();
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/devices`,
      expect.anything(),
    );
    expect(result).toEqual({ total_devices: 42 });
  });
});

describe("listFaultScenarios", () => {
  it("sends GET to correct URL", async () => {
    mockJsonResponse([]);
    await api.listFaultScenarios();
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/goose/scenarios`,
      expect.anything(),
    );
  });
});

describe("runFaultSimulation", () => {
  it("sends POST with fault type", async () => {
    mockJsonResponse({ fault_type: "busbar_overcurrent" });
    await api.runFaultSimulation("busbar_overcurrent");
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/goose/simulate`,
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("calculateRetransmission", () => {
  it("sends POST with parameters", async () => {
    mockJsonResponse({ schedule_ms: [2, 4, 8] });
    await api.calculateRetransmission(2, 1000, 10);
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/goose/retransmission`,
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("listRoles", () => {
  it("sends GET to correct URL", async () => {
    mockJsonResponse([]);
    await api.listRoles();
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/rbac/roles`,
      expect.anything(),
    );
  });
});

describe("listZones", () => {
  it("sends GET to correct URL", async () => {
    mockJsonResponse([]);
    await api.listZones();
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/rbac/zones`,
      expect.anything(),
    );
  });
});

describe("createPermit", () => {
  it("sends POST with permit data", async () => {
    mockJsonResponse({ ptw_number: "PtW-2025-001" });
    await api.createPermit({
      work_description: "Replace CT wiring",
      equipment_id: "OSS_PROT_IED01",
      requested_by: "Control Engineer",
    });
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/permits/`,
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("listPermits", () => {
  it("sends GET to correct URL", async () => {
    mockJsonResponse({ total: 0, permits: [] });
    await api.listPermits();
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/permits/`,
      expect.anything(),
    );
  });
});

describe("getPermitDetail", () => {
  it("sends GET with permit number", async () => {
    mockJsonResponse({ ptw_number: "PtW-2025-001" });
    await api.getPermitDetail("PtW-2025-001");
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/permits/PtW-2025-001`,
      expect.anything(),
    );
  });
});

describe("transitionPermit", () => {
  it("sends POST with transition data", async () => {
    mockJsonResponse({ success: true });
    await api.transitionPermit("PtW-2025-001", {
      target_status: "risk_assessed",
      performed_by: "Safety Officer",
      user_level: 4,
    });
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/permits/PtW-2025-001/transition`,
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("error handling", () => {
  it("throws on non-2xx with detail message", async () => {
    mockErrorResponse("Device not found", 404);
    await expect(api.getSubstationSummary()).rejects.toThrow("Device not found");
  });

  it("throws statusText when no JSON body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("no json")),
    });
    await expect(api.getSubstationSummary()).rejects.toThrow("Internal Server Error");
  });
});
