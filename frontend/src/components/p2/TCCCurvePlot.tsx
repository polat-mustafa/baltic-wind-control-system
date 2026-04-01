/**
 * TCC (Time-Current Characteristic) Curve Plot — M05 Protection Relays.
 *
 * Log-log overlay of multiple relay TCC curves + fault current marker.
 * Shows IEC 60255 inverse-time operating characteristics.
 * Selectivity grading (Coordination Time Interval = 80 ms minimum).
 */

import Plot from "react-plotly.js";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useProtectionStore } from "../../store/protectionStore";

const RELAY_COLORS = [
  "#3ecf6e", // upstream 1 — green
  "#60a5fa", // upstream 2 — blue
  "#f59e0b", // midpoint — amber
  "#f87171", // downstream — red/coral
  "#a78bfa", // backup — purple
];

export default function TCCCurvePlot() {
  const { tccData, coordinationResult } = useProtectionStore();

  if (!tccData) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        Run a coordination study to populate TCC curves
      </div>
    );
  }

  const traces = tccData.curves.map((curve, i) => ({
    x: curve.points.map((p) => p.current_multiple),
    y: curve.points.map((p) => p.operating_time_s),
    type: "scatter" as const,
    mode: "lines" as const,
    name: curve.relay_location,
    line: { color: RELAY_COLORS[i % RELAY_COLORS.length], width: 2 },
    hovertemplate: `<b>${curve.relay_location}</b><br>I/I_n: %{x:.2f}<br>t: %{y:.3f} s<extra></extra>`,
  }));

  // Fault current marker (vertical line)
  const faultMarkers = coordinationResult?.relay_sequence.map((_event) => ({
    x: [coordinationResult.fault_current_ka, coordinationResult.fault_current_ka],
    y: [0.01, 100],
    type: "scatter" as const,
    mode: "lines" as const,
    name: `Fault current ${coordinationResult.fault_current_ka.toFixed(1)} kA`,
    line: { color: "#ef4444", width: 1.5, dash: "dot" as const },
    showlegend: false,
  })) ?? [];

  return (
    <Plot
      data={[...traces, ...faultMarkers.slice(0, 1)]}
      layout={{
        ...DARK_PLOTLY_LAYOUT,
        height: 380,
        xaxis: {
          ...DARK_PLOTLY_LAYOUT.xaxis,
          type: "log" as const,
          title: { text: "I / I_n (multiples)", font: { color: "#9ba3b8", size: 12 } },
          range: [0, 2],
        },
        yaxis: {
          ...DARK_PLOTLY_LAYOUT.yaxis,
          type: "log" as const,
          title: { text: "Operating time (s)", font: { color: "#9ba3b8", size: 12 } },
          range: [-2, 2],
        },
        legend: { ...DARK_PLOTLY_LAYOUT.legend, x: 0.98, xanchor: "right", y: 0.98 },
        margin: { t: 30, r: 24, b: 56, l: 72 },
      }}
      config={PLOTLY_CONFIG}
      className="w-full"
    />
  );
}
