/** BESS day-ahead arbitrage: charge in the cheapest periods, discharge in the dearest. */

import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { useMarketStore } from "../../store/marketStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { barX, hourAxis } from "./marketChart";

export default function MarketBessPanel() {
  const { day: d, include_bess } = useMarketStore();
  const c = useChartPalette();
  if (!d) return null;

  const hours = d.hours;
  return (
    <ChartWrapper
      title="BESS 50 MW / 200 MWh — arbitrage"
      footer={
        include_bess
          ? `+${(d.bess_arbitrage_pln / 1000).toFixed(0)} k PLN. Linear programme on the day-ahead curve: SOC 10–90 %, 50 % at start and end, 92 % round trip. Perfect price foresight, so an upper bound. Storage is not eligible for the CfD.`
          : "BESS arbitrage is switched off."
      }
    >
      <Plot
        data={[
          {
            type: "bar",
            name: "Battery power",
            x: barX(hours),
            y: hours.map((h) => h.bess_mw),
            customdata: hours.map((h) => [h.da_price_pln_mwh, h.bess_soc_pct ?? 0]),
            marker: { color: hours.map((h) => (h.bess_mw >= 0 ? c.blue : c.orange)) },
            width: 0.8,
            hovertemplate: "%{y:+.0f} MW at %{customdata[0]:.0f} PLN/MWh · SOC %{customdata[1]:.0f} %<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          transition: CHART_TRANSITION,
          showlegend: false,
          margin: { t: 24, r: 12, b: 44, l: 60 },
          xaxis: hourAxis,
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            title: { text: "Power [MW]", font: { size: 12 } },
            range: [-62, 62],
            dtick: 25,
            zeroline: true,
          },
          annotations: [
            { xref: "paper", x: 0.01, y: 56, xanchor: "left", text: "▲ discharge (sell)", showarrow: false, font: { size: 10, color: c.ref } },
            { xref: "paper", x: 0.01, y: -56, xanchor: "left", text: "▼ charge (buy)", showarrow: false, font: { size: 10, color: c.ref } },
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
