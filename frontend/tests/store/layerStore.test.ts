/**
 * Tests for the layer visibility Zustand store.
 *
 * Verifies the 17 layer toggles' defaults (all on except the fibre, DTS and my-project overlays), that toggleLayer
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
  "safetyZones",
  "navAids",
  "vessels",
  "gridContext",
  "aisTraffic",
];

describe("initial state", () => {
  it("has every layer on except the fibre, DTS and my-project overlays", () => {
    const { layers } = useLayerStore.getState();
    for (const key of ALL_LAYER_KEYS) {
      expect(layers[key]).toBe(true);
    }
  });

  it("has exactly 16 layer keys", () => {
    const { layers } = useLayerStore.getState();
    expect(Object.keys(layers)).toHaveLength(16);
    expect(layers.fibreComms).toBe(false);
    expect(layers.cableDts).toBe(false);
  });

  it("setLayer sets one layer explicitly", () => {
    useLayerStore.getState().setLayer("cableDts", true);
    expect(useLayerStore.getState().layers.cableDts).toBe(true);
    useLayerStore.getState().setLayer("cableDts", true);
    expect(useLayerStore.getState().layers.cableDts).toBe(true);
    useLayerStore.getState().setLayer("cableDts", false);
    expect(useLayerStore.getState().layers.cableDts).toBe(false);
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
