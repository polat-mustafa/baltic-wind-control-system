/**
 * Professional SCADA tooltip for turbine icons — shows full operational
 * data in a 2-column grid with ISA-101 color-coded alarm thresholds.
 *
 * When a turbine is faulted and has a fault type, a red-tinted fault
 * detail section is shown between the header and the data grid.
 *
 * Thresholds per ISO 10816 (vibration) and OEM specs (bearing temp):
 *   vibration > 4.5 mm/s → warning, > 7.0 → alarm
 *   bearing temp > 65°C → warning, > 80°C → alarm
 */

import { FAULT_CATEGORIES } from "../../constants/faultCategories";
import { SCADA_COLORS } from "../../constants/scadaColors";
import type { TurbineData, TurbineStatus } from "../../types/landing";

interface TurbineTooltipProps {
  turbine: TurbineData;
  position: { x: number; y: number };
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

/** ISA-101: color a value based on alarm thresholds. */
function valueColor(value: number, warnThreshold: number, alarmThreshold: number): string {
  if (value >= alarmThreshold) return SCADA_COLORS.FAULT;
  if (value >= warnThreshold) return SCADA_COLORS.WARNING;
  return "#e8eaf0";
}

function Row({ label, value, unit, color }: { label: string; value: string; unit: string; color?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[#6b7490] text-[10px]">{label}</span>
      <span className="font-mono tabular-nums text-[11px] font-medium" style={{ color: color ?? "#e8eaf0" }}>
        {value}
        <span className="text-[#6b7490] text-[9px] ml-0.5">{unit}</span>
      </span>
    </div>
  );
}

export default function TurbineTooltip({ turbine, position }: TurbineTooltipProps) {
  const t = turbine;
  const sColor = STATUS_COLOR[t.status];
  const faultCategory = t.status === "fault" && t.faultType
    ? FAULT_CATEGORIES.find((c) => c.type === t.faultType)
    : null;

  return (
    <div
      className="absolute z-50 pointer-events-none rounded-lg shadow-2xl shadow-black/50 border overflow-hidden"
      style={{
        left: position.x + 16,
        top: position.y - 40,
        backgroundColor: "#0f1117",
        borderColor: "#2a3040",
        minWidth: 220,
      }}
    >
      {/* Header */}
      <div className="px-3 py-1.5 border-b flex items-center justify-between" style={{ borderColor: "#2a3040" }}>
        <span className="font-semibold text-sm text-[#e8eaf0]">{t.id}</span>
        <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: sColor }}>
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: sColor }} />
          {STATUS_LABEL[t.status]}
        </span>
      </div>

      {/* Fault detail section — red-tinted, only shown when faulted */}
      {faultCategory && (
        <div className="px-3 py-2 border-b" style={{ borderColor: "#2a3040", backgroundColor: "rgba(239,68,68,0.08)" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: SCADA_COLORS.FAULT }} />
            <span className="text-[11px] font-semibold" style={{ color: SCADA_COLORS.FAULT }}>
              {faultCategory.label}
            </span>
          </div>
          <div className="text-[9px] text-[#6b7490] space-y-0.5">
            <div>
              <span className="text-[#94a3b8]">Priority:</span>{" "}
              <span style={{ color: faultCategory.priority === "CRITICAL" ? SCADA_COLORS.FAULT : faultCategory.priority === "HIGH" ? SCADA_COLORS.WARNING : "#e8eaf0" }}>
                {faultCategory.priority}
              </span>
            </div>
            <div>
              <span className="text-[#94a3b8]">Cause:</span> {faultCategory.probableCause}
            </div>
            <div>
              <span className="text-[#94a3b8]">Action:</span> {faultCategory.recommendedAction}
            </div>
          </div>
        </div>
      )}

      {/* Two-column data grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 px-3 py-2">
        <Row label="Power" value={t.powerOutputMW.toFixed(1)} unit="MW" />
        <Row label="Rotor" value={t.rotorSpeedRpm.toFixed(1)} unit="rpm" />

        <Row label="Wind" value={t.windSpeedMs.toFixed(1)} unit="m/s" />
        <Row label="Pitch" value={t.pitchAngleDeg.toFixed(1)} unit="deg" />

        <Row label="Nacelle" value={`${Math.round(t.nacellePositionDeg)}`} unit="deg" />
        <Row label="Avail" value={t.availabilityPct.toFixed(1)} unit="%" />

        <Row label="Energy" value={t.energyTodayMWh.toFixed(0)} unit="MWh" />
        <Row
          label="Vibr"
          value={t.vibrationMmS.toFixed(1)}
          unit="mm/s"
          color={valueColor(t.vibrationMmS, 4.5, 7.0)}
        />

        <Row
          label="Bearing"
          value={t.bearingTempC.toFixed(0)}
          unit="\u00B0C"
          color={valueColor(t.bearingTempC, 65, 80)}
        />
        <Row label="Hours" value={t.operatingHours.toLocaleString()} unit="h" />
      </div>

      {/* Footer */}
      <div className="px-3 py-1 border-t text-[9px] text-[#6b7490] font-mono" style={{ borderColor: "#2a3040" }}>
        String {t.stringNumber} · {faultCategory ? "Click for fault details" : "Click for details"}
      </div>
    </div>
  );
}
