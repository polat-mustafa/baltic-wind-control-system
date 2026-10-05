/** Lowest and highest bus voltage after each outage (after the corrective action). */

import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { useN1Store } from "../../store/n1SecurityStore";
import { ChartWrapper } from "../ui/ChartWrapper";

export default function N1VoltagePanel() {
  const { study: s } = useN1Store();
  const c = useChartPalette();
  if (!s?.base_case) return null;

  const rows = s.contingencies.filter((r) => r.after_action);
  const [lo, hi] = s.voltage_band_pu;
  // one trace, segments separated by nulls: a dumbbell per contingency
  const x = rows.flatMap((r) => [r.after_action!.v_min_pu, r.after_action!.v_max_pu, null]);
  const y = rows.flatMap((r) => [r.label, r.label, null]);
  return (
    <ChartWrapper
      title="Bus voltage range after each outage"
      footer={`Every bus except the PSE 400 kV slack, with the STATCOM holding the OSS 220 kV busbar at 1.0 p.u. Base case ${s.base_case.v_min_pu.toFixed(3)}–${s.base_case.v_max_pu.toFixed(3)} p.u. Band ${lo}–${hi} p.u. is the operating band assumed here, not a grid-code limit.`}
    >
      <Plot
        data={[
          {
            type: "scatter",
            mode: "lines+markers",
            name: "min–max",
            x,
            y,
            line: { color: c.blue, width: 3 },
            marker: { color: c.blue, size: 9 },
            connectgaps: false,
            hovertemplate: "%{x:.3f} p.u.<extra>%{y}</extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          transition: CHART_TRANSITION,
          showlegend: false,
          margin: { t: 56, r: 24, b: 44, l: 12 },
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            title: { text: "Voltage [p.u.]", font: { size: 12 } },
            range: [lo - 0.015, hi + 0.015],
            dtick: 0.05,
          },
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            autorange: "reversed",
            automargin: true,
            tickfont: { size: 11 },
            categoryorder: "array",
            categoryarray: rows.map((r) => r.label),
          },
          shapes: [
            { type: "rect", xref: "x", yref: "paper", x0: lo, x1: hi, y0: 0, y1: 1, fillcolor: c.band, line: { width: 0 }, layer: "below" },
            ...[lo, hi].map((v) => ({
              type: "line" as const,
              xref: "x" as const,
              yref: "paper" as const,
              x0: v,
              x1: v,
              y0: 0,
              y1: 1,
              line: { color: c.red, width: 1.5, dash: "dash" as const },
            })),
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
