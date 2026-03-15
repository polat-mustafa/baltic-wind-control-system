/**
 * Voltage profile bar chart — per-bus voltage across scenarios.
 *
 * X-axis: bus names (PSE_400kV → OSS → WTGs)
 * Y-axis: voltage magnitude [p.u.]
 * Horizontal bands at 0.95 and 1.05 pu (PSE IRiESP limits).
 * Color-coded by voltage level: 400kV=red, 220kV=blue, 66kV=green.
 */

import Plot from "react-plotly.js";
import { useGridStore } from "../../store/gridStore";
import { SCADA_COLORS } from "../../constants/scadaColors";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { InfoButton } from "../ui/InfoButton";
import { voltageProfileInfo } from "../../constants/panelInfo";

const VOLTAGE_COLORS: Record<number, string> = {
  400: SCADA_COLORS.VOLTAGE_400KV,
  220: SCADA_COLORS.VOLTAGE_220KV,
  66: SCADA_COLORS.VOLTAGE_66KV,
};

export default function VoltageProfilePanel() {
  const { loadFlowResults, activeScenario } = useGridStore();

  if (!loadFlowResults) return null;

  const result = loadFlowResults.find((r) => r.scenario === activeScenario);
  if (!result || !result.buses.length) return null;

  // Filter to key buses (skip individual WTGs for readability — show aggregated)
  const keyBuses = result.buses.filter(
    (b) => !b.name.startsWith("WTG_") || b.name === "WTG_01" || b.name === "WTG_17" || b.name === "WTG_34"
  );

  const names = keyBuses.map((b) => b.name);
  const voltages = keyBuses.map((b) => b.vm_pu);
  const colors = keyBuses.map((b) => {
    const level = b.vn_kv >= 300 ? 400 : b.vn_kv >= 100 ? 220 : 66;
    return VOLTAGE_COLORS[level] ?? SCADA_COLORS.ENERGIZED;
  });

  const scenarioLabel = activeScenario.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold text-text-primary">
          Voltage Profile — {scenarioLabel}
        </h3>
        <InfoButton info={voltageProfileInfo} />
      </div>
      <Plot
        data={[
          {
            type: "bar",
            x: names,
            y: voltages,
            marker: { color: colors },
            text: voltages.map((v) => `${v.toFixed(4)} pu`),
            textposition: "outside",
            textfont: { size: 11, color: "rgb(148, 163, 184)" },
            hovertemplate: "%{x}<br>V = %{y:.4f} pu<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: 400,
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            title: "Voltage [p.u.]",
            range: [0.92, 1.08],
          },
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            tickangle: -45,
            tickfont: { size: 11, color: "rgb(148, 163, 184)" },
          },
          shapes: [
            // PSE upper limit (1.05 pu)
            {
              type: "line",
              x0: -0.5, x1: names.length - 0.5,
              y0: 1.05, y1: 1.05,
              line: { color: SCADA_COLORS.FAULT, width: 1.5, dash: "dash" },
            },
            // PSE lower limit (0.95 pu)
            {
              type: "line",
              x0: -0.5, x1: names.length - 0.5,
              y0: 0.95, y1: 0.95,
              line: { color: SCADA_COLORS.FAULT, width: 1.5, dash: "dash" },
            },
            // Nominal (1.0 pu)
            {
              type: "line",
              x0: -0.5, x1: names.length - 0.5,
              y0: 1.0, y1: 1.0,
              line: { color: "rgba(148, 163, 184, 0.4)", width: 1, dash: "dot" },
            },
          ],
          annotations: [
            {
              x: names.length - 1, y: 1.05,
              text: "1.05 pu (PSE max)",
              showarrow: false,
              font: { size: 11, color: SCADA_COLORS.FAULT },
              yshift: 12,
            },
            {
              x: names.length - 1, y: 0.95,
              text: "0.95 pu (PSE min)",
              showarrow: false,
              font: { size: 11, color: SCADA_COLORS.FAULT },
              yshift: -12,
            },
          ],
        }}
        config={PLOTLY_CONFIG}
        className="w-full"
      />
    </div>
  );
}
