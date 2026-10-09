/**
 * Zustand store for map layer visibility toggles.
 *
 * Each boolean flag controls whether a data layer is rendered
 * on the Control Room map. Toggles are session-level UI state
 * (not persisted). Separate from landingStore to keep concerns clean.
 */

import { create } from "zustand";
import { readStored, writeStored } from "../lib/storage";

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
  /** 500 m safety zones around every structure (UNCLOS Art. 60) */
  safetyZones: boolean;
  /** IALA G1162 lights on peripheral turbines + cardinal marks */
  navAids: boolean;
  /** O&M vessels (SOV, CTV) — simulated, sea-state limited */
  vessels: boolean;
  /** SwePol HVDC link and neighbouring planned OWF areas */
  gridContext: boolean;
  /** Fibre-optic SCADA network (array + export FO, microwave backup) */
  fibreComms: boolean;
  /** Live AIS traffic (aisstream.io via backend; needs AISSTREAM_API_KEY) */
  aisTraffic: boolean;
  /** Export cable DTS temperature profile (IEC 60287 model) */
  cableDts: boolean;
}

/** Map look: ISA-101 control room (default) or the hand-drawn "storybook" demo. */
export type MapTheme = "hmi" | "storybook";

const THEME_KEY = "of.mapTheme";
function loadTheme(): MapTheme {
  return readStored(THEME_KEY) === "hmi" ? "hmi" : "storybook";
}

interface LayerState {
  layers: LayerVisibility;
  toggleLayer: (key: keyof LayerVisibility) => void;
  setLayer: (key: keyof LayerVisibility, on: boolean) => void;
  mapTheme: MapTheme;
  setMapTheme: (t: MapTheme) => void;
  /**
   * Show the classic Leaflet map instead of the MapLibre + deck.gl map. Kept
   * while the remaining layers (AIS, waves, wind flow, nav aids…) move over.
   */
  classicMap: boolean;
  setClassicMap: (on: boolean) => void;
}

export const useLayerStore = create<LayerState>((set) => ({
  layers: {
    windParticles: true,
    // Wake envelopes are a planning view (Layout); off in the Control Room until asked for
    wakeEffects: false,
    oceanWaves: true,
    arrayCables: true,
    exclusionZone: true,
    foundations: true,
    turbineLabels: true,
    bathymetry: true,
    dayNightTint: true,
    safetyZones: true,
    navAids: true,
    vessels: true,
    gridContext: true,
    fibreComms: false,
    aisTraffic: true,
    cableDts: false,
  },
  mapTheme: loadTheme(),
  classicMap: false,
  setClassicMap: (classicMap) => set({ classicMap }),
  setMapTheme: (mapTheme) => {
    // private mode / blocked storage: theme just isn't remembered
    writeStored(THEME_KEY, mapTheme);
    set({ mapTheme });
  },
  setLayer: (key, on) => set((state) => ({ layers: { ...state.layers, [key]: on } })),
  toggleLayer: (key) =>
    set((state) => ({
      layers: { ...state.layers, [key]: !state.layers[key] },
    })),
}));
