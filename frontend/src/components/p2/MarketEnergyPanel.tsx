/**
 * Day-ahead schedule against metered energy. The gap is the deviation that
 * settles at CEN; in negative-price periods the available energy is curtailed.
 */

import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { useMarketStore } from "../../store/marketStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { barX, hourAxis, negativeBands, stepX, stepY } from "./marketChart";

export default function MarketEnergyPanel() {
  const { day: d, forecast_sigma_ms } = useMarketStore();
  const c = useChartPalette();
  if (!d) return null;

  const hours = d.hours;
  return (
    <ChartWrapper
      title="Energy — schedule against metered"
      footer={`RMS deviation ${d.rmse_mwh.toFixed(0)} MWh per period (${((100 * d.rmse_mwh) / 510).toFixed(0)} % of 510 MW) from a ${forecast_sigma_ms.toFixed(1)} m/s wind-speed error: largest on the steep part of the power curve, near zero above rated wind.${d.curtailed_mwh > 0 ? ` ${d.curtailed_mwh.toFixed(0)} MWh curtailed.` : ""}`}
    >
      <Plot
        data={[
          {
            type: "bar",
            name: "Metered",
            x: barX(hours),
            y: hours.map((h) => h.metered_mwh),
            marker: { color: c.blue },
            width: 0.8,
            hovertemplate: "metered %{y:.0f} MWh<extra></extra>",
          },
          {
            type: "bar",
            name: "Curtailed",
            x: barX(hours),
            y: hours.map((h) => h.curtailed_mwh || null),
            marker: {
              color: "rgba(0,0,0,0)",
              line: { color: c.orange, width: 1.5 },
              pattern: { shape: "/", fgcolor: c.orange, size: 6 },
            },
            width: 0.8,
            hovertemplate: "curtailed %{y:.0f} MWh<extra></extra>",
          },
          {
            type: "scatter",
            mode: "lines",
            name: "Day-ahead schedule",
            x: stepX(hours),
            y: stepY(hours.map((h) => h.bid_mwh)),
            line: { color: c.ink, width: 2, shape: "hv" },
            hovertemplate: "schedule %{y:.0f} MWh from %{x}:00<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          transition: CHART_TRANSITION,
          barmode: "stack",
          legend: { orientation: "h", y: 1.18, x: 0, font: { size: 11 } },
          margin: { t: 48, r: 12, b: 44, l: 60 },
          xaxis: hourAxis,
          yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "Energy per period [MWh]", font: { size: 12 } }, range: [0, 540] },
          shapes: negativeBands(hours, c),
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: 300 }}
      />
    </ChartWrapper>
  );
}
