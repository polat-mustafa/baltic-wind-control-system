/** Farm output through each corrective runback, at the assumed ramp rate. */

import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { useN1Store } from "../../store/n1SecurityStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { useNetwork } from "../../store/gridStore";

const T_END_S = 30;

export default function N1RunbackPanel() {
  const n = useNetwork();
  const { study: s } = useN1Store();
  const c = useChartPalette();
  if (!s?.base_case) return null;

  const p0 = s.base_case.output_mw;
  const corrective = s.contingencies.filter((r) => r.kind === "corrective");
  const colors = [c.blue, c.orange, c.aqua];
  const dashes = ["solid", "solid", "dot"] as const;
  const anyRunback = corrective.some((r) => r.runback_mw > 0);
  return (
    <ChartWrapper
      title="Corrective runback"
      footer={
        anyRunback
          ? `Output falls at ${s.runback_mw_per_s.toFixed(1)} MW/s (2 % of ${n.total_capacity_mw.toFixed(0)} MW per second — an assumed rate; pitch systems can be faster). Seconds of overload are harmless: cable and transformer thermal time constants are hours (see the Cable DTS tab).`
          : `At ${p0.toFixed(0)} MW one export circuit or one transformer carries everything — no runback is needed.`
      }
    >
      <Plot
        data={[
          ...corrective.map((r, i) => {
            const pEnd = r.after_action?.output_mw ?? p0;
            return {
              type: "scatter" as const,
              mode: "lines" as const,
              name: r.label,
              x: [-3, 0, r.runback_s, T_END_S],
              y: [p0, p0, pEnd, pEnd],
              line: { color: colors[i], width: 2.5, dash: dashes[i] },
              hovertemplate: `%{y:.0f} MW at %{x:.1f} s<extra>${r.label}</extra>`,
            };
          }),
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          transition: CHART_TRANSITION,
          legend: { orientation: "h", y: 1.02, yanchor: "bottom", x: 0, font: { size: 11 } },
          margin: { t: 56, r: 16, b: 44, l: 60 },
          xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Time after the outage [s]", font: { size: 12 } }, range: [-3, T_END_S] },
          yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "Farm output [MW]", font: { size: 12 } }, range: [0, 540] },
          shapes: [
            { type: "line", xref: "x", yref: "paper", x0: 0, x1: 0, y0: 0, y1: 1, line: { color: c.ref, width: 1, dash: "dot" } },
            { type: "line", xref: "paper", yref: "y", x0: 0, x1: 1, y0: s.firm_output_mw, y1: s.firm_output_mw, line: { color: c.ref, width: 1, dash: "dash" } },
          ],
          annotations: [
            { xref: "x", yref: "paper", x: 0, y: 0.02, xanchor: "left", text: " outage", showarrow: false, font: { size: 10, color: c.ref } },
            {
              xref: "paper",
              yref: "y",
              x: 1,
              y: s.firm_output_mw,
              xanchor: "right",
              yanchor: "top",
              text: `firm N-1 output ${s.firm_output_mw.toFixed(0)} MW`,
              showarrow: false,
              font: { size: 10, color: c.ref },
            },
          ],
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: 300 }}
      />
    </ChartWrapper>
  );
}
