/**
 * TwinComparisonPanel — Plotly overlay: actual vs twin vs wind.
 *
 * Shows actual power (blue solid), twin prediction (green dashed),
 * and wind speed (gray, secondary y-axis). Shaded residual region
 * between actual and twin highlights deviations.
 */

import Plot from "react-plotly.js";

import { ChartWrapper } from "../ui/ChartWrapper";
import { useDigitalTwinStore } from "../../store/digitalTwinStore";

const PLOTLY_LAYOUT_BASE: Partial<Plotly.Layout> = {
  paper_bgcolor: "transparent",
  plot_bgcolor: "transparent",
  font: { color: "#94a3b8", size: 10 },
  margin: { t: 30, r: 60, b: 40, l: 50 },
  legend: { orientation: "h", y: 1.12, x: 0.5, xanchor: "center" },
  xaxis: {
    title: { text: "Timestep" },
    gridcolor: "rgba(148,163,184,0.1)",
    zeroline: false,
  },
  yaxis: {
    title: { text: "Power [MW]" },
    gridcolor: "rgba(148,163,184,0.1)",
    zeroline: false,
  },
  yaxis2: {
    title: { text: "Wind [m/s]" },
    overlaying: "y",
    side: "right",
    gridcolor: "rgba(148,163,184,0.05)",
    zeroline: false,
  },
};

export default function TwinComparisonPanel() {
  const analysis = useDigitalTwinStore((s) => s.analysis);

  if (!analysis) return null;

  const { comparison_data: cd } = analysis;
  const x = cd.timestamps.map((_, i) => i);

  const traces: Plotly.Data[] = [
    {
      x,
      y: cd.actual_power_mw,
      name: "Actual Power",
      type: "scatter",
      mode: "lines",
      line: { color: "#3b82f6", width: 1.5 },
    },
    {
      x,
      y: cd.twin_power_mw,
      name: "Twin Prediction",
      type: "scatter",
      mode: "lines",
      line: { color: "#22c55e", width: 1.5, dash: "dash" },
    },
    {
      x,
      y: cd.wind_speed_ms,
      name: "Wind Speed",
      type: "scatter",
      mode: "lines",
      line: { color: "#64748b", width: 1 },
      yaxis: "y2",
      opacity: 0.5,
    },
  ];

  return (
    <ChartWrapper
      title="Twin vs Actual — Worst Turbine"
      footer={`Showing ${analysis.farm_health.worst_turbine_name}. Blue = actual, green dashed = twin prediction.`}
    >
      <Plot
        data={traces}
        layout={{
          ...PLOTLY_LAYOUT_BASE,
          height: 380,
        }}
        config={{ responsive: true, displayModeBar: false }}
        className="w-full"
      />
    </ChartWrapper>
  );
}
