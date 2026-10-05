/**
 * Day-ahead price per period, the imbalance price CEN and the CfD strike.
 * Shaded periods have a negative price: no CfD support, the farm curtails.
 */

import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { useMarketStore } from "../../store/marketStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { hourAxis, negativeBands, stepX, stepY } from "./marketChart";

export default function MarketPricePanel() {
  const { day: d, include_cfd, strike_pln_mwh } = useMarketStore();
  const c = useChartPalette();
  if (!d) return null;

  const x = stepX(d.hours);
  const cen = d.hours.map((h) => h.cen_pln_mwh);
  const lo = Math.min(0, ...cen);
  const hi = Math.max(include_cfd ? strike_pln_mwh : 0, ...cen);
  const n = d.negative_hours;

  return (
    <ChartWrapper
      title="Prices — day-ahead, imbalance and CfD strike"
      footer={`${d.scenario_label}. Day average ${d.day_average_price_pln_mwh.toFixed(0)} PLN/MWh. ${n ? `${n} shaded period${n > 1 ? "s" : ""} below zero: no CfD support (CEEAG 2022 §122), so the farm curtails. ` : ""}Synthetic price shape, hourly for readability — SDAC has traded 15-minute periods since 1 Oct 2025.`}
    >
      <Plot
        data={[
          {
            type: "scatter",
            mode: "lines",
            name: "Day-ahead (TGE)",
            x,
            y: stepY(d.hours.map((h) => h.da_price_pln_mwh)),
            line: { color: c.blue, width: 2, shape: "hv" },
            hovertemplate: "DA %{y:.0f} PLN/MWh from %{x}:00<extra></extra>",
          },
          {
            type: "scatter",
            mode: "lines",
            name: "Imbalance price CEN",
            x,
            y: stepY(cen),
            line: { color: c.orange, width: 1.5, shape: "hv", dash: "dot" },
            hovertemplate: "CEN %{y:.0f} PLN/MWh from %{x}:00<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          transition: CHART_TRANSITION,
          legend: { orientation: "h", y: 1.18, x: 0, font: { size: 11 } },
          margin: { t: 48, r: 12, b: 44, l: 60 },
          xaxis: hourAxis,
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            title: { text: "Price [PLN/MWh]", font: { size: 12 } },
            range: [lo - 50, hi + 80],
            zeroline: true,
          },
          shapes: [
            ...negativeBands(d.hours, c),
            ...(include_cfd
              ? [
                  {
                    type: "line" as const,
                    xref: "paper" as const,
                    x0: 0,
                    x1: 1,
                    y0: strike_pln_mwh,
                    y1: strike_pln_mwh,
                    line: { color: c.ref, width: 1.5, dash: "dash" as const },
                  },
                ]
              : []),
          ],
          annotations: include_cfd
            ? [
                {
                  x: 0.2,
                  y: strike_pln_mwh,
                  xanchor: "left",
                  yanchor: "bottom",
                  text: `CfD strike ${strike_pln_mwh} PLN/MWh`,
                  showarrow: false,
                  font: { size: 10, color: c.ref },
                },
              ]
            : [],
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: 300 }}
      />
    </ChartWrapper>
  );
}
