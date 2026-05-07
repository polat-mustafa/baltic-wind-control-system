/**
 * Export cable detail overlay — shows cable specifications and thermal loading.
 *
 * Displays: cable type, voltage/current ratings, length, impedance,
 * thermal loading %, cross-section, manufacturer, burial depth.
 *
 * ISA-101 color coding for thermal loading threshold.
 */

import { X } from "lucide-react";

import { SCADA_COLORS } from "../../constants/scadaColors";
import type { CableData } from "../../types/landing";

interface CableDetailPanelProps {
  cable: CableData;
  onClose: () => void;
  onNavigate: () => void;
}

function loadColor(pct: number): string {
  if (pct >= 90) return SCADA_COLORS.FAULT;
  if (pct >= 70) return SCADA_COLORS.WARNING;
  return SCADA_COLORS.ENERGIZED;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[11px] text-text-muted">{label}</span>
      <span className="text-[11px] font-mono tabular-nums font-medium text-text-primary">
        {value}
      </span>
    </div>
  );
}

export default function CableDetailPanel({
  cable,
  onClose,
  onNavigate,
}: CableDetailPanelProps) {
  return (
    <div
      className="absolute rounded-lg shadow-2xl shadow-black/50 border border-border-primary bg-bg-primary overflow-hidden"
      style={{
        zIndex: 1100,
        width: 280,
        left: "50%",
        top: 60,
        transform: "translateX(-50%)",
      }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-border-primary flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-text-primary">
            220 kV Export Cable
          </div>
          <div className="text-[10px] text-text-muted">{cable.type}</div>
        </div>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text-primary transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Thermal Loading Bar */}
      <div className="px-3 py-2 border-b border-bg-tertiary">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-text-muted uppercase tracking-wider">
            Thermal Loading
          </span>
          <span
            className="text-xs font-mono font-bold"
            style={{ color: loadColor(cable.thermalLoadingPct) }}
          >
            {cable.thermalLoadingPct.toFixed(1)} %
          </span>
        </div>
        <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${cable.thermalLoadingPct}%`,
              backgroundColor: loadColor(cable.thermalLoadingPct),
            }}
          />
        </div>
      </div>

      {/* Electrical */}
      <div className="px-3 py-2 border-b border-bg-tertiary">
        <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
          Electrical
        </div>
        <Row label="Voltage Rating" value={`${cable.voltageRatingKV} kV`} />
        <Row label="Current Rating" value={`${cable.currentRatingA} A`} />
        <Row label="Cross Section" value={`${cable.crossSectionMm2} mm²`} />
      </div>

      {/* Physical */}
      <div className="px-3 py-2 border-b border-bg-tertiary">
        <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
          Physical
        </div>
        <Row label="Length" value={`${cable.lengthKm} km`} />
        <Row label="Burial Depth" value={`${cable.burialDepthM} m`} />
        <Row label="Insulation" value={cable.insulationType} />
        <Row label="Manufacturer" value={cable.manufacturer} />
      </div>

      {/* Navigation */}
      <div className="px-3 py-2">
        <button
          onClick={onNavigate}
          className="w-full text-center text-xs py-1.5 rounded-md border border-accent text-accent hover:bg-accent-muted transition-colors"
        >
          Open HV Grid Dashboard
        </button>
      </div>
    </div>
  );
}
