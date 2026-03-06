/**
 * TSR, Cp, and Yaw Error vs Time chart.
 *
 * 3 traces: tip_speed_ratio (cyan), cp (purple), yaw_error_deg (blue).
 * Yaw deadband ±8° shown as shaded region.
 */

import Plot from "react-plotly.js";

import { ChartWrapper } from "../ui/ChartWrapper";
import {
  CHART_HEIGHT,
  DARK_PLOTLY_LAYOUT,
  PLOTLY_CONFIG,
} from "../../constants/plotlyDefaults";
import { useTurbinePhysicsStore } from "../../store/turbinePhysicsStore";

export default function TsrCpYawChart() {
  const simulation = useTurbinePhysicsStore((s) => s.simulation);
  if (!simulation) return null;

  // Downsample to max 500 points
  const len = simulation.time_s.length;
  const step = Math.max(1, Math.floor(len / 500));
  const ds = <T,>(arr: T[]) => arr.filter((_, i) => i % step === 0);

  const time = ds(simulation.time_s);
  const tsr = ds(simulation.tip_speed_ratio);
  const cp = ds(simulation.cp);
  const yaw = ds(simulation.yaw_error_deg);

  const traces: Plotly.Data[] = [
    {
      x: time,
      y: tsr,
      name: "TSR (λ)",
      type: "scatter",
      mode: "lines",
      line: { color: "#06b6d4", width: 2 },
      hovertemplate: "λ = %{y:.2f}<extra></extra>",
    },
    {
      x: time,
      y: cp,
      name: "Cp",
      type: "scatter",
      mode: "lines",
      line: { color: "#a855f7", width: 2 },
      yaxis: "y2",
      hovertemplate: "Cp = %{y:.4f}<extra></extra>",
    },
    {
      x: time,
      y: yaw,
      name: "Yaw Error",
      type: "scatter",
      mode: "lines",
      line: { color: "#3b82f6", width: 1.5 },
      yaxis: "y3",
      hovertemplate: "%{y:.1f}°<extra></extra>",
    },
    // Yaw deadband upper boundary
    {
      x: [time[0], time[time.length - 1]],
      y: [8, 8],
      name: "Yaw Deadband (±8°)",
      type: "scatter",
      mode: "lines",
      line: { color: "rgba(59,130,246,0.3)", width: 1, dash: "dash" },
      yaxis: "y3",
      showlegend: true,
      hoverinfo: "skip",
    },
    // Yaw deadband lower boundary
    {
      x: [time[0], time[time.length - 1]],
      y: [-8, -8],
      type: "scatter",
      mode: "lines",
      line: { color: "rgba(59,130,246,0.3)", width: 1, dash: "dash" },
      yaxis: "y3",
      showlegend: false,
      hoverinfo: "skip",
      fill: "tonexty",
      fillcolor: "rgba(59,130,246,0.06)",
    },
  ];

  const layout: Partial<Plotly.Layout> = {
    ...DARK_PLOTLY_LAYOUT,
    title: undefined,
    xaxis: {
      ...DARK_PLOTLY_LAYOUT.xaxis,
      title: "Time [s]",
      domain: [0, 1],
    },
    yaxis: {
      ...DARK_PLOTLY_LAYOUT.yaxis,
      title: "TSR λ [-]",
      titlefont: { color: "#06b6d4" },
    },
    yaxis2: {
      title: { text: "Cp [-]", font: { color: "#a855f7" } },
      overlaying: "y",
      side: "right",
      gridcolor: "transparent",
      tickfont: {
        family: "'JetBrains Mono', monospace",
        size: 10,
        color: "#a855f7",
      },
    },
    yaxis3: {
      title: { text: "Yaw Error [deg]", font: { color: "#3b82f6" } },
      overlaying: "y",
      side: "right",
      position: 0.95,
      gridcolor: "transparent",
      tickfont: {
        family: "'JetBrains Mono', monospace",
        size: 10,
        color: "#3b82f6",
      },
    },
    legend: {
      ...DARK_PLOTLY_LAYOUT.legend,
      orientation: "h",
      x: 0,
      y: 1.15,
    },
    margin: { ...DARK_PLOTLY_LAYOUT.margin, r: 80 },
  };

  return (
    <ChartWrapper title="TSR, Cp & Yaw Error">
      <div style={{ height: CHART_HEIGHT }}>
        <Plot
          data={traces}
          layout={layout}
          config={PLOTLY_CONFIG}
          className="w-full h-full"
          useResizeHandler
        />
      </div>
    </ChartWrapper>
  );
}
