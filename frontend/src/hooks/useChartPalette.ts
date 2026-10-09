/**
 * Chart palette for analytical (Plotly) charts — one set per app theme.
 *
 * Categorical slots validated with the dataviz palette checker against each
 * chart surface (storybook paper #f7edd4, Baltic Night #0f1d2b): all-pairs CVD ΔE ≥ 9,
 * normal-vision ΔE ≥ 20. Light orange/aqua sit below 3:1 on paper, so charts
 * using them carry direct labels. Sequential = one hue (blue), light → dark
 * on paper and dark → light on the dark surface ("more" is always more ink).
 */

import { useLayerStore } from "../store/layerStore";

export interface ChartPalette {
  /** Primary series / energy. */
  blue: string;
  /** Secondary series (e.g. fitted curve, energy rose). */
  orange: string;
  /** Third series. */
  aqua: string;
  /** Fourth series (adjacent-pair validated after aqua). */
  yellow: string;
  /** Losses / negative change. */
  red: string;
  /** Ordered magnitude ramp, low → high (6 steps). */
  seq: string[];
  /** Text drawn inside the plot (labels on points) — theme ink. */
  ink: string;
  /** Reference lines and annotations. */
  ref: string;
  /** Recessive fills (bands, regions). */
  band: string;
}

const LIGHT: ChartPalette = {
  blue: "#2a78d6",
  orange: "#eb6834",
  aqua: "#1baf7a",
  yellow: "#eda100",
  red: "#e34948",
  seq: ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281", "#0d366b"],
  ink: "#2b2118",
  ref: "rgba(43, 33, 24, 0.6)",
  band: "rgba(43, 33, 24, 0.06)",
};

const DARK: ChartPalette = {
  // Baltic Night: cyan · orange · periwinkle · mustard — validated on #0f1d2b
  // (L 0.48–0.67, CVD ΔE ≥ 17.7, contrast ≥ 3:1). Slot names are historical.
  blue: "#1a9fb1",
  orange: "#d0712b",
  aqua: "#6a80e0",
  yellow: "#b08a1e",
  red: "#e05a52",
  seq: ["#0f3a46", "#12586a", "#17788c", "#1a9fb1", "#5cc3d2", "#a9e3eb"],
  ink: "#e4ecf3",
  ref: "rgba(228, 236, 243, 0.55)",
  band: "rgba(228, 236, 243, 0.05)",
};

export function useChartPalette(): ChartPalette {
  return useLayerStore((s) => s.mapTheme) === "storybook" ? LIGHT : DARK;
}

/** Plotly layout.transition — data changes (re-run, slider) animate instead of jumping. */
/** "#rrggbb" at opacity a (0…1) as "#rrggbbaa" — fills and bands in a series colour. */
export const withAlpha = (hex: string, a: number) => `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}`;

export const CHART_TRANSITION = { duration: 600, easing: "cubic-in-out" } as const;
