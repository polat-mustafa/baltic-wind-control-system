/**
 * Vibration FFT Spectrum Panel — M12 CMS.
 *
 * Plotly bar: frequency (Hz) vs amplitude (mm/s RMS).
 * Fault frequency markers shown as vertical red dashed lines.
 * Select component from the currently selected turbine.
 */

import Plot from "react-plotly.js";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useCMSStore } from "../../store/cmsStore";
import type { CMSComponent } from "../../types/cms";

const COMPONENTS: { value: CMSComponent; label: string }[] = [
  { value: "MAIN_BEARING", label: "Main Bearing" },
  { value: "GEARBOX", label: "Gearbox" },
  { value: "GENERATOR", label: "Generator" },
  { value: "ROTOR_HUB", label: "Rotor Hub" },
  { value: "PITCH_SYSTEM", label: "Pitch System" },
];

export default function VibrationPanel() {
  const { vibration, selectedTurbineId, selectedComponent, detailLoading, fetchVibration } = useCMSStore();

  const faultShapes = (vibration?.fault_frequency_markers ?? []).map((f) => ({
    type: "line" as const,
    x0: f,
    x1: f,
    y0: 0,
    y1: (vibration?.dominant_amplitude_mm_s ?? 5) * 1.2,
    line: { color: "#ef4444", width: 1, dash: "dot" as const },
  }));

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-text-primary">
          FFT Spectrum — {selectedTurbineId}
        </h3>
        <div className="flex items-center gap-2">
          <select
            value={selectedComponent}
            onChange={(e) => fetchVibration(selectedTurbineId, e.target.value as CMSComponent)}
            className="text-xs bg-bg-tertiary border border-border-primary rounded px-2 py-1 text-text-secondary"
          >
            {COMPONENTS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {detailLoading ? (
        <div className="flex items-center justify-center h-48 text-text-muted text-sm">
          <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin mr-2" />
          Loading spectrum…
        </div>
      ) : vibration ? (
        <>
          <Plot
            data={[
              {
                type: "bar",
                x: vibration.points.map((p) => p.frequency_hz),
                y: vibration.points.map((p) => p.amplitude_mm_s),
                name: "Amplitude (mm/s)",
                marker: { color: "#60a5fa", opacity: 0.8 },
                hovertemplate: "%{x:.0f} Hz → %{y:.4f} mm/s<extra></extra>",
              },
            ]}
            layout={{
              ...DARK_PLOTLY_LAYOUT,
              height: 260,
              shapes: faultShapes,
              xaxis: {
                ...DARK_PLOTLY_LAYOUT.xaxis,
                title: { text: "Frequency (Hz)", font: { color: "#9ba3b8", size: 12 } },
              },
              yaxis: {
                ...DARK_PLOTLY_LAYOUT.yaxis,
                title: { text: "Amplitude (mm/s RMS)", font: { color: "#9ba3b8", size: 12 } },
              },
              margin: { t: 16, r: 16, b: 56, l: 64 },
            }}
            config={PLOTLY_CONFIG}
            className="w-full"
          />
          <div className="flex gap-4 mt-1.5 text-xs text-text-muted">
            <span>Dom. freq: <span className="text-text-primary font-mono">{vibration.dominant_frequency_hz.toFixed(1)} Hz</span></span>
            <span>Amp: <span className="text-text-primary font-mono">{vibration.dominant_amplitude_mm_s.toFixed(3)} mm/s</span></span>
            {faultShapes.length > 0 && <span className="text-status-alarm">⚠ {faultShapes.length} fault frequencies marked</span>}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-48 text-text-muted text-sm">
          Click a turbine in the health heatmap to load vibration data
        </div>
      )}
    </div>
  );
}
