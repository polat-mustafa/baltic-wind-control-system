/**
 * Day-Ahead Bid Panel — M11 Market Integration.
 *
 * Plotly grouped bar (24h): wind forecast vs bid volume + DA price line overlay.
 * Curtailment hours highlighted in red (negative price → zero bid).
 * TGE Polish power exchange market (PLN/EUR pricing).
 */

import Plot from "react-plotly.js";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useMarketStore } from "../../store/marketStore";
import type { DAPricePoint } from "../../types/market";
import { InfoButton } from "../ui/InfoButton";
import { daBidInfo } from "../../constants/panelInfo";

const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

export default function DABidPanel() {
  const { daBidResult } = useMarketStore();

  if (!daBidResult) return null;

  const schedule = daBidResult.hourly_schedule;
  const bidMwh = schedule.map((h: DAPricePoint) => h.volume_mwh);
  const prices = schedule.map((h: DAPricePoint) => h.price_eur_mwh);
  const barColors = schedule.map((h: DAPricePoint) => (h.revenue_eur <= 0 ? "rgba(239,68,68,0.7)" : "rgba(96,165,250,0.7)"));

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <h3 className="text-sm font-semibold text-text-primary">Day-Ahead Bid Schedule (TGE)</h3>
          <InfoButton info={daBidInfo} />
        </div>
        <div className="text-xs text-text-muted">
          Revenue: <span className="text-text-primary font-mono">{(daBidResult.total_revenue_eur / 1000).toFixed(0)} k€</span>
          {daBidResult.curtailment_hours > 0 && (
            <span className="ml-2 text-status-alarm">{daBidResult.curtailment_hours}h curtailed</span>
          )}
        </div>
      </div>
      <Plot
        data={[
          {
            type: "bar",
            x: HOURS,
            y: bidMwh,
            name: "Bid volume (MWh)",
            marker: { color: barColors },
            yaxis: "y",
            hovertemplate: "%{x}<br>Bid: %{y:.0f} MWh<extra></extra>",
          },
          {
            type: "scatter",
            x: HOURS,
            y: prices,
            mode: "lines+markers",
            name: "DA price (€/MWh)",
            line: { color: "#f59e0b", width: 2 },
            marker: { size: 4 },
            yaxis: "y2",
            hovertemplate: "%{x}: %{y:.1f} €/MWh<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: 280,
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            title: { text: "Hour", font: { color: "#9ba3b8", size: 11 } },
          },
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            title: { text: "Volume (MWh)", font: { color: "#60a5fa", size: 11 } },
            tickfont: { ...DARK_PLOTLY_LAYOUT.yaxis.tickfont, color: "#60a5fa" },
          },
          yaxis2: {
            title: { text: "Price (€/MWh)", font: { color: "#f59e0b", size: 11 } },
            overlaying: "y",
            side: "right",
            tickfont: { family: "'JetBrains Mono', monospace", size: 11, color: "#f59e0b" },
            gridcolor: "transparent",
          },
          legend: { ...DARK_PLOTLY_LAYOUT.legend, orientation: "h", x: 0.5, xanchor: "center", y: 1.04, yanchor: "bottom" },
          margin: { t: 52, r: 64, b: 32, l: 60 },
        }}
        config={PLOTLY_CONFIG}
        className="w-full"
      />
    </div>
  );
}
