/**
 * Bottom KPI ribbon — farm-level metrics updated every 3s.
 *
 * Displays: total power output, average wind speed, availability, active alerts.
 * Reuses the KPICard pattern from P1 KPIHeader.
 */

import { SCADA_COLORS } from "../../constants/scadaColors";
import type { FarmKPI } from "../../types/landing";

interface MapKPIRibbonProps {
  kpis: FarmKPI;
}

interface KPIItemProps {
  label: string;
  value: string;
  unit: string;
  color?: string;
}

function KPIItem({ label, value, unit, color }: KPIItemProps) {
  return (
    <div className="bg-slate-800 rounded-lg px-4 py-2.5 border border-slate-700 min-w-[140px]">
      <p className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold mt-0.5" style={color ? { color } : undefined}>
        {value}
        <span className="text-xs font-normal text-slate-400 ml-1">{unit}</span>
      </p>
    </div>
  );
}

export default function MapKPIRibbon({ kpis }: MapKPIRibbonProps) {
  const availColor =
    kpis.availabilityPercent >= 95
      ? SCADA_COLORS.ENERGIZED
      : kpis.availabilityPercent >= 85
        ? SCADA_COLORS.WARNING
        : SCADA_COLORS.FAULT;

  const alertColor = kpis.activeAlerts === 0 ? SCADA_COLORS.ENERGIZED : SCADA_COLORS.WARNING;

  return (
    <div className="flex gap-3 flex-wrap">
      <KPIItem
        label="Total Output"
        value={kpis.totalOutputMW.toFixed(0)}
        unit={`MW / 510 MW`}
        color={SCADA_COLORS.ENERGIZED}
      />
      <KPIItem
        label="Avg Wind Speed"
        value={kpis.averageWindSpeedMs.toFixed(1)}
        unit="m/s"
      />
      <KPIItem
        label="Availability"
        value={kpis.availabilityPercent.toFixed(1)}
        unit="%"
        color={availColor}
      />
      <KPIItem
        label="Active Alerts"
        value={String(kpis.activeAlerts)}
        unit={kpis.activeAlerts === 1 ? "alarm" : "alarms"}
        color={alertColor}
      />
    </div>
  );
}
