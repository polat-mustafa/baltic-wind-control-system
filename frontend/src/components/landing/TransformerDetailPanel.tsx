/**
 * Transformer detail overlay — shows operating data when a substation is clicked.
 *
 * Displays: MVA rating, tap position, oil/winding temperatures, load %,
 * cooling status (ONAN/ONAF), Buchholz relay, DGA trending.
 *
 * ISA-101 color coding for temperature and load thresholds.
 */

import { X } from "lucide-react";

import { SCADA_COLORS } from "../../constants/scadaColors";
import type { TransformerData } from "../../types/landing";

interface TransformerDetailPanelProps {
  transformer: TransformerData;
  onClose: () => void;
  onNavigate: () => void;
  navLabel: string;
}

function valueColor(value: number, warn: number, alarm: number): string {
  if (value >= alarm) return SCADA_COLORS.FAULT;
  if (value >= warn) return SCADA_COLORS.WARNING;
  return "var(--color-text-primary)";
}

function statusColor(status: string): string {
  if (status === "Normal") return SCADA_COLORS.ENERGIZED;
  if (status === "Alarm" || status === "Caution") return SCADA_COLORS.WARNING;
  return SCADA_COLORS.FAULT;
}

function Row({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[11px] text-text-muted">{label}</span>
      <span
        className="text-[11px] font-mono tabular-nums font-medium"
        style={{ color: color ?? "var(--color-text-primary)" }}
      >
        {value}
      </span>
    </div>
  );
}

export default function TransformerDetailPanel({
  transformer: tx,
  onClose,
  onNavigate,
  navLabel,
}: TransformerDetailPanelProps) {
  return (
    <div
      className="absolute rounded-lg shadow-2xl shadow-black/50 border border-border-primary bg-bg-primary overflow-hidden"
      style={{
        zIndex: 1100,
        width: 280,
        right: 20,
        top: 60,
      }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-border-primary flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-text-primary">
            {tx.name}
          </div>
          <div className="text-[10px] text-text-muted">{tx.type}</div>
        </div>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text-primary transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Rating section */}
      <div className="px-3 py-2 border-b border-bg-tertiary">
        <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
          Rating
        </div>
        <Row label="MVA" value={`${tx.ratingMVA} MVA`} />
        <Row label="Voltage" value={`${tx.lvKV}/${tx.hvKV} kV`} />
        <Row
          label="Tap Position"
          value={`${tx.tapPosition > 0 ? "+" : ""}${tx.tapPosition} / ${tx.totalTaps}`}
        />
      </div>

      {/* Temperatures */}
      <div className="px-3 py-2 border-b border-bg-tertiary">
        <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
          Temperatures
        </div>
        <Row
          label="Oil"
          value={`${tx.oilTemperatureC.toFixed(1)} °C`}
          color={valueColor(tx.oilTemperatureC, 70, 85)}
        />
        <Row
          label="Winding HV"
          value={`${tx.windingTempHVC.toFixed(1)} °C`}
          color={valueColor(tx.windingTempHVC, 80, 95)}
        />
        <Row
          label="Winding LV"
          value={`${tx.windingTempLVC.toFixed(1)} °C`}
          color={valueColor(tx.windingTempLVC, 80, 95)}
        />
      </div>

      {/* Load & Cooling */}
      <div className="px-3 py-2 border-b border-bg-tertiary">
        <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
          Load & Cooling
        </div>
        <Row
          label="Load"
          value={`${tx.loadPercent.toFixed(1)} %`}
          color={valueColor(tx.loadPercent, 85, 100)}
        />
        <Row label="Cooling" value={tx.coolingStatus} />
      </div>

      {/* Protection */}
      <div className="px-3 py-2 border-b border-bg-tertiary">
        <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
          Protection
        </div>
        <Row
          label="Buchholz"
          value={tx.buchholzStatus}
          color={statusColor(tx.buchholzStatus)}
        />
        <Row
          label="DGA"
          value={tx.dgaStatus}
          color={statusColor(tx.dgaStatus)}
        />
        <Row
          label="Operating Hours"
          value={tx.operatingHours.toLocaleString()}
        />
      </div>

      {/* Navigation */}
      <div className="px-3 py-2">
        <button
          onClick={onNavigate}
          className="w-full text-center text-xs py-1.5 rounded-md border border-accent text-accent hover:bg-accent-muted transition-colors"
        >
          {navLabel}
        </button>
      </div>
    </div>
  );
}
