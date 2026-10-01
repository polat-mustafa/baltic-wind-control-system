/**
 * Wake loss per turbine — ranked, with the farm-level wake loss as reference.
 *
 * Sorting turns 34 bars into a readable distribution: the top of the chart
 * is the most shadowed (interior) turbines, the bottom the exposed edge.
 * Farm wake loss = 1 − ΣNet/ΣGross (the KPI), drawn as a dashed line.
 */

import Plot from "react-plotly.js";

import { wakeLossEducation } from "../../constants/education/p1";
import { CHART_HEIGHT, DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { useWindResourceStore } from "../../store/windResourceStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { EducationButton } from "../ui/EducationButton";

export default function WakeLossPanel() {
  const { wakeAnalysis } = useWindResourceStore();
  const c = useChartPalette();
  if (!wakeAnalysis) return null;

  const ranked = wakeAnalysis.per_turbine_wake_loss_percent
    .map((loss, i) => ({ id: `T${i + 1}`, loss, aep: wakeAnalysis.per_turbine_aep_gwh[i] }))
    .sort((a, b) => a.loss - b.loss); // Plotly draws the first category at the bottom
  const farm = wakeAnalysis.wake_loss_percent;
  const worst = ranked[ranked.length - 1];
  const bestT = ranked[0];

  return (
    <ChartWrapper
      title="Wake loss per turbine — ranked"
      headerRight={<EducationButton content={wakeLossEducation} />}
      footer={`Farm wake loss ${farm.toFixed(1)} % (bold bars are above it) · most shadowed ${worst.id} (${worst.loss.toFixed(1)} %) · most exposed ${bestT.id} (${bestT.loss.toFixed(1)} %)`}
    >
      <Plot
        data={[
          {
            type: "bar",
            orientation: "h",
            y: ranked.map((r) => r.id),
            x: ranked.map((r) => r.loss),
            customdata: ranked.map((r) => r.aep),
            marker: { color: ranked.map((r) => (r.loss > farm ? c.blue : c.seq[0])) },
            hovertemplate: "%{y}: wake loss %{x:.1f} % · net %{customdata:.1f} GWh/yr<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          transition: CHART_TRANSITION,
          showlegend: false,
          bargap: 0.25,
          xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Wake loss [%]", font: { size: 12 } }, range: [0, worst.loss * 1.15], zeroline: false },
          yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, type: "category", tickfont: { size: 10 } },
          shapes: [
            { type: "line", xref: "x", yref: "paper", x0: farm, x1: farm, y0: 0, y1: 1, line: { color: c.ref, width: 1.5, dash: "dash" } } as const,
          ],
          annotations: [
            { x: farm, y: 1, xref: "x", yref: "paper", yanchor: "bottom", text: `farm ${farm.toFixed(1)} %`, showarrow: false, font: { size: 11 } } as const,
          ],
          margin: { t: 28, r: 16, b: 48, l: 44 },
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: CHART_HEIGHT }}
      />
    </ChartWrapper>
  );
}
