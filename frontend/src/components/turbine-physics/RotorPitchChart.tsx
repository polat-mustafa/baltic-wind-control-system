/**
 * Rotor Speed + Pitch Angle dual-axis chart.
 *
 * Left axis: rotor_speed_rpm (green).
 * Right axis: pitch_angle_deg (orange).
 * Reference lines: max rotor speed 8.6 rpm, min 4.0 rpm.
 */

import Plot from "react-plotly.js";

import { ChartWrapper } from "../ui/ChartWrapper";
import {
  CHART_HEIGHT,
  DARK_PLOTLY_LAYOUT,
  PLOTLY_CONFIG,
} from "../../constants/plotlyDefaults";
import { useTurbinePhysicsStore } from "../../store/turbinePhysicsStore";

export default function RotorPitchChart() {
  const simulation = useTurbinePhysicsStore((s) => s.simulation);
  if (!simulation) return null;

  // Downsample to max 500 points
  const len = simulation.time_s.length;
  const step = Math.max(1, Math.floor(len / 500));
  const ds = <T,>(arr: T[]) => arr.filter((_, i) => i % step === 0);

  const time = ds(simulation.time_s);
  const rpm = ds(simulation.rotor_speed_rpm);
  const pitch = ds(simulation.pitch_angle_deg);

  const traces: Plotly.Data[] = [
    {
      x: time,
      y: rpm,
      name: "Rotor Speed",
      type: "scatter",
      mode: "lines",
      line: { color: "#3ecf6e", width: 2 },
      hovertemplate: "%{y:.2f} rpm<extra></extra>",
    },
    {
      x: time,
      y: pitch,
      name: "Pitch Angle",
      type: "scatter",
      mode: "lines",
      line: { color: "#f97316", width: 2 },
      yaxis: "y2",
      hovertemplate: "%{y:.1f} deg<extra></extra>",
    },
    // Max rotor speed reference
    {
      x: [time[0], time[time.length - 1]],
      y: [8.6, 8.6],
      name: "Max RPM (8.6)",
      type: "scatter",
      mode: "lines",
      line: { color: "#e74c3c", width: 1, dash: "dash" },
      showlegend: true,
      hoverinfo: "skip",
    },
    // Min rotor speed reference
    {
      x: [time[0], time[time.length - 1]],
      y: [4.0, 4.0],
      name: "Min RPM (4.0)",
      type: "scatter",
      mode: "lines",
      line: { color: "#9ba3b8", width: 1, dash: "dash" },
      showlegend: true,
      hoverinfo: "skip",
    },
  ];

  const layout: Partial<Plotly.Layout> = {
    ...DARK_PLOTLY_LAYOUT,
    title: undefined,
    yaxis: {
      ...DARK_PLOTLY_LAYOUT.yaxis,
      title: "Rotor Speed [rpm]",
    },
    yaxis2: {
      title: { text: "Pitch Angle [deg]" },
      overlaying: "y",
      side: "right",
      gridcolor: "transparent",
      tickfont: {
        family: "'JetBrains Mono', monospace",
        size: 10,
        color: "#9ba3b8",
      },
    },
    xaxis: {
      ...DARK_PLOTLY_LAYOUT.xaxis,
      title: "Time [s]",
    },
    legend: {
      ...DARK_PLOTLY_LAYOUT.legend,
      orientation: "h",
      x: 0,
      y: 1.15,
    },
  };

  return (
    <ChartWrapper title="Rotor Speed & Pitch Angle">
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
