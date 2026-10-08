/**
 * Weibull chart — measured (synthetic) hourly speeds vs the fitted Weibull PDF.
 *
 * Bars: share of the year per 1 m/s bin, shown as hours/yr (density × 8760 h).
 * Line: fitted Weibull PDF on the same scale. Shaded bands mark the turbine's
 * operating regions (idle < cut-in, full power rated → cut-out, shaded), so the reader
 * sees how many hours fall where the turbine (IEA 15 MW curve) makes energy.
 */

import Plot from "react-plotly.js";

import { weibullEducation } from "../../constants/education/p1";
import { CHART_HEIGHT, DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { useWindResourceStore } from "../../store/windResourceStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { EducationButton } from "../ui/EducationButton";

const HOURS = 8760;

export default function WeibullChart() {
  const { weibullFit, turbineSpec } = useWindResourceStore();
  const c = useChartPalette();
  if (!weibullFit || !turbineSpec) return null;

  const { cut_in_speed_ms: vIn, rated_speed_ms: vR, cut_out_speed_ms: vOut } = turbineSpec;
  const hours = weibullFit.bin_frequencies.map((d) => d * HOURS);
  const fit = weibullFit.pdf_values.map((d) => d * HOURS);
  const yMax = Math.max(...hours, ...fit) * 1.18;
  const hoursIn = (lo: number, hi: number) =>
    weibullFit.bin_centres.reduce((s, v, i) => (v >= lo && v < hi ? s + hours[i] : s), 0);

  const band = (x0: number, x1: number) =>
    ({ type: "rect", xref: "x", yref: "paper", x0, x1, y0: 0, y1: 1, fillcolor: c.band, line: { width: 0 }, layer: "below" }) as const;
  const vline = (x: number, text: string, xanchor: "center" | "right" = "center") => ({
    shape: { type: "line", xref: "x", yref: "paper", x0: x, x1: x, y0: 0, y1: 0.93, line: { color: c.ref, width: 1, dash: "dot" } } as const,
    note: { x, y: 0.93, xref: "x", yref: "paper", text, xanchor, showarrow: false, yanchor: "bottom", font: { size: 11 } } as const,
  });
  const lines = [vline(vIn, `cut-in ${vIn}`), vline(vR, `rated ${vR}`), vline(vOut, `cut-out ${vOut}`, "right")];

  return (
    <ChartWrapper
      title={`Wind speed distribution — Weibull A = ${weibullFit.fitted_a.toFixed(2)} m/s, k = ${weibullFit.fitted_k.toFixed(2)}`}
      headerRight={<EducationButton content={weibullEducation} />}
      footer={`Mean ${weibullFit.mean_speed_ms.toFixed(2)} m/s · ${hoursIn(vIn, vR).toFixed(0)} h/yr between cut-in and rated, ${hoursIn(vR, vOut).toFixed(0)} h/yr at full power · synthetic hourly record`}
    >
      <Plot
        data={[
          {
            type: "bar",
            x: weibullFit.bin_centres,
            y: hours,
            name: "Hourly record",
            marker: { color: c.blue, opacity: 0.55 },
            hovertemplate: "%{x:.1f} m/s · %{y:.0f} h/yr<extra>Record</extra>",
          },
          {
            type: "scatter",
            mode: "lines",
            x: weibullFit.bin_centres,
            y: fit,
            name: "Weibull fit",
            line: { color: c.orange, width: 2.5, shape: "spline" },
            hovertemplate: "%{x:.1f} m/s · %{y:.0f} h/yr<extra>Weibull fit</extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          transition: CHART_TRANSITION,
          showlegend: true,
          legend: { ...DARK_PLOTLY_LAYOUT.legend, x: 0.98, xanchor: "right", y: 0.84, bgcolor: "rgba(0,0,0,0)" },
          bargap: 0.08,
          xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Hub-height wind speed [m/s]", font: { size: 12 } }, range: [0, vOut + 1], dtick: 5 },
          yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "Hours per year [h]", font: { size: 12 } }, range: [0, yMax] },
          shapes: [band(0, vIn), band(vR, vOut), ...lines.map((l) => l.shape)],
          annotations: lines.map((l) => l.note),
          margin: { t: 40, r: 16, b: 52, l: 64 },
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: CHART_HEIGHT }}
      />
    </ChartWrapper>
  );
}
