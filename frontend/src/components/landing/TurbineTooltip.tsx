/**
 * Professional SCADA tooltip for turbine icons — shows full operational
 * data in a 2-column grid with ISA-101 color-coded alarm thresholds.
 *
 * Positioned as an HTML overlay on top of the SVG canvas using
 * absolute positioning relative to the map container.
 *
 * Thresholds per ISO 10816 (vibration) and OEM specs (bearing temp):
 *   vibration > 4.5 mm/s → warning, > 7.0 → alarm
 *   bearing temp > 65°C → warning, > 80°C → alarm
 */

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
  const statusColor = STATUS_COLOR[t.status];

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
        <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: statusColor }}>
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: statusColor }} />
          {STATUS_LABEL[t.status]}
        </span>
      </div>

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
          unit="°C"
          color={valueColor(t.bearingTempC, 65, 80)}
        />
        <Row label="Hours" value={t.operatingHours.toLocaleString()} unit="h" />
      </div>

      {/* Footer */}
      <div className="px-3 py-1 border-t text-[9px] text-[#6b7490] font-mono" style={{ borderColor: "#2a3040" }}>
        String {t.stringNumber} · Click for details
      </div>
    </div>
  );
}
