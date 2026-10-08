/**
 * Most loaded branch after each outage: right after it (automatic controls
 * only) and after the corrective PPC runback.
 */

import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { elementName, useN1Store } from "../../store/n1SecurityStore";
import { ChartWrapper } from "../ui/ChartWrapper";

export default function N1LoadingPanel() {
  const { study: s } = useN1Store();
  const c = useChartPalette();
  if (!s) return null;

  const rows = s.contingencies;
  const labels = rows.map((r) => r.label);
  const xMax = Math.max(120, ...rows.map((r) => (r.immediate?.loading_pct ?? 0) + 25));
  return (
    <ChartWrapper
      title="Most loaded branch after each outage"
      footer="Dashed line: 100 % of rating. String trips only remove generation, so the rest unloads. Losing one of two export circuits (its two shunt reactors, onshore and OSS, are intertripped with it) or transformers overloads the survivor; the PPC runs the turbines back until it is at or below 100 %."
    >
      <Plot
        data={[
          {
            type: "bar",
            orientation: "h",
            name: "Right after the outage",
            y: labels,
            x: rows.map((r) => r.immediate?.loading_pct ?? null),
            customdata: rows.map((r) => elementName(r.immediate?.limiting_element ?? "")),
            marker: { color: c.orange },
            texttemplate: "%{x:.0f} %",
            textposition: "outside",
            cliponaxis: false,
            textfont: { color: c.ink, size: 10 },
            hovertemplate: "%{customdata}: %{x:.1f} %<extra>after the outage</extra>",
          },
          {
            type: "bar",
            orientation: "h",
            name: "After PPC runback",
            y: labels,
            x: rows.map((r) => (r.runback_mw > 0 ? (r.after_action?.loading_pct ?? null) : null)),
            customdata: rows.map((r) => [elementName(r.after_action?.limiting_element ?? ""), r.runback_mw]),
            marker: { color: c.blue },
            texttemplate: "%{x:.0f} %",
            textposition: "outside",
            cliponaxis: false,
            textfont: { color: c.ink, size: 10 },
            hovertemplate: "%{customdata[0]}: %{x:.1f} % after −%{customdata[1]:.0f} MW<extra>after runback</extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          transition: CHART_TRANSITION,
          barmode: "group",
          bargap: 0.3,
          legend: { orientation: "h", y: 1.02, yanchor: "bottom", x: 0, font: { size: 11 } },
          margin: { t: 56, r: 24, b: 44, l: 12 },
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            title: { text: "Loading [% of rating]", font: { size: 12 } },
            range: [0, xMax],
          },
          yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, autorange: "reversed", automargin: true, tickfont: { size: 11 } },
          shapes: [
            { type: "line", xref: "x", yref: "paper", x0: 100, x1: 100, y0: 0, y1: 1, line: { color: c.red, width: 1.5, dash: "dash" } },
          ],
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: 360 }}
      />
    </ChartWrapper>
  );
}
