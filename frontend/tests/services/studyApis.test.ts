/**
 * API clients of the engineering studies surfaced in the UI: earth fault, route rating,
 * converter stability, EMT energisation, support structure / tower loads, O&M replay.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getRouteRating } from "../../src/services/cableDtsApi";
import { getEnergisationEmt } from "../../src/services/commissioningApi";
import { getOMSimulation } from "../../src/services/lifecycleApi";
import { runConverterStability } from "../../src/services/powerQualityApi";
import { getEarthFaultStudy } from "../../src/services/protectionApi";
import { getSupportStructure, getTowerFatigue, getTowerLoads } from "../../src/services/turbinePhysicsApi";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: "OK", json: () => Promise.resolve({ ok: 1 }) });
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const url = () => mockFetch.mock.calls.at(-1)?.[0] as string;
const init = () => mockFetch.mock.calls.at(-1)?.[1] as RequestInit;

describe("study API clients", () => {
  it("earth fault: GET with the fault resistance", async () => {
    await expect(getEarthFaultStudy(50)).resolves.toEqual({ ok: 1 });
    expect(url()).toBe("/api/v1/grid/protection/earth-fault?fault_resistance_ohm=50");
  });

  it("route rating: GET", async () => {
    await getRouteRating();
    expect(url()).toBe("/api/v1/grid/cable/route-rating");
  });

  it("converter stability: POST with only the given fields (backend defaults = SB-510)", async () => {
    await runConverterStability({ f_sw_hz: 3000, damping_r_pu: 0 });
    expect(url()).toBe("/api/v1/grid/power-quality/converter-stability");
    expect(init().method).toBe("POST");
    expect(JSON.parse(init().body as string)).toEqual({ f_sw_hz: 3000, damping_r_pu: 0 });
    await runConverterStability();
    expect(JSON.parse(init().body as string)).toEqual({});
  });

  it("EMT energisation: point-on-wave, pole scatter, pre-insertion and reactor as query", async () => {
    await getEnergisationEmt({ closingAngleDeg: 90, poleScatterMs: 1, preInsertion: true, withReactor: false });
    expect(url()).toBe(
      "/api/v1/commissioning/energisation/emt?closing_angle_deg=90&pole_scatter_ms=1&pre_insertion=true&with_reactor=false",
    );
  });

  it("turbine physics: support structure, tower loads, tower fatigue", async () => {
    await getSupportStructure();
    expect(url()).toBe("/api/v1/turbine-physics/support-structure");
    await getTowerLoads(15, 3);
    expect(url()).toBe("/api/v1/turbine-physics/tower-loads?wind_ms=15&seed=3");
    await getTowerFatigue();
    expect(url()).toBe("/api/v1/turbine-physics/tower-fatigue");
  });

  it("O&M replay: vessels, crews and mode as query", async () => {
    await getOMSimulation({ n_ctv: 3, crews_per_ctv: 2, mode: "shifts" });
    expect(url()).toBe("/api/v1/lifecycle/om-simulation?n_ctv=3&crews_per_ctv=2&mode=shifts");
  });

  it("throws the server's detail", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 422, statusText: "Unprocessable", json: () => Promise.resolve({ detail: "bad f_sw" }) });
    await expect(runConverterStability({ f_sw_hz: 1 })).rejects.toThrow("bad f_sw");
  });
});
