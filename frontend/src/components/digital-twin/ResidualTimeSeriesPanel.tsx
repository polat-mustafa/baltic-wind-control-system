/**
 * ResidualTimeSeriesPanel — Power residual % + EWMA trend line.
 *
 * Shows raw residual (light scatter) and EWMA (bold line) to visualize
 * when deviations become persistent vs transient noise.
 */

import Plot from "react-plotly.js";

import { ChartWrapper } from "../ui/ChartWrapper";
import { useDigitalTwinStore } from "../../store/digitalTwinStore";

export default function ResidualTimeSeriesPanel() {
  const analysis = useDigitalTwinStore((s) => s.analysis);

  if (!analysis) return null;

  const { comparison_data: cd } = analysis;
  const x = cd.timestamps.map((_, i) => i);

  const traces: Plotly.Data[] = [
    {
      x,
      y: cd.residual_pct,
      name: "Raw Residual",
      type: "scatter",
      mode: "lines",
      line: { color: "#94a3b8", width: 0.8 },
      opacity: 0.4,
    },
    {
      x,
      y: cd.power_ewma,
      name: "EWMA Trend",
      type: "scatter",
      mode: "lines",
      line: { color: "#f59e0b", width: 2 },
    },
    {
      x,
      y: Array(x.length).fill(0),
      name: "Zero Line",
      type: "scatter",
      mode: "lines",
      line: { color: "#64748b", width: 1, dash: "dot" },
      showlegend: false,
    },
  ];

  return (
    <ChartWrapper
      title="Residual Time Series"
      footer="EWMA smoothing (span=24) filters noise. Persistent deviations indicate real faults."
    >
      <Plot
        data={traces}
        layout={{
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
          font: { color: "#94a3b8", size: 10 },
          margin: { t: 20, r: 20, b: 40, l: 50 },
          legend: { orientation: "h", y: 1.12, x: 0.5, xanchor: "center" },
          xaxis: {
            title: { text: "Timestep" },
            gridcolor: "rgba(148,163,184,0.1)",
            zeroline: false,
          },
          yaxis: {
            title: { text: "Residual [%]" },
            gridcolor: "rgba(148,163,184,0.1)",
            zeroline: false,
          },
          height: 380,
        }}
        config={{ responsive: true, displayModeBar: false }}
        className="w-full"
      />
    </ChartWrapper>
  );
}
