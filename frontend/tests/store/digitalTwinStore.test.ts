/**
 * Tests for the Digital Twin Zustand store.
 *
 * Verifies initial state defaults and synchronous setters.
 * Async API actions (fetchConfig, runAnalysis) are NOT tested here.
 */

import { describe, expect, it } from "vitest";
import { useDigitalTwinStore } from "../../src/store/digitalTwinStore";

describe("initial state", () => {
  it("has null data fields", () => {
    const state = useDigitalTwinStore.getState();
    expect(state.config).toBeNull();
    expect(state.scenarios).toBeNull();
    expect(state.analysis).toBeNull();
  });

  it("has correct default selections", () => {
    const state = useDigitalTwinStore.getState();
    expect(state.selectedScenario).toBe("healthy");
    expect(state.selectedTurbineId).toBeNull();
    expect(state.numTimesteps).toBe(144);
    expect(state.numTurbines).toBe(34);
  });

  it("has clean UI state", () => {
    const state = useDigitalTwinStore.getState();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.analysisRun).toBe(false);
    expect(state.progress).toBe(0);
  });
});

describe("setters", () => {
  it("setSelectedScenario updates scenario", () => {
    useDigitalTwinStore.getState().setSelectedScenario("degraded_pitch");
    expect(useDigitalTwinStore.getState().selectedScenario).toBe("degraded_pitch");
    // Reset
    useDigitalTwinStore.getState().setSelectedScenario("healthy");
  });

  it("setSelectedTurbineId updates turbine", () => {
    useDigitalTwinStore.getState().setSelectedTurbineId(7);
    expect(useDigitalTwinStore.getState().selectedTurbineId).toBe(7);
    // Reset
    useDigitalTwinStore.getState().setSelectedTurbineId(null);
  });

  it("setNumTimesteps updates value", () => {
    useDigitalTwinStore.getState().setNumTimesteps(288);
    expect(useDigitalTwinStore.getState().numTimesteps).toBe(288);
    // Reset
    useDigitalTwinStore.getState().setNumTimesteps(144);
  });

  it("setNumTurbines updates value", () => {
    useDigitalTwinStore.getState().setNumTurbines(10);
    expect(useDigitalTwinStore.getState().numTurbines).toBe(10);
    // Reset
    useDigitalTwinStore.getState().setNumTurbines(34);
  });
});

describe("clearError", () => {
  it("clears an existing error", () => {
    // Manually inject an error via setState for testing
    useDigitalTwinStore.setState({ error: "Something went wrong" });
    expect(useDigitalTwinStore.getState().error).toBe("Something went wrong");

    useDigitalTwinStore.getState().clearError();
    expect(useDigitalTwinStore.getState().error).toBeNull();
  });
});
