/**
 * Live weather drives the one plant state: default source, snap to the first
 * reading, stale readings fall back to the simulation, and the farm wind the
 * KPI strip shows is the freestream the turbines are built from.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { liveFleet } from "../../src/lib/fleet";
import type { LiveWeather } from "../../src/services/openMeteoApi";
import { LIVE_MAX_AGE_MS, useLandingStore } from "../../src/store/landingStore";
import { farmWakeDeficits } from "../../src/utils/landingPhysics";

const reading = (hub: number, dir = 270, ageMs = 0): LiveWeather => ({
  fetchedAt: Date.now() - ageMs,
  time: "2026-10-11T10:00",
  wind10Ms: hub * 0.7,
  windDir10Deg: dir,
  gust10Ms: hub,
  wind100Ms: hub * 0.95,
  windDir100Deg: dir,
  hubWindMs: hub,
  airTempC: 12,
  pressureHpa: 1010,
  cloudPct: 50,
  visibilityKm: 20,
  waveHeightM: 1.7,
  wavePeriodS: 6.3,
  waveDirDeg: dir,
  seaTempC: 14,
});

// One simulation interval for the file (it runs for the app's lifetime and cannot be stopped)
beforeAll(() => {
  vi.useFakeTimers();
  useLandingStore.getState().startSimulation();
});
afterAll(() => vi.useRealTimers());
afterEach(() => useLandingStore.getState().setLiveWeather(null));

describe("live weather", () => {
  it("is the default source", () => {
    expect(useLandingStore.getState().weatherSource).toBe("live");
  });

  it("starts the plant at the first live reading and the turbines follow it", () => {
    useLandingStore.getState().setLiveWeather(reading(17));
    vi.advanceTimersByTime(5000 * 4);
    const { kpis, environment, turbineMap } = useLandingStore.getState();
    // freestream = live hub wind ± the 6 % turbulence term, smoothed
    expect(kpis.freestreamWindMs).toBeGreaterThan(16);
    expect(kpis.freestreamWindMs).toBeLessThan(18);
    expect(environment.significantWaveHeightM).toBe(1.7);
    // the turbines are built from that freestream: undo each wake deficit and the
    // spread across the array averages out (centred position term)
    const deficits = farmWakeDeficits(kpis.windDirectionDeg, liveFleet(), kpis.freestreamWindMs);
    const free = Object.values(turbineMap)
      .filter((t) => t.status === "operating" || t.status === "curtailed")
      .map((t) => t.windSpeedMs / (1 - (deficits.get(t.id) ?? 0)));
    const mean = free.reduce((s, v) => s + v, 0) / free.length;
    expect(Math.abs(mean - kpis.freestreamWindMs)).toBeLessThan(0.6);
  });

  it("falls back to the simulation on a reading older than the limit", () => {
    useLandingStore.getState().setLiveWeather(reading(30, 270, LIVE_MAX_AGE_MS + 1000));
    vi.advanceTimersByTime(5000 * 3);
    // the simulation keeps the wind inside 7–15 m/s; a 30 m/s live reading would not
    expect(useLandingStore.getState().kpis.freestreamWindMs).toBeLessThanOrEqual(15);
  });
});
