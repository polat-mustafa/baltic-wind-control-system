/** The own project's farm travels to the P2 / P3 / P5 / Digital Twin endpoints in the X-Farm header. */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { farmHeader, farmInput, initFarmHeader, sendsFarm } from "../../src/lib/project/farmHeader";
import { request } from "../../src/services/apiClient";
import { SB510_NETWORK, useGridStore } from "../../src/store/gridStore";
import { useModeStore } from "../../src/store/modeStore";
import { useProjectStore } from "../../src/store/projectStore";
import { useSiteStore } from "../../src/store/siteStore";

const OSS: [number, number] = [16.4, 54.8];
// 8 turbines ≈ 6 D apart around the OSS
const POINTS: [number, number][] = Array.from({ length: 8 }, (_, i) => [16.37 + (i % 4) * 0.022, 54.79 + Math.floor(i / 4) * 0.013]);

const fetchMock = vi.fn();

beforeAll(() => initFarmHeader());

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
  vi.stubGlobal("fetch", fetchMock);
  useSiteStore.setState({ site: null, report: null });
  useProjectStore.getState().clear();
  useProjectStore.getState().setOss(null);
  useModeStore.setState({ mode: "own" });
});

afterEach(() => vi.unstubAllGlobals());

const layOut = () => {
  POINTS.forEach((p) => useProjectStore.getState().addTurbine(p));
  useProjectStore.getState().setOss(OSS);
};

describe("farm header", () => {
  it("is absent for SB-510: reference mode, or an own project without a layout", () => {
    expect(farmHeader()).toBeNull();
    layOut();
    useModeStore.setState({ mode: "reference" });
    expect(farmHeader()).toBeNull();
  });

  it("describes the own layout: strings from the cable tree, mean section length, export length", () => {
    layOut();
    const f = farmInput()!;
    expect(f.strings.reduce((a, b) => a + b, 0)).toBe(8);
    expect(Math.max(...f.strings)).toBeLessThanOrEqual(6); // 800 mm² carries 6 × 15 MW
    expect(f.export_km).toBe(108); // no site report yet → the SB-510 default
    expect(f.array_km).toBeGreaterThan(1);
    expect(f.array_km).toBeLessThan(3);
    expect(JSON.parse(decodeURIComponent(farmHeader()!))).toEqual(f);
  });

  it("carries the site's hub-height Weibull wind when the site report has one", () => {
    layOut();
    expect(farmInput()!.wind_a).toBeUndefined();
    const wind = { mean_ms: 9.3, weibull_a: 10.4, weibull_k: 2.15, height_m: 150, sector_frequencies: null, source: "NEWA", license: "CC BY", approximate: false };
    useSiteStore.setState({ report: { grid_km: 30, depth_m: [30, 40], wind } as never });
    expect(farmInput()).toMatchObject({ wind_a: 10.4, wind_k: 2.15, export_km: expect.any(Number) });
  });

  it("names the site report's grid connection point", () => {
    layOut();
    expect(farmInput()!.grid_node).toBeUndefined();
    useSiteStore.setState({ report: { grid_km: 30, depth_m: [30, 40], grid_node: "Krzemienica 400 kV" } as never });
    expect(farmInput()!.grid_node).toBe("Krzemienica 400 kV");
    expect(farmInput()!.grid_ssc_mva).toBeUndefined(); // backend: illustrative 10 GVA
    useSiteStore.setState({ gridSscMva: 6_000 });
    expect(farmInput()!.grid_ssc_mva).toBe(6_000);
  });

  it("goes to grid, SCADA (control-room bays included), commissioning and twin", () => {
    for (const url of ["/api/v1/grid/load-flow", "/api/v1/scada/cms/fleet/overview", "/api/v1/scada/historian/latest", "/api/v1/scada/bays/BAY-OSS-66-07/command", "/api/v1/scada/interlocks/validate", "/api/v1/digital-twin/analyze", "/api/v1/commissioning/programmes"]) {
      expect(sendsFarm(url)).toBe(true);
    }
    for (const url of ["/api/v1/site/regions", "/api/v1/wind/aep"]) {
      expect(sendsFarm(url)).toBe(false);
    }
  });

  it("is set on the request by the API client", async () => {
    layOut();
    await request("/api/v1/grid/network-spec");
    await request("/api/v1/commissioning/programmes");
    await request("/api/v1/site/regions");
    const headers = fetchMock.mock.calls.map((c) => (c[1] as RequestInit).headers as Record<string, string>);
    expect(headers[0]["X-Farm"]).toBe(farmHeader());
    expect(headers[1]["X-Farm"]).toBe(farmHeader()); // a new programme is built for this farm
    expect(headers[2]["X-Farm"]).toBeUndefined();
  });

  it("drops grid results computed for another farm", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => SB510_NETWORK });
    useGridStore.setState({ farmFor: "sb510", analysisRun: true, loadFlowResults: [] });
    layOut();
    await useGridStore.getState().fetchNetworkSpec();
    expect(useGridStore.getState()).toMatchObject({ analysisRun: false, loadFlowResults: null, farmFor: farmHeader() });
  });
});
