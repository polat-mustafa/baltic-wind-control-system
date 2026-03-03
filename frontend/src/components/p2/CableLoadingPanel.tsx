/**
 * Cable and transformer loading — horizontal bar chart.
 *
 * Y-axis: cable/transformer names
 * X-axis: thermal loading [%]
 * Color: green (<80%), amber (80-100%), red (>100%)
 * Vertical red line at 100% (thermal limit).
 */

import Plot from "react-plotly.js";
import { useGridStore } from "../../store/gridStore";
import { SCADA_COLORS } from "../../constants/scadaColors";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { InfoButton } from "../ui/InfoButton";
import { cableLoadingInfo } from "../../constants/panelInfo";

function loadingColor(pct: number): string {
  if (pct > 100) return SCADA_COLORS.FAULT;
  if (pct > 80) return SCADA_COLORS.WARNING;
  return SCADA_COLORS.ENERGIZED;
}

export default function CableLoadingPanel() {
  const { loadFlowResults, activeScenario } = useGridStore();

  if (!loadFlowResults) return null;

  const result = loadFlowResults.find((r) => r.scenario === activeScenario);
  if (!result) return null;

  // Combine lines and transformers
  const items = [
    ...result.lines.map((l) => ({
      name: l.name,
      loading: l.loading_percent,
      loss: l.pl_mw,
    })),
    ...result.transformers.map((t) => ({
      name: t.name,
      loading: t.loading_percent,
      loss: t.pl_mw,
    })),
  ];

  // Sort by loading descending, take top 15 for readability
  items.sort((a, b) => b.loading - a.loading);
  const top = items.slice(0, 15);

  const names = top.map((i) => i.name);
  const loadings = top.map((i) => i.loading);
  const colors = top.map((i) => loadingColor(i.loading));

  const scenarioLabel = activeScenario.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-text-primary">
          Cable &amp; Transformer Loading — {scenarioLabel}
        </h3>
        <InfoButton info={cableLoadingInfo} />
      </div>
      <Plot
        data={[
          {
            type: "bar",
            orientation: "h",
            y: names,
            x: loadings,
            marker: { color: colors },
            text: loadings.map((v) => `${v.toFixed(1)}%`),
            textposition: "outside",
            textfont: { size: 9, color: "rgb(148, 163, 184)" },
            hovertemplate: "%{y}<br>Loading: %{x:.1f}%<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: Math.max(250, top.length * 28 + 80),
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            title: "Thermal Loading [%]",
            range: [0, Math.max(110, ...loadings) * 1.15],
          },
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            automargin: true,
            tickfont: { size: 9, color: "rgb(148, 163, 184)" },
          },
          shapes: [
            {
              type: "line",
              x0: 100, x1: 100,
              y0: -0.5, y1: top.length - 0.5,
              line: { color: SCADA_COLORS.FAULT, width: 2, dash: "dash" },
            },
          ],
          margin: { ...DARK_PLOTLY_LAYOUT.margin, l: 140 },
        }}
        config={PLOTLY_CONFIG}
        className="w-full"
      />
    </div>
  );
}
