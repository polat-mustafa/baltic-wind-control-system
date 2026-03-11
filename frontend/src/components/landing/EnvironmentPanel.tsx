/**
 * Compact environment / sea-state info panel.
 *
 * Reads from the landing store's `environment` slice and displays:
 *   - Beaufort scale badge + description
 *   - Significant wave height (Hs) and peak period (Tp)
 *   - Air & sea temperature
 *   - Visibility, cloud cover, barometric pressure
 *   - Simulated time-of-day clock
 *
 * Positioned bottom-left above the alarm ticker. ISA-101 dark theme.
 */

import { selectEnvironment, useLandingStore } from "../../store/landingStore";

/** Beaufort colour scale: 0-3 green, 4-6 cyan, 7-9 amber, 10+ red */
function beaufortColor(scale: number): string {
  if (scale <= 3) return "#22c55e";
  if (scale <= 6) return "#06b6d4";
  if (scale <= 9) return "#f59e0b";
  return "#ef4444";
}

function formatHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export default function EnvironmentPanel() {
  const env = useLandingStore(selectEnvironment);
  const bColor = beaufortColor(env.beaufortScale);

  return (
    <div
      className="pointer-events-auto rounded-lg border overflow-hidden"
      style={{
        backgroundColor: "rgba(15,17,23,0.92)",
        borderColor: "#2a3040",
        minWidth: 180,
      }}
    >
      {/* Header with simulated clock */}
      <div
        className="flex items-center justify-between px-2.5 py-1 border-b"
        style={{ borderColor: "#2a3040" }}
      >
        <span className="text-[10px] font-semibold tracking-wider uppercase text-[#6b7490]">
          Environment
        </span>
        <span
          className="text-[10px] font-mono tabular-nums"
          style={{ color: "#94a3b8" }}
        >
          {formatHour(env.simulatedHour)} UTC
        </span>
      </div>

      {/* Beaufort badge */}
      <div className="flex items-center gap-2 px-2.5 py-1.5 border-b" style={{ borderColor: "#2a3040" }}>
        <span
          className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
          style={{ backgroundColor: bColor + "22", color: bColor, border: `1px solid ${bColor}44` }}
        >
          {env.beaufortScale}
        </span>
        <div>
          <div className="text-[11px] font-medium" style={{ color: bColor }}>
            Bft {env.beaufortScale} — {env.beaufortDesc}
          </div>
        </div>
      </div>

      {/* Sea state */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 px-2.5 py-1.5 text-[10px]">
        <Row label="Hs" value={`${env.significantWaveHeightM.toFixed(1)} m`} />
        <Row label="Tp" value={`${env.wavePeriodS.toFixed(1)} s`} />
        <Row label="Air" value={`${env.airTemperatureC.toFixed(1)} °C`} />
        <Row label="Sea" value={`${env.seaTemperatureC.toFixed(1)} °C`} />
        <Row label="Vis" value={`${env.visibilityKm.toFixed(0)} km`} />
        <Row label="Cloud" value={`${env.cloudCoverPct}%`} />
        <Row label="Press" value={`${env.pressureHpa.toFixed(0)} hPa`} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[#6b7490]">{label}</span>
      <span className="text-[#e8eaf0] font-mono tabular-nums">{value}</span>
    </div>
  );
}
