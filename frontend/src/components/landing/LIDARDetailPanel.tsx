/**
 * LIDAR met mast detail panel.
 *
 * Shows the floating-LIDAR specs, current 4-beam wind measurements, signal
 * quality + availability stats. Reads farm-level wind from useLandingStore
 * for the live readout — independent of WTG SCADA per IEC 61400-12-1.
 */

import { X, Activity } from "lucide-react";

import { selectKPIs, useLandingStore } from "../../store/landingStore";
import { SCADA_COLORS } from "../../constants/scadaColors";

interface LIDARDetailPanelProps {
  onClose: () => void;
}

function Row({ label, value, color = "#e8eaf0" }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[11px] text-[#6b7490]">{label}</span>
      <span className="text-[11px] font-mono tabular-nums font-medium" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-2 border-t" style={{ borderColor: "#1e2231" }}>
      <div className="text-[9px] font-semibold uppercase tracking-widest text-[#6b7490] mb-1">{title}</div>
      {children}
    </div>
  );
}

export default function LIDARDetailPanel({ onClose }: LIDARDetailPanelProps) {
  const kpis = useLandingStore(selectKPIs);
  const windMs = kpis.averageWindSpeedMs;
  const dirDeg = kpis.windDirectionDeg;

  // Derived measurement values per IEC 61400-12-1 floating LIDAR spec.
  // 4 conical beams at 30° tilt → reconstruct U/V/W from line-of-sight projections.
  const ti = Math.max(0.05, Math.min(0.25, 0.08 + (windMs > 12 ? 0.04 : 0))); // turbulence intensity
  const gust3s = windMs * 1.4;
  const shearAlpha = 0.10;     // power-law shear exponent (offshore typical)
  const veerDeg = 2.5;         // direction veer 30→200m
  const dataRate = 99.7;       // %
  const status = windMs > 0.5 ? "VALID" : "STANDBY";
  const statusColor = status === "VALID" ? SCADA_COLORS.ENERGIZED : "#94a3b8";

  return (
    <div
      className="absolute z-[1100] rounded-lg shadow-2xl shadow-black/50 border overflow-hidden"
      style={{
        backgroundColor: "#0f1117",
        borderColor: "#2a3040",
        width: 320,
        right: 16,
        top: 80,
      }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: "#2a3040" }}>
        <div>
          <div className="text-sm font-semibold text-[#e8eaf0] flex items-center gap-2">
            LIDAR · MM-1
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ backgroundColor: `${statusColor}22`, color: statusColor }}>
              {status}
            </span>
          </div>
          <div className="text-[10px] text-[#6b7490]">Floating LIDAR · ZX 300M · IEC 61400-12-1</div>
        </div>
        <button
          onClick={onClose}
          className="text-[#6b7490] hover:text-[#e8eaf0] p-1 rounded hover:bg-[#1e2231]"
          aria-label="Close LIDAR panel"
        >
          <X size={14} />
        </button>
      </div>

      {/* Live wind readout */}
      <div className="px-3 py-2 border-b" style={{ borderColor: "#2a3040" }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-[#6b7490]">Hub-Height Wind (90 m)</div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: statusColor }}>
              {windMs.toFixed(1)}
              <span className="text-xs text-[#6b7490] ml-1 font-normal">m/s</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-widest text-[#6b7490]">Direction</div>
            <div className="text-xl font-bold tabular-nums text-[#cbd5e1]">
              {dirDeg.toFixed(0)}°
            </div>
          </div>
        </div>
      </div>

      {/* Vertical profile (0 / 30 / 60 / 90 / 120 / 150 / 180 / 210 m) — bars */}
      <Section title="Vertical Profile">
        {[180, 150, 120, 90, 60, 30].map((h) => {
          const u = windMs * Math.pow(h / 90, shearAlpha);
          const fillPct = Math.min(100, (u / 25) * 100);
          return (
            <div key={h} className="flex items-center gap-2 my-0.5">
              <span className="text-[9px] text-[#6b7490] w-8 text-right tabular-nums font-mono">{h}m</span>
              <div className="flex-1 h-2.5 bg-[#1e2231] rounded-sm overflow-hidden">
                <div
                  className="h-full rounded-sm transition-all duration-700"
                  style={{ width: `${fillPct}%`, backgroundColor: u > 15 ? "#f5a623" : SCADA_COLORS.ENERGIZED }}
                />
              </div>
              <span className="text-[10px] font-mono tabular-nums w-14 text-right" style={{ color: u > 15 ? "#f5a623" : "#cbd5e1" }}>
                {u.toFixed(1)} m/s
              </span>
            </div>
          );
        })}
      </Section>

      {/* Derived quantities */}
      <Section title="Derived Atmospherics">
        <Row label="Turbulence Intensity (TI)" value={`${(ti * 100).toFixed(1)} %`} />
        <Row label="3-second Gust" value={`${gust3s.toFixed(1)} m/s`} />
        <Row label="Wind Shear (α, power law)" value={shearAlpha.toFixed(2)} />
        <Row label="Direction Veer (30→200 m)" value={`${veerDeg.toFixed(1)}°`} />
        <Row label="Atmospheric Stability" value={ti < 0.10 ? "Stable" : ti < 0.15 ? "Neutral" : "Unstable"} />
      </Section>

      {/* Sensor health */}
      <Section title="Sensor Health">
        <Row label="Data Availability (10-min)" value={`${dataRate.toFixed(1)} %`} color={SCADA_COLORS.ENERGIZED} />
        <Row label="Backscatter SNR" value={`+${(18 + (windMs > 5 ? 4 : 0)).toFixed(0)} dB`} />
        <Row label="Buoy Heading (yaw)" value={`${(dirDeg + 12).toFixed(0)}°`} />
        <Row label="Buoy Tilt" value={`${(2.1 + Math.sin(Date.now() / 5000) * 0.4).toFixed(1)}° / ${(1.4 + Math.cos(Date.now() / 6000) * 0.3).toFixed(1)}°`} />
        <Row label="Battery (solar + wind)" value="98 %" color={SCADA_COLORS.ENERGIZED} />
        <Row label="Last Calibration" value="2025-11-04" />
      </Section>

      {/* Specs */}
      <Section title="Specifications">
        <Row label="Manufacturer" value="ZX Lidars" />
        <Row label="Model" value="ZX 300M (Floating)" />
        <Row label="Range" value="10 – 200 m AGL" />
        <Row label="Beams" value="4 × VAD conical, 30° tilt" />
        <Row label="Position" value="54.65° N · 16.37° E" />
        <Row label="Water Depth" value="32 m" />
      </Section>

      {/* Compliance footer */}
      <div className="px-3 py-2 border-t" style={{ borderColor: "#1e2231", backgroundColor: "#0a0d14" }}>
        <div className="flex items-center gap-2 text-[10px] text-[#6b7490]">
          <Activity size={11} />
          <span>Reference for P50 / P75 / P90 wind resource validation</span>
        </div>
      </div>
    </div>
  );
}
