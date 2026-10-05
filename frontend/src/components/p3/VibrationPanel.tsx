/**
 * Vibration spectrum — velocity [mm/s RMS] per line with the component's
 * kinematic fault frequencies marked (CMS, M12).
 *
 * Main bearing 0–10 Hz (BPFO ≈ 1.4 Hz needs fine resolution), gearbox and
 * generator 0–200 Hz (gear-mesh frequencies, generator bearing). The overall
 * RMS is compared with the ISO 10816-3 zones.
 */

import { useEffect } from "react";
import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { useCMSStore } from "../../store/cmsStore";
import type { CMSComponent } from "../../types/cms";

const COMPONENTS: { value: CMSComponent; label: string }[] = [
  { value: "MAIN_BEARING", label: "Main bearing" },
  { value: "GEARBOX", label: "Gearbox" },
  { value: "GENERATOR", label: "Generator" },
];
const TURBINES = Array.from({ length: 34 }, (_, i) => `WTG-${String(i + 1).padStart(2, "0")}`);
const ZONES = [
  { upTo: 2.3, label: "A · new" },
  { upTo: 4.5, label: "B · acceptable" },
  { upTo: 7.1, label: "C · alert" },
  { upTo: Infinity, label: "D · danger" },
];

const selectCls = "h-7 text-xs bg-bg-secondary border border-border-primary rounded px-2 text-text-secondary";

export default function VibrationPanel() {
  const vibration = useCMSStore((s) => s.vibration);
  const turbineId = useCMSStore((s) => s.selectedTurbineId);
  const component = useCMSStore((s) => s.selectedComponent);
  const loading = useCMSStore((s) => s.detailLoading);
  const fetchVibration = useCMSStore((s) => s.fetchVibration);
  const c = useChartPalette();

  // Pitch/yaw have no spectrum: fall back to the main bearing
  const comp = COMPONENTS.some((x) => x.value === component) ? component : "MAIN_BEARING";
  useEffect(() => {
    void fetchVibration(turbineId, comp);
  }, [turbineId, comp, fetchVibration]);

  const zone = vibration ? ZONES.find((z) => vibration.overall_rms_mm_s <= z.upTo)! : null;
  const yMax = vibration ? Math.max(...vibration.points.map((p) => p.amplitude_mm_s)) * 1.25 : 1;

  return (
    <section className="bg-bg-secondary rounded-lg border border-border-primary p-3">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h3 className="text-xs font-semibold text-text-primary">Vibration spectrum</h3>
        <select value={turbineId} onChange={(e) => void fetchVibration(e.target.value, comp)} className={selectCls} aria-label="Turbine">
          {TURBINES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select value={comp} onChange={(e) => void fetchVibration(turbineId, e.target.value as CMSComponent)} className={selectCls} aria-label="Component">
          {COMPONENTS.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ))}
        </select>
        <span className="flex-1" />
        {vibration && zone && (
          <span className="text-[11px] font-mono text-text-secondary">
            overall <b className="text-text-primary">{vibration.overall_rms_mm_s.toFixed(2)} mm/s</b> · zone {zone.label} · Δf {vibration.resolution_hz.toFixed(3)} Hz
          </span>
        )}
      </div>

      {vibration ? (
        <Plot
          data={[
            {
              type: "scatter",
              mode: "lines",
              x: vibration.points.map((p) => p.frequency_hz),
              y: vibration.points.map((p) => p.amplitude_mm_s),
              line: { color: c.blue, width: 1.5, shape: "hvh" },
              fill: "tozeroy",
              fillcolor: c.band,
              hovertemplate: "%{x:.3f} Hz · %{y:.3f} mm/s<extra></extra>",
              name: "velocity",
            },
          ]}
          layout={{
            ...DARK_PLOTLY_LAYOUT,
            height: 300,
            showlegend: false,
            transition: CHART_TRANSITION,
            margin: { t: 28, r: 16, b: 48, l: 56 },
            shapes: vibration.fault_frequency_markers.map((m) => ({
              type: "line",
              x0: m.freq_hz,
              x1: m.freq_hz,
              y0: 0,
              y1: yMax,
              line: { color: c.ref, width: 1, dash: "dot" },
            })),
            annotations: vibration.fault_frequency_markers.map((m, i) => ({
              x: m.freq_hz,
              y: yMax * (i % 2 ? 0.92 : 1.0),
              text: `${m.label} ${m.freq_hz < 10 ? m.freq_hz.toFixed(2) : m.freq_hz.toFixed(1)}`,
              showarrow: false,
              xanchor: "left",
              font: { size: 10, color: c.ink },
            })),
            xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Frequency [Hz]", font: { size: 12 } }, range: [0, vibration.points.at(-1)!.frequency_hz] },
            yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "Velocity [mm/s RMS]", font: { size: 12 } }, range: [0, yMax] },
          }}
          config={PLOTLY_CONFIG}
          className="w-full"
          useResizeHandler
          style={{ width: "100%" }}
        />
      ) : (
        <div className="flex items-center justify-center h-48 text-xs text-text-muted">{loading ? "Loading spectrum…" : "No spectrum"}</div>
      )}
      <p className="text-[11px] text-text-muted mt-1">
        Dotted lines: kinematic frequencies at rated speed (rotor 8.33 rpm, gearbox 48:1). A defect shows as a
        peak at its frequency and harmonics; gear wear adds sidebands at the carrier speed. Tooth and roller counts are
        assumed values, not OEM data.
      </p>
    </section>
  );
}
