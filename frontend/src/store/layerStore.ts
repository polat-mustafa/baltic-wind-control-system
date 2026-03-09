/**
 * Zustand store for map layer visibility toggles.
 *
 * Each boolean flag controls whether a data layer is rendered
 * on the Leaflet wind farm map. Toggles are session-level UI state
 * (not persisted). Separate from landingStore to keep concerns clean.
 */

import { create } from "zustand";

export interface LayerVisibility {
  windParticles: boolean;
  wakeEffects: boolean;
  oceanWaves: boolean;
  arrayCables: boolean;
  exclusionZone: boolean;
  foundations: boolean;
  turbineLabels: boolean;
  bathymetry: boolean;
  dayNightTint: boolean;
}

interface LayerState {
  layers: LayerVisibility;
  toggleLayer: (key: keyof LayerVisibility) => void;
}

export const useLayerStore = create<LayerState>((set) => ({
  layers: {
    windParticles: true,
    wakeEffects: true,
    oceanWaves: true,
    arrayCables: true,
    exclusionZone: true,
    foundations: true,
    turbineLabels: true,
    bathymetry: true,
    dayNightTint: true,
  },
  toggleLayer: (key) =>
    set((state) => ({
      layers: { ...state.layers, [key]: !state.layers[key] },
    })),
}));
