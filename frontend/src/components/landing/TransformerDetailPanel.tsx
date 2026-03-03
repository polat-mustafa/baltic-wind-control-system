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
  return "#e8eaf0";
}

function statusColor(status: string): string {
  if (status === "Normal") return SCADA_COLORS.ENERGIZED;
  if (status === "Alarm" || status === "Caution") return SCADA_COLORS.WARNING;
  return SCADA_COLORS.FAULT;
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[11px] text-[#6b7490]">{label}</span>
      <span className="text-[11px] font-mono tabular-nums font-medium" style={{ color: color ?? "#e8eaf0" }}>
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
      className="absolute z-50 rounded-lg shadow-2xl shadow-black/50 border overflow-hidden"
      style={{
        backgroundColor: "#0f1117",
        borderColor: "#2a3040",
        width: 280,
        right: 20,
        top: 60,
      }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: "#2a3040" }}>
        <div>
          <div className="text-sm font-semibold text-[#e8eaf0]">{tx.name}</div>
          <div className="text-[10px] text-[#6b7490]">{tx.type}</div>
        </div>
        <button onClick={onClose} className="text-[#6b7490] hover:text-[#e8eaf0] transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Rating section */}
      <div className="px-3 py-2 border-b" style={{ borderColor: "#1e2231" }}>
        <div className="text-[10px] text-[#6b7490] uppercase tracking-wider mb-1">Rating</div>
        <Row label="MVA" value={`${tx.ratingMVA} MVA`} />
        <Row label="Voltage" value={`${tx.lvKV}/${tx.hvKV} kV`} />
        <Row label="Tap Position" value={`${tx.tapPosition > 0 ? "+" : ""}${tx.tapPosition} / ${tx.totalTaps}`} />
      </div>

      {/* Temperatures */}
      <div className="px-3 py-2 border-b" style={{ borderColor: "#1e2231" }}>
        <div className="text-[10px] text-[#6b7490] uppercase tracking-wider mb-1">Temperatures</div>
        <Row label="Oil" value={`${tx.oilTemperatureC.toFixed(1)} °C`} color={valueColor(tx.oilTemperatureC, 70, 85)} />
        <Row label="Winding HV" value={`${tx.windingTempHVC.toFixed(1)} °C`} color={valueColor(tx.windingTempHVC, 80, 95)} />
        <Row label="Winding LV" value={`${tx.windingTempLVC.toFixed(1)} °C`} color={valueColor(tx.windingTempLVC, 80, 95)} />
      </div>

      {/* Load & Cooling */}
      <div className="px-3 py-2 border-b" style={{ borderColor: "#1e2231" }}>
        <div className="text-[10px] text-[#6b7490] uppercase tracking-wider mb-1">Load & Cooling</div>
        <Row label="Load" value={`${tx.loadPercent.toFixed(1)} %`} color={valueColor(tx.loadPercent, 85, 100)} />
        <Row label="Cooling" value={tx.coolingStatus} />
      </div>

      {/* Protection */}
      <div className="px-3 py-2 border-b" style={{ borderColor: "#1e2231" }}>
        <div className="text-[10px] text-[#6b7490] uppercase tracking-wider mb-1">Protection</div>
        <Row label="Buchholz" value={tx.buchholzStatus} color={statusColor(tx.buchholzStatus)} />
        <Row label="DGA" value={tx.dgaStatus} color={statusColor(tx.dgaStatus)} />
        <Row label="Operating Hours" value={tx.operatingHours.toLocaleString()} />
      </div>

      {/* Navigation */}
      <div className="px-3 py-2">
        <button
          onClick={onNavigate}
          className="w-full text-center text-xs py-1.5 rounded-md border transition-colors"
          style={{
            borderColor: "#3b82f6",
            color: "#3b82f6",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(59,130,246,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          {navLabel}
        </button>
      </div>
    </div>
  );
}
