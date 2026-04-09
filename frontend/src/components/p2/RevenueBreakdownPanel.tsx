/**
 * Revenue Breakdown Panel — M11 Market Integration.
 *
 * Plotly waterfall chart: DA market + CfD support + ancillary + BESS arbitrage
 *   − imbalance cost = Net revenue.
 * Also shows EBITDA and per-MWh revenue.
 * Polish CfD (OZMB 2024): ~80 EUR/MWh strike price.
 */

import Plotly from "plotly.js";
import Plot from "react-plotly.js";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useMarketStore } from "../../store/marketStore";
import { InfoButton } from "../ui/InfoButton";
import { revenueWaterfallInfo } from "../../constants/panelInfo";

export default function RevenueBreakdownPanel() {
  const { revenueResult } = useMarketStore();

  if (!revenueResult) return null;

  const items = revenueResult.breakdown;
  const labels = items.map((b) => b.category);
  const values = items.map((b) => b.revenue_m_eur);
  const measures: string[] = items.map(() => "relative");
  // Last item is "absolute" (totals bar)
  labels.push("Net Revenue");
  values.push(revenueResult.total_revenue_m_eur);
  measures.push("absolute");

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <h3 className="text-sm font-semibold text-text-primary">Annual Revenue Breakdown</h3>
          <InfoButton info={revenueWaterfallInfo} />
        </div>
        <div className="flex gap-3 text-xs">
          <span className="text-text-muted">EBITDA: <span className="text-text-primary font-mono">{revenueResult.ebitda_m_eur.toFixed(1)} M€</span></span>
          <span className="text-text-muted">{revenueResult.revenue_per_mwh_eur.toFixed(1)} €/MWh</span>
        </div>
      </div>
      <Plot
        data={[
          {
            type: "waterfall",
            x: labels,
            y: values,
            measure: measures,
            connector: { line: { color: "#3d4560", width: 1 } },
            decreasing: { marker: { color: "#ef4444" } },
            increasing: { marker: { color: "#3ecf6e" } },
            totals: { marker: { color: "#60a5fa" } },
            text: values.map((v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)} M€`),
            textposition: "outside",
            textfont: { color: "#9ba3b8", size: 11 },
            hovertemplate: "%{x}: %{y:.1f} M€<extra></extra>",
          } as Plotly.Data,
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: 320,
          xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, tickangle: -30 },
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            title: { text: "Revenue (M€/year)", font: { color: "#9ba3b8", size: 12 } },
          },
          margin: { t: 40, r: 16, b: 80, l: 64 },
        }}
        config={PLOTLY_CONFIG}
        className="w-full"
      />
      <p className="mt-1 text-xs text-text-muted">{revenueResult.assessment}</p>
    </div>
  );
}
