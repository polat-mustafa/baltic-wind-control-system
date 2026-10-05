/**
 * Measured power curve of the selected turbine against the twin (IEC 61400-12-1 view).
 *
 * Grey = samples outside events, amber = inside confirmed events. The line
 * is the twin at ρ = 1.225 kg/m³; the cold, dense winter air of the run
 * lifts partial-load samples slightly above it — that is physics, not a fault.
 */

import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useChartPalette } from "../../hooks/useChartPalette";
import { useDigitalTwinStore } from "../../store/digitalTwinStore";
import { ChartWrapper } from "../ui/ChartWrapper";

export default function PowerCurvePanel() {
  const detail = useDigitalTwinStore((s) => s.detail);
  const c = useChartPalette();
  if (!detail) return null;

  const power = detail.channels[0];
  const maxWind = detail.wind_ms.reduce((m, v) => (v > m ? v : m), 0);
  const normal = { x: [] as number[], y: [] as number[] };
  const event = { x: [] as number[], y: [] as number[] };
  detail.wind_ms.forEach((v, k) => {
    if (!power.valid[k]) return;
    const bucket = detail.in_event[k] ? event : normal;
    bucket.x.push(v);
    bucket.y.push(power.measured[k]);
  });

  return (
    <ChartWrapper
      title="Power curve — measured vs twin"
      footer="Nacelle wind, 10-min means. Line: twin at ρ = 1.225 kg/m³. Amber: samples inside events."
    >
      <Plot
        data={[
          {
            ...normal,
            type: "scattergl",
            mode: "markers",
            name: "Outside events",
            marker: { size: 3.5, color: c.ref, opacity: 0.45 },
            hovertemplate: "%{x:.1f} m/s · %{y:.2f} MW<extra></extra>",
          },
          {
            ...event,
            type: "scattergl",
            mode: "markers",
            name: "Inside events",
            marker: { size: 4, color: c.yellow, opacity: 0.85 },
            hovertemplate: "%{x:.1f} m/s · %{y:.2f} MW<extra>event</extra>",
          },
          {
            x: detail.power_curve_wind_ms,
            y: detail.power_curve_mw,
            type: "scatter",
            mode: "lines",
            name: "Twin",
            line: { color: c.blue, width: 2.2 },
            hoverinfo: "skip",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: 360,
          margin: { t: 30, r: 16, b: 48, l: 56 },
          legend: { ...DARK_PLOTLY_LAYOUT.legend, orientation: "h", x: 0, y: 1.1 },
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            title: { text: "Wind speed [m/s]", font: { size: 12 } },
            range: [0, Math.min(28, Math.max(16, maxWind + 1))],
          },
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            title: { text: "Active power [MW]", font: { size: 12 } },
            range: [-0.5, 16],
          },
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: 360 }}
      />
    </ChartWrapper>
  );
}
