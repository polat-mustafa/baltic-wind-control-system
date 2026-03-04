/**
 * Turbine detail overlay — shows full operational data when a turbine is clicked.
 *
 * Sections:
 * - Header: turbine ID + status badge + close button
 * - Active Fault (conditional): fault type, priority, cause, recommended action
 * - Operational Data: 2-column grid with live values, ISA-101 threshold colors
 * - Turbine Datasheet: static V236-15.0 MW specs
 * - Navigation: 5 buttons linking to all dashboards (P1-P5)
 *
 * Positioned at left: 20, top: 60 (opposite side from transformer panel).
 */

import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { FAULT_CATEGORIES } from "../../constants/faultCategories";
import { SCADA_COLORS } from "../../constants/scadaColors";
import type { TurbineData, TurbineStatus } from "../../types/landing";

interface TurbineDetailPanelProps {
  turbine: TurbineData;
  onClose: () => void;
}

const STATUS_COLOR: Record<TurbineStatus, string> = {
  operating: SCADA_COLORS.ENERGIZED,
  curtailed: SCADA_COLORS.WARNING,
  fault: SCADA_COLORS.FAULT,
  offline: SCADA_COLORS.DE_ENERGIZED,
};

const STATUS_LABEL: Record<TurbineStatus, string> = {
  operating: "Operating",
  curtailed: "Curtailed",
  fault: "Fault",
  offline: "Offline",
};

function valueColor(value: number, warn: number, alarm: number): string {
  if (value >= alarm) return SCADA_COLORS.FAULT;
  if (value >= warn) return SCADA_COLORS.WARNING;
  return "#e8eaf0";
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

const NAV_ITEMS = [
  { label: "P1 Wind Resource", path: "/wind-resource", color: "#3b82f6" },
  { label: "P2 HV Grid", path: "/hv-grid", color: "#8b5cf6" },
  { label: "P3 SCADA", path: "/scada", color: "#10b981" },
  { label: "P4 Forecasting", path: "/forecasting", color: "#f59e0b" },
  { label: "P5 Commissioning", path: "/commissioning", color: "#ef4444" },
];

export default function TurbineDetailPanel({ turbine: t, onClose }: TurbineDetailPanelProps) {
  const navigate = useNavigate();
  const sColor = STATUS_COLOR[t.status];
  const faultCategory = t.status === "fault" && t.faultType
    ? FAULT_CATEGORIES.find((c) => c.type === t.faultType)
    : null;

  return (
    <div
      className="absolute z-50 rounded-lg shadow-2xl shadow-black/50 border overflow-y-auto"
      style={{
        backgroundColor: "#0f1117",
        borderColor: "#2a3040",
        width: 320,
        left: 20,
        top: 60,
        maxHeight: "calc(100% - 80px)",
      }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: "#2a3040" }}>
        <div>
          <div className="text-sm font-semibold text-[#e8eaf0]">{t.id}</div>
          <div className="text-[10px] text-[#6b7490]">String {t.stringNumber} · V236-15.0 MW</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: sColor }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: sColor }} />
            {STATUS_LABEL[t.status]}
          </span>
          <button onClick={onClose} className="text-[#6b7490] hover:text-[#e8eaf0] transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Active Fault — red-tinted, only shown when faulted */}
      {faultCategory && (
        <div className="px-3 py-2 border-b" style={{ borderColor: "#2a3040", backgroundColor: "rgba(239,68,68,0.08)" }}>
          <div className="text-[10px] text-[#6b7490] uppercase tracking-wider mb-1">Active Fault</div>
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: SCADA_COLORS.FAULT }}
            />
            <span className="text-[12px] font-semibold" style={{ color: SCADA_COLORS.FAULT }}>
              {faultCategory.label}
            </span>
          </div>
          <div className="text-[10px] text-[#6b7490] space-y-0.5">
            <div>
              <span className="text-[#94a3b8]">Priority:</span>{" "}
              <span style={{ color: faultCategory.priority === "CRITICAL" ? SCADA_COLORS.FAULT : faultCategory.priority === "HIGH" ? SCADA_COLORS.WARNING : "#e8eaf0" }}>
                {faultCategory.priority}
              </span>
            </div>
            <div><span className="text-[#94a3b8]">Cause:</span> {faultCategory.probableCause}</div>
            <div><span className="text-[#94a3b8]">Action:</span> {faultCategory.recommendedAction}</div>
          </div>
        </div>
      )}

      {/* Operational Data */}
      <div className="px-3 py-2 border-b" style={{ borderColor: "#1e2231" }}>
        <div className="text-[10px] text-[#6b7490] uppercase tracking-wider mb-1">Operational Data</div>
        <div className="grid grid-cols-2 gap-x-4">
          <Row label="Power" value={`${t.powerOutputMW.toFixed(1)} MW`} />
          <Row label="Wind" value={`${t.windSpeedMs.toFixed(1)} m/s`} />
          <Row label="Rotor" value={`${t.rotorSpeedRpm.toFixed(1)} rpm`} />
          <Row label="Pitch" value={`${t.pitchAngleDeg.toFixed(1)}\u00B0`} />
          <Row label="Nacelle" value={`${Math.round(t.nacellePositionDeg)}\u00B0`} />
          <Row label="Avail" value={`${t.availabilityPct.toFixed(1)} %`} />
          <Row label="Energy" value={`${t.energyTodayMWh.toFixed(0)} MWh`} />
          <Row
            label="Vibration"
            value={`${t.vibrationMmS.toFixed(1)} mm/s`}
            color={valueColor(t.vibrationMmS, 4.5, 7.0)}
          />
          <Row
            label="Bearing"
            value={`${t.bearingTempC.toFixed(0)} \u00B0C`}
            color={valueColor(t.bearingTempC, 65, 80)}
          />
          <Row label="Hours" value={`${t.operatingHours.toLocaleString()} h`} />
        </div>
      </div>

      {/* Turbine Datasheet */}
      <div className="px-3 py-2 border-b" style={{ borderColor: "#1e2231" }}>
        <div className="text-[10px] text-[#6b7490] uppercase tracking-wider mb-1">Turbine Datasheet</div>
        <Row label="Model" value="Vestas V236-15.0 MW" />
        <Row label="Rotor Diameter" value="236 m" />
        <Row label="Hub Height" value="150 m" />
        <Row label="Rated Power" value="15.0 MW" />
        <Row label="Cut-in" value="3.0 m/s" />
        <Row label="Rated Wind" value="12.5 m/s" />
        <Row label="Cut-out" value="31.0 m/s" />
        <Row label="Rated RPM" value="9.55 rpm" />
        <Row label="Generator" value="PMSG, Full Converter" />
        <Row label="Array Voltage" value="66 kV" />
      </div>

      {/* Navigation Buttons */}
      <div className="px-3 py-2 space-y-1.5">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="w-full text-center text-xs py-1.5 rounded-md border transition-colors"
            style={{ borderColor: item.color, color: item.color }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${item.color}1a`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
