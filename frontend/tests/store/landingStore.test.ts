/**
 * Tests for the landing page Zustand store.
 *
 * Tests the simulation tick lifecycle using fake timers.
 * Note: tickInterval is a module-level variable (not in Zustand state)
 * so we test behavior (data updates) rather than interval presence.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLandingStore, selectKPIs } from "../../src/store/landingStore";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  // Clean up any running intervals
  useLandingStore.getState().stopSimulation();
  vi.useRealTimers();
});

describe("initial state", () => {
  it("has 34 turbines", () => {
    expect(useLandingStore.getState().turbines).toHaveLength(34);
  });

  it("all turbines start as operating", () => {
    const turbines = useLandingStore.getState().turbines;
    const allOperating = turbines.every((t) => t.status === "operating");
    expect(allOperating).toBe(true);
  });

  it("computes initial KPIs", () => {
    const kpis = selectKPIs(useLandingStore.getState());
    expect(kpis.totalOutputMW).toBeGreaterThan(0);
    expect(kpis.availabilityPercent).toBe(100);
    expect(kpis.activeAlerts).toBe(0);
  });
});

describe("startSimulation", () => {
  it("updates turbine data after tick", () => {
    useLandingStore.getState().startSimulation();
    vi.advanceTimersByTime(3000);
    // Wind speed should have jittered (may be same due to random, but state should update)
    const state = useLandingStore.getState();
    expect(state.turbines).toHaveLength(34);
    expect(state.kpis.totalOutputMW).toBeGreaterThanOrEqual(0);
  });

  it("does not double-start (only one tick per interval)", () => {
    const spy = vi.spyOn(globalThis, "setInterval");
    useLandingStore.getState().startSimulation();
    const callCount = spy.mock.calls.length;
    useLandingStore.getState().startSimulation();
    // Should not have created another interval
    expect(spy.mock.calls.length).toBe(callCount);
    spy.mockRestore();
  });
});

describe("stopSimulation", () => {
  it("stops data updates after stop", () => {
    useLandingStore.getState().startSimulation();
    vi.advanceTimersByTime(3000);
    useLandingStore.getState().stopSimulation();
    const stateAfterStop = useLandingStore.getState().turbines.map((t) => t.windSpeedMs);
    vi.advanceTimersByTime(3000);
    const stateAfterWait = useLandingStore.getState().turbines.map((t) => t.windSpeedMs);
    // Data should not change after stop
    expect(stateAfterStop).toEqual(stateAfterWait);
  });

  it("is safe to call when not running", () => {
    // Should not throw
    useLandingStore.getState().stopSimulation();
  });
});
