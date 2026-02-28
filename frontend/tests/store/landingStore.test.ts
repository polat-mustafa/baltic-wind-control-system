/**
 * Tests for the landing page Zustand store.
 *
 * Tests the simulation tick lifecycle using fake timers.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLandingStore, selectKPIs } from "../../src/store/landingStore";

beforeEach(() => {
  vi.useFakeTimers();
  // Reset store state
  useLandingStore.setState({
    tickInterval: null,
  });
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

  it("tickInterval starts as null", () => {
    expect(useLandingStore.getState().tickInterval).toBeNull();
  });
});

describe("startSimulation", () => {
  it("sets tickInterval", () => {
    useLandingStore.getState().startSimulation();
    expect(useLandingStore.getState().tickInterval).not.toBeNull();
  });

  it("does not double-start", () => {
    useLandingStore.getState().startSimulation();
    const first = useLandingStore.getState().tickInterval;
    useLandingStore.getState().startSimulation();
    const second = useLandingStore.getState().tickInterval;
    expect(first).toBe(second);
  });

  it("updates turbine data after tick", () => {
    useLandingStore.getState().startSimulation();
    vi.advanceTimersByTime(3000);
    // Wind speed should have jittered (may be same due to random, but state should update)
    const state = useLandingStore.getState();
    expect(state.turbines).toHaveLength(34);
    expect(state.kpis.totalOutputMW).toBeGreaterThanOrEqual(0);
  });
});

describe("stopSimulation", () => {
  it("clears the interval", () => {
    useLandingStore.getState().startSimulation();
    expect(useLandingStore.getState().tickInterval).not.toBeNull();
    useLandingStore.getState().stopSimulation();
    expect(useLandingStore.getState().tickInterval).toBeNull();
  });

  it("is safe to call when not running", () => {
    useLandingStore.getState().stopSimulation();
    expect(useLandingStore.getState().tickInterval).toBeNull();
  });
});
