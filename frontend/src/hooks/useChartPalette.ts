/**
 * Chart palette for analytical (Plotly) charts — one set per app theme.
 *
 * Categorical slots validated with the dataviz palette checker against each
 * chart surface (storybook paper #f7edd4, HMI #0f1117): all-pairs CVD ΔE ≥ 9,
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
  blue: "#3987e5",
  orange: "#d95926",
  aqua: "#199e70",
  yellow: "#c98500",
  red: "#e66767",
  seq: ["#184f95", "#1c5cab", "#2a78d6", "#5598e7", "#86b6ef", "#cde2fb"],
  ink: "#e8eaf0",
  ref: "rgba(232, 234, 240, 0.55)",
  band: "rgba(232, 234, 240, 0.05)",
};

export function useChartPalette(): ChartPalette {
  return useLayerStore((s) => s.mapTheme) === "storybook" ? LIGHT : DARK;
}

/** Plotly layout.transition — data changes (re-run, slider) animate instead of jumping. */
export const CHART_TRANSITION = { duration: 600, easing: "cubic-in-out" } as const;
