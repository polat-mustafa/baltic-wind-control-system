/**
 * Shared Plotly layout defaults for Baltic Night theme.
 *
 * All chart panels import this base layout to ensure consistent
 * dark background, grid colours, and font settings.
 * Uses IBM Plex Sans for labels and IBM Plex Mono for axis values.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export const DARK_PLOTLY_LAYOUT: Record<string, any> = {
  paper_bgcolor: "#0f1d2b", // bg-secondary
  plot_bgcolor: "#0a1520", // bg-primary
  font: {
    color: "#e4ecf3", // text-primary
    family: "'IBM Plex Sans', sans-serif",
    size: 14,
  },
  margin: { t: 44, r: 24, b: 56, l: 68 },
  xaxis: {
    gridcolor: "rgba(31, 52, 72, 0.9)", // border-primary
    zerolinecolor: "rgba(44, 71, 96, 0.8)", // border-secondary
    tickfont: {
      family: "'IBM Plex Mono', monospace",
      size: 12,
      color: "#a3b6c8", // text-secondary
    },
  },
  yaxis: {
    gridcolor: "rgba(31, 52, 72, 0.9)",
    zerolinecolor: "rgba(44, 71, 96, 0.8)",
    tickfont: {
      family: "'IBM Plex Mono', monospace",
      size: 12,
      color: "#a3b6c8",
    },
  },
  legend: {
    font: {
      color: "#a3b6c8",
      size: 12,
    },
    bgcolor: "transparent",
  },
  hoverlabel: {
    bgcolor: "#172a3d", // bg-elevated
    bordercolor: "#2c4760", // border-secondary
    font: {
      family: "'IBM Plex Mono', monospace",
      size: 13,
      color: "#e4ecf3",
    },
  },
};

export const PLOTLY_CONFIG: Record<string, any> = {
  displayModeBar: "hover",
  displaylogo: false,
  modeBarButtonsToRemove: ["lasso2d", "select2d", "sendDataToCloud"],
  responsive: true,
};

/** Dynamic chart height — responsive to viewport */
export const CHART_HEIGHT = "max(420px, 38vh)";
