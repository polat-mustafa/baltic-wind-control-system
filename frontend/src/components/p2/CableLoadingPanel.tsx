/**
 * Thermal loading of the main power path for one scenario.
 *
 * Nine elements, not 37: the export circuits, both transformer stages and the
 * head cable of each string (the most loaded segment — it carries the whole
 * string). Ranked, single hue, 100 % rating as the reference line.
 */

import Plot from "react-plotly.js";

import { loadFlowEducation } from "../../constants/education/p2";
import { CHART_HEIGHT, DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { SCENARIO_LABEL } from "../../constants/gridScenarios";
import { useGridStore } from "../../store/gridStore";
import type { LoadFlowScenario } from "../../types/grid";
import { ChartWrapper } from "../ui/ChartWrapper";
import { EducationButton } from "../ui/EducationButton";

const ELEMENT_LABEL: Record<string, string> = {
  Export_220kV: "Export cables 2 × 45 km",
  Trafo_220_400kV: "Onshore TX 2 × 300 MVA",
  Trafo_66_220kV: "Offshore TX 2 × 300 MVA",
};

export function ScenarioTabs() {
  const { activeScenario, setActiveScenario } = useGridStore();
  return (
    <div role="tablist" aria-label="Load-flow scenario" className="flex flex-wrap gap-1">
      {(Object.keys(SCENARIO_LABEL) as LoadFlowScenario[]).map((s) => (
        <button
          key={s}
          role="tab"
          aria-selected={activeScenario === s}
          onClick={() => setActiveScenario(s)}
          className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
            activeScenario === s ? "bg-accent text-white" : "text-text-secondary hover:bg-bg-tertiary"
          }`}
        >
          {SCENARIO_LABEL[s]}
        </button>
      ))}
    </div>
  );
}

export default function CableLoadingPanel() {
  const { loadFlowResults, activeScenario } = useGridStore();
  const c = useChartPalette();
  const result = loadFlowResults?.find((r) => r.scenario === activeScenario);
  if (!result) return null;

  const items = [
    ...result.lines
      .filter((l) => l.name === "Export_220kV" || /^Array_S\d_T1$/.test(l.name))
      .map((l) => ({
        name: ELEMENT_LABEL[l.name] ?? `String ${l.name[7]} head cable`,
        loading: l.loading_percent,
        mw: Math.abs(l.p_from_mw),
        loss: l.pl_mw,
      })),
    ...result.transformers.map((t) => ({
      name: ELEMENT_LABEL[t.name] ?? t.name,
      loading: t.loading_percent,
      mw: Math.abs(t.p_hv_mw),
      loss: t.pl_mw,
    })),
  ].sort((a, b) => a.loading - b.loading); // Plotly draws the first category at the bottom

  const peak = items[items.length - 1];

  return (
    <ChartWrapper
      title="Thermal loading of the power path"
      headerRight={<EducationButton content={loadFlowEducation} />}
      footer={`${SCENARIO_LABEL[activeScenario]} · highest: ${peak.name} at ${peak.loading.toFixed(0)} % · losses ${result.total_loss_mw.toFixed(2)} MW`}
    >
      <ScenarioTabs />
      <Plot
        data={[
          {
            type: "bar",
            orientation: "h",
            y: items.map((i) => i.name),
            x: items.map((i) => i.loading),
            customdata: items.map((i) => [i.mw, i.loss]),
            marker: { color: c.blue },
            text: items.map((i) => `${i.loading.toFixed(0)} %`),
            textposition: "outside",
            textfont: { size: 11, color: c.ink },
            cliponaxis: false,
            hovertemplate: "%{y}<br>%{x:.1f} % of rating · %{customdata[0]:.1f} MW · loss %{customdata[1]:.2f} MW<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          transition: CHART_TRANSITION,
          showlegend: false,
          bargap: 0.3,
          xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Loading [% of rating]", font: { size: 12 } }, range: [0, 115] },
          yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, type: "category", automargin: true, tickfont: { size: 11 } },
          shapes: [
            { type: "line", xref: "x", yref: "paper", x0: 100, x1: 100, y0: 0, y1: 1, line: { color: c.ref, width: 1.5, dash: "dash" } } as const,
          ],
          annotations: [
            { x: 100, y: 1, xref: "x", yref: "paper", yanchor: "bottom", text: "rating", showarrow: false, font: { size: 11 } } as const,
          ],
          margin: { t: 24, r: 24, b: 48, l: 8 },
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: CHART_HEIGHT }}
      />
    </ChartWrapper>
  );
}
