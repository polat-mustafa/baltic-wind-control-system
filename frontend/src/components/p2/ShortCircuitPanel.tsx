/**
 * Short-circuit analysis panel — IEC 60909 results.
 *
 * Grouped bar chart: Ik'' (symmetrical) and ip (peak) per bus.
 * Horizontal lines for breaker ratings per voltage level.
 * Badge: "Breakers Adequate" / "Breakers Inadequate".
 */

import Plot from "react-plotly.js";
import { useGridStore } from "../../store/gridStore";
import { SCADA_COLORS } from "../../constants/scadaColors";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";

export default function ShortCircuitPanel() {
  const { shortCircuit } = useGridStore();

  if (!shortCircuit) return null;

  const buses = shortCircuit.bus_results;
  const names = buses.map((b) => b.bus_name);
  const ikss = buses.map((b) => b.ikss_ka);
  const ip = buses.map((b) => b.ip_ka);

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-200">
          Short-Circuit Analysis (IEC 60909, c={shortCircuit.voltage_factor_c})
        </h3>
        <span
          className="text-xs px-2 py-1 rounded font-semibold"
          style={{
            backgroundColor: shortCircuit.breaker_adequate
              ? "rgba(0, 255, 0, 0.15)"
              : "rgba(255, 0, 0, 0.15)",
            color: shortCircuit.breaker_adequate
              ? SCADA_COLORS.ENERGIZED
              : SCADA_COLORS.FAULT,
          }}
        >
          {shortCircuit.breaker_adequate ? "Breakers Adequate" : "Breakers Inadequate"}
        </span>
      </div>
      <Plot
        data={[
          {
            type: "bar",
            name: "Ik'' (symmetrical)",
            x: names,
            y: ikss,
            marker: { color: SCADA_COLORS.VOLTAGE_220KV },
            hovertemplate: "%{x}<br>Ik'' = %{y:.2f} kA<extra></extra>",
          },
          {
            type: "bar",
            name: "ip (peak)",
            x: names,
            y: ip,
            marker: { color: SCADA_COLORS.WARNING },
            hovertemplate: "%{x}<br>ip = %{y:.2f} kA<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: 300,
          barmode: "group",
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            title: "Current [kA]",
          },
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            tickangle: -45,
            tickfont: { size: 9, color: "rgb(148, 163, 184)" },
          },
          legend: {
            orientation: "h",
            y: 1.15,
            font: { size: 10, color: "rgb(148, 163, 184)" },
          },
          shapes: [
            // 66 kV breaker rating (25 kA)
            {
              type: "line",
              x0: -0.5, x1: names.length - 0.5,
              y0: 25, y1: 25,
              line: { color: SCADA_COLORS.VOLTAGE_66KV, width: 1, dash: "dot" },
            },
            // 220 kV breaker rating (40 kA)
            {
              type: "line",
              x0: -0.5, x1: names.length - 0.5,
              y0: 40, y1: 40,
              line: { color: SCADA_COLORS.VOLTAGE_220KV, width: 1, dash: "dot" },
            },
          ],
        }}
        config={PLOTLY_CONFIG}
        className="w-full"
      />
      <p className="text-xs text-slate-500 mt-1">
        Max Ik&apos;&apos; = {shortCircuit.max_ikss_ka.toFixed(2)} kA at {shortCircuit.max_ikss_bus}
      </p>
    </div>
  );
}
