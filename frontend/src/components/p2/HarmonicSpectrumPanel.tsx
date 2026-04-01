/**
 * Harmonic Spectrum Panel — M06 Power Quality.
 *
 * Plotly bar chart: harmonic order vs magnitude %.
 * IEC 61000-3-6 HV planning levels overlaid as horizontal lines.
 * Green = compliant, red = exceeds limit.
 */

import Plot from "react-plotly.js";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { usePowerQualityStore } from "../../store/powerQualityStore";

export default function HarmonicSpectrumPanel() {
  const { harmonics } = usePowerQualityStore();

  if (!harmonics) {
    return (
      <div className="flex items-center justify-center h-48 text-text-muted text-sm">
        Run analysis to see harmonic spectrum
      </div>
    );
  }

  const orders = harmonics.harmonics.map((h) => `H${h.order}`);
  const magnitudes = harmonics.harmonics.map((h) => h.magnitude_pct);
  const limits = harmonics.harmonics.map((h) => h.limit_pct);
  const colors = harmonics.harmonics.map((h) =>
    h.exceeds_limit ? "#ef4444" : "#3ecf6e"
  );

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-text-primary">Harmonic Spectrum (IEC 61000-3-6)</h3>
        <div className="flex items-center gap-2 text-xs">
          <span className={`px-2 py-0.5 rounded font-mono ${harmonics.compliant ? "bg-status-success/20 text-status-success" : "bg-status-alarm/20 text-status-alarm"}`}>
            THD {harmonics.thd_voltage_pct.toFixed(1)}% {harmonics.compliant ? "✓" : "✗"}
          </span>
          <span className="text-text-muted">{harmonics.voltage_level}</span>
        </div>
      </div>
      <Plot
        data={[
          {
            type: "bar",
            x: orders,
            y: magnitudes,
            name: "Measured",
            marker: { color: colors, opacity: 0.85 },
            hovertemplate: "%{x}: %{y:.2f}%<extra></extra>",
          },
          {
            type: "scatter",
            x: orders,
            y: limits,
            mode: "lines+markers",
            name: "IEC limit",
            line: { color: "#f59e0b", width: 1.5, dash: "dot" },
            marker: { size: 5 },
            hovertemplate: "Limit %{x}: %{y:.1f}%<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: 280,
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            title: { text: "Harmonic order", font: { color: "#9ba3b8", size: 12 } },
          },
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            title: { text: "Magnitude (% of fundamental)", font: { color: "#9ba3b8", size: 12 } },
          },
          legend: { ...DARK_PLOTLY_LAYOUT.legend, orientation: "h", y: -0.25 },
          margin: { t: 20, r: 16, b: 60, l: 64 },
        }}
        config={PLOTLY_CONFIG}
        className="w-full"
      />
    </div>
  );
}
