/**
 * State of health over 25 years: calendar ageing alone against calendar +
 * cycling, so the gap between the lines is what the duty costs.
 */

import Plot from "react-plotly.js";

import { bessEducation } from "../../constants/education/p2";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { useBESSStore } from "../../store/bessStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { EducationButton } from "../ui/EducationButton";

export default function BESSDegradationPanel() {
  const { degradation: d } = useBESSStore();
  const c = useChartPalette();
  if (!d) return null;

  const years = d.projection.map((p) => p.year);
  const last = d.projection[d.projection.length - 1];
  const yLo = Math.min(60, Math.floor(last.soh_percent / 5) * 5);

  return (
    <ChartWrapper
      title="State of health — LFP ageing"
      headerRight={<EducationButton content={bessEducation} />}
      footer={`${d.assessment}. Replacement ${d.replacement_cost_m_eur.toFixed(0)} M€ (assumed 350 €/kWh) spread over the energy discharged until then: ${d.lcoe_contribution_eur_mwh.toFixed(0)} €/MWh. Empirical model, not a vendor curve.`}
    >
      <Plot
        data={[
          {
            type: "scatter",
            mode: "lines",
            name: "Calendar ageing only",
            x: years,
            y: d.projection.map((p) => 100 - p.calendar_loss_pct),
            line: { color: c.ref, width: 1.5, dash: "dot" },
            hovertemplate: "Year %{x}: %{y:.1f} % without cycling<extra></extra>",
          },
          {
            type: "scatter",
            mode: "lines+markers",
            name: "Calendar + cycling",
            x: years,
            y: d.projection.map((p) => p.soh_percent),
            customdata: d.projection.map((p) => [p.capacity_mwh, p.cumulative_cycles, p.cycle_loss_pct]),
            line: { color: c.blue, width: 2 },
            marker: { size: 6, color: c.blue },
            hovertemplate:
              "Year %{x}: SOH %{y:.1f} % · %{customdata[0]:.0f} MWh<br>%{customdata[1]:.0f} cycles, %{customdata[2]:.1f} % lost to cycling<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          transition: CHART_TRANSITION,
          legend: { orientation: "h", y: 1.15, x: 0, font: { size: 11 } },
          xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Year in service", font: { size: 12 } }, dtick: 5 },
          yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "SOH [%]", font: { size: 12 } }, range: [yLo, 101] },
          shapes: [
            { type: "line", xref: "paper", x0: 0, x1: 1, y0: 80, y1: 80, line: { color: c.red, width: 1.5, dash: "dash" } } as const,
            ...(d.eol_reached
              ? [{ type: "line", xref: "x", yref: "paper", x0: d.eol_year, x1: d.eol_year, y0: 0, y1: 1, line: { color: c.ref, width: 1, dash: "dot" } } as const]
              : []),
          ],
          annotations: [
            { xref: "paper", x: 1, y: 80, xanchor: "right", yanchor: "bottom", text: "end of life 80 %", showarrow: false, font: { size: 10 } } as const,
            ...(d.eol_reached
              ? [{ x: d.eol_year, y: 0, yref: "paper", xanchor: "left", yanchor: "bottom", text: ` EOL year ${d.eol_year}`, showarrow: false, font: { size: 10 } } as const]
              : []),
          ],
          margin: { t: 36, r: 12, b: 44, l: 60 },
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: 280 }}
      />
    </ChartWrapper>
  );
}
