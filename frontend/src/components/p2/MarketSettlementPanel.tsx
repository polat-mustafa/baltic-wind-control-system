/** The day's money: metered energy at DA, imbalance at CEN, CfD settlement, BESS. */

import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { useMarketStore } from "../../store/marketStore";
import { ChartWrapper } from "../ui/ChartWrapper";

export default function MarketSettlementPanel() {
  const { day: d } = useMarketStore();
  const c = useChartPalette();
  if (!d) return null;

  const steps: [string, number][] = [
    ["Energy at DA", d.energy_value_pln],
    ["Imbalance at CEN", d.imbalance_pln],
    [d.cfd_settlement_pln >= 0 ? "CfD paid to farm" : "CfD paid back", d.cfd_settlement_pln],
    ["BESS arbitrage", d.bess_arbitrage_pln],
  ];
  const y = [...steps.map(([, v]) => v / 1000), d.total_pln / 1000];

  return (
    <ChartWrapper
      title="Settlement of the day"
      footer={`${d.assessment} λ = 0.25 PLN/MWh per MWh of deviation is an assumption.`}
    >
      <Plot
        data={[
          {
            type: "waterfall",
            orientation: "v",
            x: [...steps.map(([n]) => n), "Total"],
            y,
            measure: [...steps.map(() => "relative"), "total"],
            text: y.map((v, i) => `${i < steps.length && v >= 0 ? "+" : ""}${v.toFixed(0)}`),
            textposition: "outside",
            cliponaxis: false,
            textfont: { color: c.ink, size: 11 },
            increasing: { marker: { color: c.blue } },
            decreasing: { marker: { color: c.orange } },
            totals: { marker: { color: c.seq[4] } },
            connector: { line: { color: c.ref, width: 1, dash: "dot" } },
            hovertemplate: "%{x}: %{y:,.0f} k PLN<extra></extra>",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          transition: CHART_TRANSITION,
          showlegend: false,
          margin: { t: 24, r: 12, b: 56, l: 64 },
          xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, tickfont: { size: 11 } },
          yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "Thousand PLN", font: { size: 12 } }, rangemode: "tozero" },
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: 300 }}
      />
    </ChartWrapper>
  );
}
