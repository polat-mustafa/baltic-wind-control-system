/**
 * Resonance Scan Panel — M06 Power Quality.
 *
 * Network impedance vs frequency plot (0–2500 Hz).
 * Parallel resonance peaks marked with annotations.
 * Critical harmonics (where wind farm injects near resonance) flagged in red.
 */

import Plot from "react-plotly.js";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { usePowerQualityStore } from "../../store/powerQualityStore";
import type { ResonancePoint } from "../../types/powerQuality";

export default function ResonanceScanPanel() {
  const { resonance } = usePowerQualityStore();

  if (!resonance) {
    return (
      <div className="flex items-center justify-center h-48 text-text-muted text-sm">
        Run analysis to see resonance scan
      </div>
    );
  }

  // Resonance peak annotations
  const annotations = resonance.resonance_points.map((pt: ResonancePoint) => ({
    x: pt.frequency_hz,
    y: pt.impedance_ohm,
    text: `${pt.frequency_hz.toFixed(0)} Hz<br>${pt.risk_level}`,
    font: { size: 10, color: pt.risk_level === "HIGH" ? "#ef4444" : "#f59e0b" },
    showarrow: true,
    arrowcolor: pt.risk_level === "HIGH" ? "#ef4444" : "#f59e0b",
    arrowsize: 0.8,
    arrowwidth: 1.5,
    ax: 30,
    ay: -30,
  }));

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-text-primary">Network Impedance Scan</h3>
        <span className="text-xs text-text-muted font-mono">
          Cable resonance: {resonance.cable_resonant_freq_hz.toFixed(0)} Hz
        </span>
      </div>
      <Plot
        data={[
          {
            type: "scatter",
            x: resonance.frequencies_hz,
            y: resonance.impedances_ohm,
            mode: "lines",
            name: "|Z| (Ω)",
            line: { color: "#60a5fa", width: 2 },
            hovertemplate: "%{x:.0f} Hz → %{y:.2f} Ω<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: 280,
          annotations,
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            title: { text: "Frequency (Hz)", font: { color: "#9ba3b8", size: 12 } },
          },
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            title: { text: "|Z| (Ω)", font: { color: "#9ba3b8", size: 12 } },
          },
          margin: { t: 20, r: 16, b: 56, l: 64 },
        }}
        config={PLOTLY_CONFIG}
        className="w-full"
      />
      {resonance.assessment && (
        <p className="mt-2 text-xs text-text-muted bg-bg-tertiary rounded p-2">
          {resonance.assessment}
        </p>
      )}
    </div>
  );
}
