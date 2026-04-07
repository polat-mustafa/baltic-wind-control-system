/**
 * Farm layout map — Plotly scatter showing turbine positions.
 *
 * Color-codes turbines by per-turbine AEP using RdYlGn colorscale.
 * Shows OSS marker at centroid and a wind direction arrow.
 */

import Plot from "react-plotly.js";
import { useWindResourceStore } from "../../store/windResourceStore";
import { CHART_HEIGHT, DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { EducationButton } from "../ui/EducationButton";
import { farmLayoutMapEducation } from "../../constants/education/p1";
import { ChartWrapper } from "../ui/ChartWrapper";

export default function FarmLayoutMap() {
  const { layoutPositions, wakeAnalysis } = useWindResourceStore();

  if (!layoutPositions || !wakeAnalysis) return null;

  const { x_positions, y_positions } = layoutPositions;
  const aepValues = wakeAnalysis.per_turbine_aep_gwh;

  // Turbine labels
  const labels = aepValues.map(
    (aep, i) => `T${i + 1}<br>AEP: ${aep.toFixed(2)} GWh<br>Wake loss: ${wakeAnalysis.per_turbine_wake_loss_percent[i].toFixed(1)}%`,
  );

  // OSS at centroid
  const ossx =
    x_positions.reduce((a, b) => a + b, 0) / x_positions.length;
  const ossy =
    y_positions.reduce((a, b) => a + b, 0) / y_positions.length;

  return (
    <ChartWrapper
      title={`Farm Layout — ${layoutPositions.name} (${layoutPositions.num_turbines} turbines)`}
      headerRight={<EducationButton content={farmLayoutMapEducation} />}
      footer={`Min spacing: ${layoutPositions.min_spacing_m.toFixed(0)}m · Area: ${layoutPositions.area_km2.toFixed(1)} km²`}
    >
      <Plot
        data={[
          {
            type: "scatter",
            mode: "markers",
            x: x_positions,
            y: y_positions,
            text: labels,
            hoverinfo: "text",
            marker: {
              size: 12,
              color: aepValues,
              colorscale: "RdYlGn",
              showscale: true,
              colorbar: {
                title: { text: "AEP\n(GWh)", font: { size: 10 } },
                tickfont: { size: 11 },
                len: 0.8,
              },
              line: { color: "rgba(255,255,255,0.5)", width: 1 },
            },
            name: "Turbines",
          },
          {
            type: "scatter",
            mode: "text+markers" as const,
            x: [ossx],
            y: [ossy],
            text: ["OSS"],
            textposition: "top center",
            textfont: { size: 10, color: "rgb(234, 179, 8)" },
            marker: {
              size: 16,
              color: "rgb(234, 179, 8)",
              symbol: "square",
              line: { color: "white", width: 1.5 },
            },
            name: "OSS",
            showlegend: false,
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          showlegend: false,
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            title: { text: "Easting [m]", font: { size: 11 } },
            scaleanchor: "y",
            scaleratio: 1,
          },
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            title: { text: "Northing [m]", font: { size: 11 } },
          },
          margin: { t: 10, r: 60, b: 50, l: 60 },
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: CHART_HEIGHT }}
      />
    </ChartWrapper>
  );
}
