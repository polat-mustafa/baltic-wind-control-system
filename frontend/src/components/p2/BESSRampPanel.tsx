/**
 * Ramp smoothing — wind output against the ramp-limited POC output, and the
 * battery power that bridges them (discharge +).
 */

import Plot from "react-plotly.js";

import { bessEducation } from "../../constants/education/p2";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { useBESSStore } from "../../store/bessStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { EducationButton } from "../ui/EducationButton";

export default function BESSRampPanel() {
  const { ramp, rampLimitMwPerMin } = useBESSStore();
  const c = useChartPalette();
  if (!ramp) return null;

  const t = ramp.wind_power_mw.map((_, i) => i);
  const base = {
    ...DARK_PLOTLY_LAYOUT,
    transition: CHART_TRANSITION,
    xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Time [min]", font: { size: 12 } }, range: [0, t.length - 1] },
    margin: { t: 16, r: 12, b: 44, l: 60 },
  };
  const plotProps = { config: PLOTLY_CONFIG, useResizeHandler: true, className: "w-full" };
  const pass = ramp.ramp_violations_after === 0;

  return (
    <ChartWrapper
      title={`Ramp smoothing at ${rampLimitMwPerMin} MW/min`}
      headerRight={<EducationButton content={bessEducation} />}
      footer={`${pass ? "✓" : "✗"} ${ramp.assessment}. Ramp limit is a plant setting agreed with the TSO (51 MW/min = 10 % of 510 MW per minute); wind trace illustrative.`}
    >
      <p className="text-xs text-text-muted mb-1">Active power [MW]</p>
      <Plot
        data={[
          {
            type: "scatter",
            mode: "lines",
            name: "Wind output",
            x: t,
            y: ramp.wind_power_mw,
            line: { color: c.ref, width: 1.5, dash: "dot" },
            hovertemplate: "min %{x}: wind %{y:.0f} MW<extra></extra>",
          },
          {
            type: "scatter",
            mode: "lines",
            name: "POC output (wind + battery)",
            x: t,
            y: ramp.smoothed_output_mw,
            line: { color: c.blue, width: 2 },
            hovertemplate: "min %{x}: POC %{y:.0f} MW<extra></extra>",
          },
        ]}
        layout={{
          ...base,
          legend: { orientation: "h", y: 1.15, x: 0, font: { size: 11 } },
          margin: { ...base.margin, t: 36 },
          yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "P [MW]", font: { size: 12 } }, rangemode: "tozero" },
        }}
        {...plotProps}
        style={{ height: 240 }}
      />
      <p className="text-xs text-text-muted mt-2 mb-1">Battery power [MW], discharge + · rated ±50 MW</p>
      <Plot
        data={[
          {
            type: "scatter",
            mode: "lines",
            x: t,
            y: ramp.bess_power_mw,
            fill: "tozeroy",
            fillcolor: c.band,
            line: { color: c.orange, width: 2, shape: "hv" },
            customdata: ramp.soc_percent,
            hovertemplate: "min %{x}: %{y:.1f} MW · SOC %{customdata:.2f} %<extra></extra>",
          },
        ]}
        layout={{
          ...base,
          showlegend: false,
          yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "P [MW]", font: { size: 12 } }, range: [-55, 55] },
          shapes: [50, -50].map(
            (y) => ({ type: "line", xref: "paper", x0: 0, x1: 1, y0: y, y1: y, line: { color: c.red, width: 1, dash: "dash" } }) as const,
          ),
        }}
        {...plotProps}
        style={{ height: 170 }}
      />
    </ChartWrapper>
  );
}
