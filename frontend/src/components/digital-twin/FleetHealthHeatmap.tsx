/**
 * Health index of every turbine over time (worst value in each hour).
 *
 * Zones as in the detector: ≥ 70 normal (neutral), 40–70 alert (amber),
 * < 40 alarm (red). Ambient temperature underneath, because icing needs it.
 */

import Plot from "react-plotly.js";

import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useDigitalTwinStore } from "../../store/digitalTwinStore";
import { useLayerStore } from "../../store/layerStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { isoTime } from "./twinFormat";

export default function FleetHealthHeatmap() {
  const analysis = useDigitalTwinStore((s) => s.analysis);
  const selectTurbine = useDigitalTwinStore((s) => s.selectTurbine);
  const c = useChartPalette();
  const paper = useLayerStore((s) => s.mapTheme) === "storybook";
  if (!analysis) return null;

  const { health_trend: ht, ambient } = analysis;
  const x = ht.timestamps.map(isoTime);
  const names = analysis.turbines.map((t) => t.name);
  const neutralLo = paper ? "#d9c48f" : "#2d3348";
  const neutralHi = paper ? "#f3e7c9" : "#4a5580";
  const colorscale: [number, string][] = [
    [0, c.red],
    [0.399, c.red],
    [0.4, c.yellow],
    [0.699, c.yellow],
    [0.7, neutralLo],
    [1, neutralHi],
  ];

  return (
    <ChartWrapper
      title="Health index — all turbines"
      footer="Worst value per hour · ≥ 70 normal · 40–70 alert · < 40 alarm · click a row to open the turbine"
    >
      <Plot
        data={[
          {
            type: "heatmap",
            x,
            y: names,
            z: ht.health,
            zmin: 0,
            zmax: 100,
            colorscale,
            colorbar: {
              title: { text: "HI", side: "right" },
              tickvals: [0, 40, 70, 100],
              thickness: 10,
              len: 0.7,
              y: 0.62,
            },
            hovertemplate: "%{y}<br>%{x|%d %b %H:%M} UTC<br>HI %{z:.0f}<extra></extra>",
            yaxis: "y",
          },
          {
            type: "scatter",
            mode: "lines",
            x,
            y: ambient.temperature_c,
            name: "Ambient",
            line: { color: c.blue, width: 1.5 },
            yaxis: "y2",
            hovertemplate: "%{y:.1f} °C<extra>ambient</extra>",
            showlegend: false,
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          transition: CHART_TRANSITION,
          height: 600,
          margin: { t: 12, r: 16, b: 44, l: 64 },
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            type: "date",
            anchor: "y2",
            title: { text: "Time [UTC]", font: { size: 12 } },
          },
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            domain: [0.24, 1],
            autorange: "reversed",
            tickfont: { ...DARK_PLOTLY_LAYOUT.yaxis.tickfont, size: 9 },
            dtick: 1,
          },
          yaxis2: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            domain: [0, 0.17],
            title: { text: "T_amb [°C]", font: { size: 11 } },
            zeroline: true,
            zerolinecolor: c.ref,
          },
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: 600 }}
        onClick={(e) => {
          const pt = e.points?.[0];
          if (!pt || typeof pt.y !== "string") return;
          const id = names.indexOf(pt.y);
          if (id >= 0) selectTurbine(id);
        }}
      />
    </ChartWrapper>
  );
}
