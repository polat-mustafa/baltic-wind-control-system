/**
 * HealthTrendPanel — Health index over time with degradation trend.
 *
 * Shows composite health % for the selected (or worst) turbine,
 * with a linear regression line and RUL projection if degrading.
 */

import Plot from "react-plotly.js";

import { ChartWrapper } from "../ui/ChartWrapper";
import { useDigitalTwinStore } from "../../store/digitalTwinStore";

export default function HealthTrendPanel() {
  const analysis = useDigitalTwinStore((s) => s.analysis);
  const selectedTurbineId = useDigitalTwinStore((s) => s.selectedTurbineId);

  if (!analysis) return null;

  const turbineId = selectedTurbineId ?? analysis.farm_health.worst_turbine_id;
  const trend = analysis.degradation_trends[turbineId];

  if (!trend) return null;

  const x = trend.health_values.map((_, i) => i);

  // Linear regression line
  const n = trend.health_values.length;
  const first = trend.health_values[0] ?? 100;
  const last = trend.health_values[n - 1] ?? 100;
  const regressionY = x.map((i) => first + ((last - first) / (n - 1)) * i);

  const traces: Plotly.Data[] = [
    {
      x,
      y: trend.health_values,
      name: "Health Index",
      type: "scatter",
      mode: "lines",
      line: { color: "#22c55e", width: 2 },
      fill: "tozeroy",
      fillcolor: "rgba(34,197,94,0.1)",
    },
    {
      x,
      y: regressionY,
      name: "Trend Line",
      type: "scatter",
      mode: "lines",
      line: { color: "#ef4444", width: 1.5, dash: "dash" },
    },
    {
      x,
      y: Array(n).fill(40),
      name: "Critical Threshold",
      type: "scatter",
      mode: "lines",
      line: { color: "#f59e0b", width: 1, dash: "dot" },
    },
  ];

  const rulText = trend.rul_days !== null
    ? `RUL: ~${trend.rul_days.toFixed(0)} days`
    : "No degradation detected";

  return (
    <ChartWrapper
      title={`Health Trend — ${trend.turbine_name}`}
      footer={`Slope: ${trend.slope_pct_per_day.toFixed(2)} %/day | ${rulText}`}
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
            title: { text: "Health [%]" },
            gridcolor: "rgba(148,163,184,0.1)",
            zeroline: false,
            range: [0, 105],
          },
          height: 250,
        }}
        config={{ responsive: true, displayModeBar: false }}
        className="w-full"
      />
    </ChartWrapper>
  );
}
