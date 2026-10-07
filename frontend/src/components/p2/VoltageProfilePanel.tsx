/**
 * Voltage along the connection — PSE 400 kV → onshore → offshore → string 1.
 *
 * One line per load-flow scenario across the same path, so the reader sees
 * where voltage rises or drops and why (no load: cable charging lifts the
 * offshore end; full load: current through the array drops it towards the
 * last turbine). Shaded band = 0.95–1.05 p.u. planning band.
 */

import Plot from "react-plotly.js";

import { loadFlowEducation } from "../../constants/education/p2";
import { scenarioLabels } from "../../constants/gridScenarios";
import { CHART_HEIGHT, DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { useGridStore, useNetwork } from "../../store/gridStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { EducationButton } from "../ui/EducationButton";

const PATH = [
  ["PSE_400kV", "PSE 400"],
  ["Onshore_220kV", "Onshore 220"],
  ["OSS_220kV", "OSS 220"],
  ["OSS_66kV", "OSS 66"],
  ["WTG_01", "T1"],
  ["WTG_02", "T2"],
  ["WTG_03", "T3"],
  ["WTG_04", "T4"],
  ["WTG_05", "T5"],
  ["WTG_06", "T6"],
] as const;

export default function VoltageProfilePanel() {
  const n = useNetwork();
  const SCENARIO_LABEL = scenarioLabels(n);
  const { loadFlowResults } = useGridStore();
  const c = useChartPalette();
  if (!loadFlowResults?.length) return null;

  const colors = [c.blue, c.orange, c.aqua, c.yellow];
  const x = PATH.map(([, label]) => label);
  const all: number[] = [];
  const traces = loadFlowResults.map((r, i) => {
    const byName = new Map(r.buses.map((b) => [b.name, b.vm_pu]));
    const y = PATH.map(([bus]) => byName.get(bus) ?? null);
    y.forEach((v) => v && all.push(v));
    return {
      type: "scatter" as const,
      mode: "lines+markers" as const,
      name: SCENARIO_LABEL[r.scenario],
      x,
      y,
      line: { color: colors[i % colors.length], width: 2 },
      marker: { size: 8, color: colors[i % colors.length] },
      hovertemplate: `${SCENARIO_LABEL[r.scenario]}<br>%{x}: %{y:.4f} pu<extra></extra>`,
    };
  });
  const lo = Math.min(0.94, ...all) - 0.005;
  const hi = Math.max(1.06, ...all) + 0.005;

  return (
    <ChartWrapper
      title="Voltage along the connection"
      headerRight={<EducationButton content={loadFlowEducation} />}
      footer={`Grid (slack) → 400/220 kV → ${n.export_length_km} km export → 220/66 kV → string 1 turbines · band = 0.95–1.05 pu`}
    >
      <Plot
        data={traces}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          transition: CHART_TRANSITION,
          showlegend: true,
          legend: { orientation: "h", y: 1.12, x: 0, font: { size: 11 } },
          xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, type: "category", tickfont: { size: 11 } },
          yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "Voltage [pu]", font: { size: 12 } }, range: [lo, hi] },
          shapes: [
            { type: "rect", xref: "paper", x0: 0, x1: 1, y0: 0.95, y1: 1.05, fillcolor: c.band, line: { width: 0 }, layer: "below" } as const,
            { type: "line", xref: "paper", x0: 0, x1: 1, y0: 1.0, y1: 1.0, line: { color: c.ref, width: 1, dash: "dot" } } as const,
          ],
          margin: { t: 36, r: 16, b: 48, l: 56 },
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: CHART_HEIGHT }}
      />
    </ChartWrapper>
  );
}
