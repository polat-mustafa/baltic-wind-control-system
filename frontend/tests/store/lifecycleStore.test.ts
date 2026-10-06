/** Lifecycle store: persisted inputs are validated and clamped; runs keep the latest result only. */

import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../src/services/lifecycleApi";
import type { CampaignRequest, CampaignResult } from "../../src/types/lifecycle";

vi.mock("../../src/services/lifecycleApi", () => ({ runCampaign: vi.fn() }));

const req: CampaignRequest = { mode: "install", n_turbines: 6, export_km: 30, foundation: "monopile", start_date: "2028-04-01", alpha: 0.8, runs: 50 };

async function freshStore() {
  vi.resetModules();
  return (await import("../../src/store/lifecycleStore")).useLifecycleStore;
}

describe("lifecycleStore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(api.runCampaign).mockReset();
  });

  it("loads defaults and clamps a corrupt stored value", async () => {
    localStorage.setItem(
      "of.lifecycle.v1",
      JSON.stringify({ build: { start: "not a date", alpha: 7, runs: 3, limits: { WTIV: { hs_m: 99, wind_ms: 12 }, XYZ: { hs_m: 1, wind_ms: 1 } } } }),
    );
    const s = (await freshStore()).getState();
    expect(s.build.start).toBe("2028-04-01");
    expect(s.build.alpha).toBe(1);
    expect(s.build.runs).toBe(20);
    expect(s.build.limits).toEqual({ WTIV: { hs_m: 6, wind_ms: 12 } });
    expect(s.decom.options.foundations).toBe("cut");
  });

  it("persists settings and limit overrides", async () => {
    const store = await freshStore();
    store.getState().setBuild({ start: "2028-10-01", alpha: 0.7 });
    store.getState().setLimit("build", "CLV", { hs_m: 2.5, wind_ms: 16 });
    store.getState().setDecom({ options: { foundations: "full", removeArray: true, removeExport: false, removeScour: false } });
    const saved = JSON.parse(localStorage.getItem("of.lifecycle.v1") ?? "{}");
    expect(saved.build).toMatchObject({ start: "2028-10-01", alpha: 0.7, limits: { CLV: { hs_m: 2.5, wind_ms: 16 } } });
    expect(saved.decom.options.foundations).toBe("full");
    store.getState().setLimit("build", "CLV", null);
    expect(store.getState().build.limits).toEqual({});
  });

  it("stores the result with the request it was computed for, and reports errors", async () => {
    const store = await freshStore();
    const api2 = await import("../../src/services/lifecycleApi");
    vi.mocked(api2.runCampaign).mockResolvedValueOnce({ mode: "install" } as CampaignResult);
    await store.getState().run("build", req);
    expect(store.getState().results.build?.mode).toBe("install");
    expect(store.getState().resultFor.build).toBe(JSON.stringify(req));
    vi.mocked(api2.runCampaign).mockRejectedValueOnce(new Error("backend down"));
    await store.getState().run("build", req);
    expect(store.getState().error).toBe("backend down");
    expect(store.getState().running.build).toBe(false);
  });
});
