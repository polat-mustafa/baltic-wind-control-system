/**
 * Farm layout — turbine positions coloured by net AEP (sequential, one hue).
 *
 * Darker = more energy. Turbines facing the prevailing wind (front row) get
 * clean air and the most energy; interior turbines sit in their neighbours'
 * wakes. An arrow shows where the prevailing wind comes from.
 */

import Plot from "react-plotly.js";

import { farmLayoutMapEducation } from "../../constants/education/p1";
import { CHART_HEIGHT, DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useChartPalette } from "../../hooks/useChartPalette";
import { useWindResourceStore } from "../../store/windResourceStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { EducationButton } from "../ui/EducationButton";

export default function FarmLayoutMap() {
  const { layoutPositions, wakeAnalysis, windRose } = useWindResourceStore();
  const c = useChartPalette();
  if (!layoutPositions || !wakeAnalysis) return null;

  const xs = layoutPositions.x_positions.map((v) => v / 1000);
  const ys = layoutPositions.y_positions.map((v) => v / 1000);
  const aep = wakeAnalysis.per_turbine_aep_gwh;
  const loss = wakeAnalysis.per_turbine_wake_loss_percent;
  const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));

  // Arrow from upwind toward the farm centre (wind FROM the dominant bearing)
  const from = ((windRose?.dominant_direction_deg ?? 240) * Math.PI) / 180;
  const tail = { x: cx + Math.sin(from) * span * 0.62, y: cy + Math.cos(from) * span * 0.62 };
  const head = { x: cx + Math.sin(from) * span * 0.42, y: cy + Math.cos(from) * span * 0.42 };
  const best = Math.max(...aep);

  return (
    <ChartWrapper
      title={`Farm layout — ${layoutPositions.name}, net AEP per turbine`}
      headerRight={<EducationButton content={farmLayoutMapEducation} />}
      footer={`${layoutPositions.num_turbines} turbines · min spacing ${(layoutPositions.min_spacing_m / 236).toFixed(1)} D (${layoutPositions.min_spacing_m.toFixed(0)} m) · ${layoutPositions.area_km2.toFixed(1)} km² · range ${Math.min(...aep).toFixed(1)}–${best.toFixed(1)} GWh/yr`}
    >
      <Plot
        data={[
          {
            type: "scatter",
            mode: "markers",
            x: xs,
            y: ys,
            customdata: aep.map((a, i) => [a, loss[i], i + 1]),
            hovertemplate: "T%{customdata[2]}<br>Net AEP %{customdata[0]:.2f} GWh/yr<br>Wake loss %{customdata[1]:.1f} %<extra></extra>",
            marker: {
              size: 14,
              color: aep,
              colorscale: c.seq.map((col, i): [number, string] => [i / (c.seq.length - 1), col]),
              line: { color: "rgba(127,127,127,0.6)", width: 1 },
              colorbar: {
                title: { text: "Net AEP<br>[GWh/yr]", font: { size: 11 } },
                tickfont: { size: 11 },
                thickness: 12,
                len: 0.85,
                outlinewidth: 0,
              },
            },
            name: "Turbines",
          },
          {
            type: "scatter",
            mode: "text+markers",
            x: [cx],
            y: [cy],
            text: ["OSS"],
            textposition: "bottom center",
            textfont: { size: 11, color: c.ink },
            marker: { size: 13, symbol: "square", color: "rgba(0,0,0,0)", line: { color: c.ref, width: 2 } },
            hovertemplate: "Offshore substation (66/220 kV)<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          showlegend: false,
          xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Easting [km]", font: { size: 12 } }, scaleanchor: "y", scaleratio: 1, zeroline: false },
          yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "Northing [km]", font: { size: 12 } }, zeroline: false },
          annotations: [
            {
              x: head.x,
              y: head.y,
              ax: tail.x,
              ay: tail.y,
              xref: "x",
              yref: "y",
              axref: "x",
              ayref: "y",
              showarrow: true,
              arrowhead: 3,
              arrowsize: 1.2,
              arrowwidth: 2,
              arrowcolor: c.orange,
              text: "",
            } as const,
            {
              x: tail.x,
              y: tail.y,
              xref: "x",
              yref: "y",
              text: `prevailing wind<br>from ${(windRose?.dominant_direction_deg ?? 240).toFixed(0)}°`,
              showarrow: false,
              font: { size: 11 },
              yshift: -18,
            } as const,
          ],
          margin: { t: 12, r: 12, b: 52, l: 60 },
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: CHART_HEIGHT }}
      />
    </ChartWrapper>
  );
}
