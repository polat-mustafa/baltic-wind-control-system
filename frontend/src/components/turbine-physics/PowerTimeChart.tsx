/**
 * Power vs Time chart — electrical and aerodynamic power with wind speed overlay.
 *
 * 3 traces: electrical_power_mw (blue), aero_power_mw (amber),
 * wind_speed (secondary y-axis, dotted gray).
 * Horizontal dashed line at 15 MW rated.
 * Downsampled to 500 pts max for rendering performance.
 */

import Plot from "react-plotly.js";

import { ChartWrapper } from "../ui/ChartWrapper";
import {
  CHART_HEIGHT,
  DARK_PLOTLY_LAYOUT,
  PLOTLY_CONFIG,
} from "../../constants/plotlyDefaults";
import { useTurbinePhysicsStore } from "../../store/turbinePhysicsStore";

export default function PowerTimeChart() {
  const simulation = useTurbinePhysicsStore((s) => s.simulation);
  if (!simulation) return null;

  // Downsample to max 500 points
  const len = simulation.time_s.length;
  const step = Math.max(1, Math.floor(len / 500));
  const ds = <T,>(arr: T[]) => arr.filter((_, i) => i % step === 0);

  const time = ds(simulation.time_s);
  const elecPower = ds(simulation.electrical_power_mw);
  const aeroPower = ds(simulation.aero_power_mw);
  const wind = ds(simulation.wind_speed_ms);

  const traces: Plotly.Data[] = [
    {
      x: time,
      y: elecPower,
      name: "Electrical Power",
      type: "scatter",
      mode: "lines",
      line: { color: "#3b82f6", width: 2 },
      hovertemplate: "%{y:.2f} MW<extra></extra>",
    },
    {
      x: time,
      y: aeroPower,
      name: "Aero Power",
      type: "scatter",
      mode: "lines",
      line: { color: "#f5a623", width: 1.5, dash: "dot" },
      hovertemplate: "%{y:.2f} MW<extra></extra>",
    },
    {
      x: time,
      y: wind,
      name: "Wind Speed",
      type: "scatter",
      mode: "lines",
      line: { color: "#9ba3b8", width: 1, dash: "dot" },
      yaxis: "y2",
      hovertemplate: "%{y:.1f} m/s<extra></extra>",
    },
    // Rated power reference line
    {
      x: [time[0], time[time.length - 1]],
      y: [15, 15],
      name: "Rated (15 MW)",
      type: "scatter",
      mode: "lines",
      line: { color: "#e74c3c", width: 1, dash: "dash" },
      showlegend: true,
      hoverinfo: "skip",
    },
  ];

  const layout: Partial<Plotly.Layout> = {
    ...DARK_PLOTLY_LAYOUT,
    title: undefined,
    yaxis: {
      ...DARK_PLOTLY_LAYOUT.yaxis,
      title: "Power [MW]",
    },
    yaxis2: {
      title: { text: "Wind Speed [m/s]" },
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
    <ChartWrapper title="Power vs Time">
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
