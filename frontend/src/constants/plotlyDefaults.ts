/**
 * Shared Plotly layout defaults for dark SCADA theme.
 *
 * All P1 charts import this base layout to ensure consistent
 * dark background, grid colours, and font settings across panels.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export const DARK_PLOTLY_LAYOUT: Record<string, any> = {
  paper_bgcolor: "rgb(30, 41, 59)", // slate-800
  plot_bgcolor: "rgb(15, 23, 42)", // slate-900
  font: {
    color: "rgb(203, 213, 225)", // slate-300
    family: "ui-monospace, monospace",
    size: 11,
  },
  margin: { t: 40, r: 20, b: 50, l: 60 },
  xaxis: {
    gridcolor: "rgba(148, 163, 184, 0.15)", // slate-400 @ 15%
    zerolinecolor: "rgba(148, 163, 184, 0.3)",
  },
  yaxis: {
    gridcolor: "rgba(148, 163, 184, 0.15)",
    zerolinecolor: "rgba(148, 163, 184, 0.3)",
  },
};

export const PLOTLY_CONFIG: Record<string, any> = {
  displayModeBar: false,
  responsive: true,
};
