/**
 * Tests for the Turbine Physics Zustand store.
 *
 * Verifies initial state defaults, synchronous parameter setters,
 * and clearError. Async API actions are NOT tested here.
 */

import { describe, expect, it } from "vitest";
import { useTurbinePhysicsStore } from "../../src/store/turbinePhysicsStore";

describe("initial state", () => {
  it("has null data fields", () => {
    const state = useTurbinePhysicsStore.getState();
    expect(state.config).toBeNull();
    expect(state.cpSurface).toBeNull();
    expect(state.simulation).toBeNull();
  });

  it("has correct scenario defaults", () => {
    const state = useTurbinePhysicsStore.getState();
    expect(state.scenario).toBe("step_response");
    expect(state.stepInitMs).toBe(8);
    expect(state.stepFinalMs).toBe(14);
    expect(state.stepRampS).toBe(10);
    expect(state.stepTotalS).toBe(120);
    expect(state.constantWindMs).toBe(10);
  });

  it("has correct oscillating defaults", () => {
    const state = useTurbinePhysicsStore.getState();
    expect(state.oscMeanMs).toBe(10);
    expect(state.oscAmplitudeMs).toBe(3);
    expect(state.oscPeriodS).toBe(30);
    expect(state.oscDurationS).toBe(120);
  });

  it("has correct simulation setting defaults", () => {
    const state = useTurbinePhysicsStore.getState();
    expect(state.dt).toBe(0.1);
    expect(state.initialRotorSpeedRpm).toBe(7.0);
    expect(state.airDensityKgM3).toBe(1.225);
  });

  it("has clean UI state", () => {
    const state = useTurbinePhysicsStore.getState();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.analysisRun).toBe(false);
  });
});

describe("setters", () => {
  it("setScenario updates scenario", () => {
    useTurbinePhysicsStore.getState().setScenario("constant");
    expect(useTurbinePhysicsStore.getState().scenario).toBe("constant");
    // Reset
    useTurbinePhysicsStore.getState().setScenario("step_response");
  });

  it("setStepInitMs updates value", () => {
    useTurbinePhysicsStore.getState().setStepInitMs(12);
    expect(useTurbinePhysicsStore.getState().stepInitMs).toBe(12);
    // Reset
    useTurbinePhysicsStore.getState().setStepInitMs(8);
  });

  it("setDt updates value", () => {
    useTurbinePhysicsStore.getState().setDt(0.05);
    expect(useTurbinePhysicsStore.getState().dt).toBe(0.05);
    // Reset
    useTurbinePhysicsStore.getState().setDt(0.1);
  });

  it("setAirDensityKgM3 updates value", () => {
    useTurbinePhysicsStore.getState().setAirDensityKgM3(1.18);
    expect(useTurbinePhysicsStore.getState().airDensityKgM3).toBe(1.18);
    // Reset
    useTurbinePhysicsStore.getState().setAirDensityKgM3(1.225);
  });
});

describe("clearError", () => {
  it("clears an existing error", () => {
    useTurbinePhysicsStore.setState({ error: "Simulation failed" });
    expect(useTurbinePhysicsStore.getState().error).toBe("Simulation failed");

    useTurbinePhysicsStore.getState().clearError();
    expect(useTurbinePhysicsStore.getState().error).toBeNull();
  });
});
