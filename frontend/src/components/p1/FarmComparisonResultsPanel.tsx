/**
 * Farm Comparison Results Panel — M04 Multi-Farm Comparison.
 *
 * Plotly grouped bar chart: AEP (net GWh), capacity factor (%), LCOE (EUR/MWh)
 * across all compared farms.  Best-farm badges above each metric column.
 */

import Plot from "react-plotly.js";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useFarmComparisonStore } from "../../store/farmComparisonStore";
import { EducationButton } from "../ui/EducationButton";
import { layoutComparisonEducation, lcoeEducation } from "../../constants/education/p1";

const METRIC_COLORS = ["#3ecf6e", "#60a5fa", "#f59e0b"];

export default function FarmComparisonResultsPanel() {
  const { results } = useFarmComparisonStore();

  if (!results) return null;

  const names = results.farms.map((f) => f.name);
  const aep   = results.farms.map((f) => f.net_aep_gwh);
  const cf    = results.farms.map((f) => f.capacity_factor_pct);
  const lcoe  = results.farms.map((f) => f.lcoe_eur_mwh);

  return (
    <div className="space-y-3">
      {/* Best-farm badges */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-0.5 rounded bg-status-success/20 text-status-success font-mono">
          Best AEP: {results.best_aep_farm}
        </span>
        <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono">
          Best Capacity Factor: {results.best_capacity_factor_farm}
        </span>
        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">
          Best LCOE: {results.best_lcoe_farm}
        </span>
      </div>

      {/* AEP + Capacity Factor grouped bar */}
      <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-text-primary">AEP & Capacity Factor</h4>
          <EducationButton content={layoutComparisonEducation} />
        </div>
        <Plot
          data={[
            {
              type: "bar",
              name: "Net AEP (GWh)",
              x: names,
              y: aep,
              marker: { color: METRIC_COLORS[0] },
              hovertemplate: "%{x}<br>Net AEP: %{y:.0f} GWh<extra></extra>",
            },
            {
              type: "bar",
              name: "Capacity Factor (%)",
              x: names,
              y: cf,
              yaxis: "y2",
              marker: { color: METRIC_COLORS[1], opacity: 0.8 },
              hovertemplate: "%{x}<br>Capacity Factor: %{y:.1f}%<extra></extra>",
            },
          ]}
          layout={{
            ...DARK_PLOTLY_LAYOUT,
            height: 280,
            barmode: "group",
            yaxis: {
              ...DARK_PLOTLY_LAYOUT.yaxis,
              title: { text: "Net AEP (GWh)", font: { color: "#9ba3b8", size: 11 } },
            },
            yaxis2: {
              title: { text: "Capacity Factor (%)", font: { color: "#9ba3b8", size: 11 } },
              overlaying: "y",
              side: "right",
              tickfont: { color: "#9ba3b8", size: 10 },
              gridcolor: "#1e2535",
              zeroline: false,
            },
            legend: { ...DARK_PLOTLY_LAYOUT.legend, orientation: "h", y: -0.25 },
            margin: { t: 16, r: 64, b: 60, l: 72 },
          }}
          config={PLOTLY_CONFIG}
          className="w-full"
        />
      </div>

      {/* LCOE bar */}
      <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-text-primary">LCOE Comparison</h4>
          <EducationButton content={lcoeEducation} />
        </div>
        <Plot
          data={[
            {
              type: "bar",
              name: "LCOE (EUR/MWh)",
              x: names,
              y: lcoe,
              marker: {
                color: lcoe.map((v) => {
                  const min = Math.min(...lcoe);
                  return v === min ? METRIC_COLORS[0] : METRIC_COLORS[2];
                }),
              },
              hovertemplate: "%{x}<br>LCOE: %{y:.1f} EUR/MWh<extra></extra>",
              text: lcoe.map((v) => `${v.toFixed(1)}`),
              textposition: "outside" as const,
              textfont: { color: "#9ba3b8", size: 11 },
            },
          ]}
          layout={{
            ...DARK_PLOTLY_LAYOUT,
            height: 220,
            yaxis: {
              ...DARK_PLOTLY_LAYOUT.yaxis,
              title: { text: "LCOE (EUR/MWh)", font: { color: "#9ba3b8", size: 11 } },
            },
            margin: { t: 28, r: 16, b: 48, l: 72 },
          }}
          config={PLOTLY_CONFIG}
          className="w-full"
        />
      </div>

      {/* Numeric summary table */}
      <div className="bg-bg-secondary rounded-lg border border-border-primary p-3 overflow-x-auto">
        <h4 className="text-xs font-semibold text-text-primary mb-2">Detailed Results</h4>
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="text-text-muted border-b border-border-primary">
              <th className="pb-1 pr-3">Farm</th>
              <th className="pb-1 pr-3 text-right">MW</th>
              <th className="pb-1 pr-3 text-right">Gross GWh</th>
              <th className="pb-1 pr-3 text-right">Net GWh</th>
              <th className="pb-1 pr-3 text-right">CF %</th>
              <th className="pb-1 pr-3 text-right">Wake %</th>
              <th className="pb-1 text-right">LCOE</th>
            </tr>
          </thead>
          <tbody>
            {results.farms.map((f) => (
              <tr key={f.name} className="border-b border-border-primary/30">
                <td className="py-1 pr-3 font-medium text-text-primary">{f.name}</td>
                <td className="py-1 pr-3 text-right font-mono">{f.installed_mw.toFixed(0)}</td>
                <td className="py-1 pr-3 text-right font-mono">{f.gross_aep_gwh.toFixed(0)}</td>
                <td className={`py-1 pr-3 text-right font-mono font-bold ${f.name === results.best_aep_farm ? "text-status-success" : "text-text-primary"}`}>
                  {f.net_aep_gwh.toFixed(0)}
                </td>
                <td className={`py-1 pr-3 text-right font-mono ${f.name === results.best_capacity_factor_farm ? "text-blue-400" : "text-text-primary"}`}>
                  {f.capacity_factor_pct.toFixed(1)}
                </td>
                <td className="py-1 pr-3 text-right font-mono text-text-secondary">{f.wake_loss_pct.toFixed(1)}</td>
                <td className={`py-1 text-right font-mono ${f.name === results.best_lcoe_farm ? "text-amber-400" : "text-text-primary"}`}>
                  {f.lcoe_eur_mwh.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
