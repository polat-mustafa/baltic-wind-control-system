/**
 * BESS Degradation Panel — M08.
 *
 * Plotly line: SoH% vs year (20-year horizon).
 * Marks EOL year (SoH = 80%), replacement cost, LCOE contribution.
 * LFP chemistry: 3000 cycles to 80% SoH.
 */

import Plot from "react-plotly.js";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useBESSStore } from "../../store/bessStore";
import { Button } from "../ui/Button";
import type { DegradationYearPoint } from "../../types/bess";
import { InfoButton } from "../ui/InfoButton";
import { bessDegradationInfo } from "../../constants/panelInfo";

export default function BESSDegradationPanel() {
  const { degradation, simLoading, calcDegradation } = useBESSStore();

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-1">
            <h3 className="text-sm font-semibold text-text-primary">Battery Degradation (20-year)</h3>
            <InfoButton info={bessDegradationInfo} />
          </div>
          <p className="text-xs text-text-muted">LFP: 3000 cycles → 80% SoH</p>
        </div>
        <Button size="sm" onClick={calcDegradation} disabled={simLoading}>
          {simLoading ? "Calculating…" : degradation ? "Recalculate" : "Calculate"}
        </Button>
      </div>

      {degradation ? (
        <>
          <Plot
            data={[
              {
                type: "scatter",
                x: degradation.projection.map((p: DegradationYearPoint) => p.year),
                y: degradation.projection.map((p: DegradationYearPoint) => p.soh_percent),
                mode: "lines+markers",
                name: "SoH (%)",
                line: { color: "#60a5fa", width: 2 },
                marker: { size: 5 },
                hovertemplate: "Year %{x}: SoH %{y:.1f}%<extra></extra>",
              },
              {
                type: "scatter",
                x: [0, 20],
                y: [80, 80],
                mode: "lines",
                name: "EOL threshold (80%)",
                line: { color: "#ef4444", width: 1.5, dash: "dot" },
                hoverinfo: "none",
              },
            ]}
            layout={{
              ...DARK_PLOTLY_LAYOUT,
              height: 260,
              xaxis: {
                ...DARK_PLOTLY_LAYOUT.xaxis,
                title: { text: "Year", font: { color: "#9ba3b8", size: 12 } },
                dtick: 5,
              },
              yaxis: {
                ...DARK_PLOTLY_LAYOUT.yaxis,
                title: { text: "State of Health (%)", font: { color: "#9ba3b8", size: 12 } },
                range: [60, 102],
              },
              legend: { ...DARK_PLOTLY_LAYOUT.legend, orientation: "h", x: 0.5, xanchor: "center", y: 1.04, yanchor: "bottom" },
              margin: { t: 52, r: 16, b: 24, l: 64 },
              shapes: [
                {
                  type: "line" as const,
                  x0: degradation.eol_year,
                  x1: degradation.eol_year,
                  y0: 60,
                  y1: 102,
                  line: { color: "#f59e0b", width: 1.5, dash: "dot" },
                },
              ],
            }}
            config={PLOTLY_CONFIG}
            className="w-full"
          />
          <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
            <div className="bg-bg-tertiary rounded p-2">
              <p className="text-text-muted">EOL year</p>
              <p className="font-mono font-bold text-status-warning">{degradation.eol_year}</p>
            </div>
            <div className="bg-bg-tertiary rounded p-2">
              <p className="text-text-muted">Replacement</p>
              <p className="font-mono font-bold text-text-primary">{degradation.replacement_cost_m_eur.toFixed(1)} M€</p>
            </div>
            <div className="bg-bg-tertiary rounded p-2">
              <p className="text-text-muted">LCOE impact</p>
              <p className="font-mono font-bold text-text-primary">{degradation.lcoe_contribution_eur_mwh.toFixed(1)} €/MWh</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-text-muted bg-bg-tertiary rounded p-2">{degradation.assessment}</p>
        </>
      ) : (
        <div className="flex items-center justify-center h-48 text-text-muted text-sm">
          Click "Calculate" to project 20-year SoH degradation
        </div>
      )}
    </div>
  );
}
