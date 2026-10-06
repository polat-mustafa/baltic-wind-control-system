/** Commissioning API client — URLs, methods, bodies, error messages. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../src/services/commissioningApi";

const BASE = "/api/v1/commissioning";
const mockFetch = vi.fn();

beforeEach(() => vi.stubGlobal("fetch", mockFetch));
afterEach(() => {
  mockFetch.mockReset();
  vi.unstubAllGlobals();
});

const ok = (data: unknown, status = 200) =>
  mockFetch.mockResolvedValueOnce({ ok: true, status, json: () => Promise.resolve(data) });

describe("commissioningApi", () => {
  it("executes a step with PiC confirmation", async () => {
    ok({ success: true });
    await api.executeStep("P1", "2.08", "Jan");
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/programmes/P1/steps/2.08/execute`,
      expect.objectContaining({ method: "POST", body: JSON.stringify({ executed_by: "Jan", pic_confirmed: true }) }),
    );
  });

  it("routes lock actions, FAT, SAT and grid-code stages", async () => {
    for (let i = 0; i < 4; i++) ok({});
    await api.lotoAction("P1", "LOTO-ES-ON-220-01", "remove", "Jan");
    await api.createFAT("TX-OSS-01", "power_transformer");
    await api.recordSAT("P1", "SAT-04", 0.1, "Jan");
    await api.stageAction("P1", "eon", "submit");
    const urls = mockFetch.mock.calls.map((c) => c[0]);
    expect(urls).toEqual([
      `${BASE}/programmes/P1/loto/LOTO-ES-ON-220-01/remove`,
      `${BASE}/fat`,
      `${BASE}/programmes/P1/sat/tests/SAT-04/record`,
      `${BASE}/programmes/P1/compliance/eon/submit`,
    ]);
  });

  it("deletes without expecting a JSON body (204)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204, json: () => Promise.reject(new Error("no body")) });
    await expect(api.deleteProgramme("P1")).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledWith(`${BASE}/programmes/P1`, { method: "DELETE" });
  });

  it("throws the server's detail message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 422, json: () => Promise.resolve({ detail: "2.08: ILK-001 earth on cable" }),
    });
    await expect(api.executeStep("P1", "2.08", "Jan")).rejects.toThrow("ILK-001");
  });
});
