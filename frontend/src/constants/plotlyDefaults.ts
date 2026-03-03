/**
 * Shared Plotly layout defaults for ISA-101 dark SCADA theme.
 *
 * All chart panels import this base layout to ensure consistent
 * dark background, grid colours, and font settings.
 * Uses Inter for labels and JetBrains Mono for axis values.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export const DARK_PLOTLY_LAYOUT: Record<string, any> = {
  paper_bgcolor: "#161924", // bg-secondary
  plot_bgcolor: "#0f1117", // bg-primary
  font: {
    color: "#e8eaf0", // text-primary
    family: "'Inter', sans-serif",
    size: 11,
  },
  margin: { t: 40, r: 20, b: 50, l: 60 },
  xaxis: {
    gridcolor: "rgba(42, 48, 64, 0.8)", // border-primary
    zerolinecolor: "rgba(61, 69, 96, 0.6)", // border-secondary
    tickfont: {
      family: "'JetBrains Mono', monospace",
      size: 10,
      color: "#9ba3b8", // text-secondary
    },
  },
  yaxis: {
    gridcolor: "rgba(42, 48, 64, 0.8)",
    zerolinecolor: "rgba(61, 69, 96, 0.6)",
    tickfont: {
      family: "'JetBrains Mono', monospace",
      size: 10,
      color: "#9ba3b8",
    },
  },
  legend: {
    font: {
      color: "#9ba3b8",
      size: 10,
    },
    bgcolor: "transparent",
  },
  hoverlabel: {
    bgcolor: "#252a3a", // bg-elevated
    bordercolor: "#3d4560", // border-secondary
    font: {
      family: "'JetBrains Mono', monospace",
      size: 11,
      color: "#e8eaf0",
    },
  },
};

export const PLOTLY_CONFIG: Record<string, any> = {
  displayModeBar: false,
  responsive: true,
};
