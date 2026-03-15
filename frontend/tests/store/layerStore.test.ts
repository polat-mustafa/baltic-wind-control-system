/**
 * Tests for the layer visibility Zustand store.
 *
 * Verifies that all 9 layer toggles start true, that toggleLayer
 * flips a single layer, and that toggling twice restores the original.
 */

import { describe, expect, it } from "vitest";
import { useLayerStore } from "../../src/store/layerStore";
import type { LayerVisibility } from "../../src/store/layerStore";

const ALL_LAYER_KEYS: (keyof LayerVisibility)[] = [
  "windParticles",
  "wakeEffects",
  "oceanWaves",
  "arrayCables",
  "exclusionZone",
  "foundations",
  "turbineLabels",
  "bathymetry",
  "dayNightTint",
];

describe("initial state", () => {
  it("has all 9 layers set to true", () => {
    const { layers } = useLayerStore.getState();
    for (const key of ALL_LAYER_KEYS) {
      expect(layers[key]).toBe(true);
    }
  });

  it("has exactly 9 layer keys", () => {
    const { layers } = useLayerStore.getState();
    expect(Object.keys(layers)).toHaveLength(9);
  });
});

describe("toggleLayer", () => {
  it("flips a single layer to false", () => {
    useLayerStore.getState().toggleLayer("windParticles");
    expect(useLayerStore.getState().layers.windParticles).toBe(false);
    // Reset for other tests
    useLayerStore.getState().toggleLayer("windParticles");
  });

  it("does not affect other layers when toggling one", () => {
    useLayerStore.getState().toggleLayer("bathymetry");
    const { layers } = useLayerStore.getState();
    expect(layers.bathymetry).toBe(false);
    expect(layers.windParticles).toBe(true);
    expect(layers.oceanWaves).toBe(true);
    // Reset
    useLayerStore.getState().toggleLayer("bathymetry");
  });

  it("toggling twice returns to original value", () => {
    for (const key of ALL_LAYER_KEYS) {
      useLayerStore.getState().toggleLayer(key);
      useLayerStore.getState().toggleLayer(key);
      expect(useLayerStore.getState().layers[key]).toBe(true);
    }
  });
});
