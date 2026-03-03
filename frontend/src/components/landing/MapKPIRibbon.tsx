/**
 * Vertical KPI panel — farm-level metrics updated every 3s.
 *
 * Displays as a vertical strip on the right side of the map:
 * total power, wind speed, availability, alerts, capacity factor,
 * grid frequency, estimated revenue.
 *
 * Uses ISA-101 muted colors for control room readability.
 */

import type { FarmKPI } from "../../types/landing";
import { Zap, Wind, Gauge, AlertTriangle, Activity, DollarSign, TrendingUp } from "lucide-react";
import { cn } from "../../lib/utils";

interface MapKPIRibbonProps {
  kpis: FarmKPI;
}

interface KPIItemProps {
  label: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
  color?: string;
  sublabel?: string;
}

function KPIItem({ label, value, unit, icon, color = "#3ecf6e", sublabel }: KPIItemProps) {
  return (
    <div className="px-3 py-2.5 border-b border-border-primary last:border-b-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-text-muted">{icon}</span>
        <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold tabular-nums" style={{ color }}>
          {value}
        </span>
        <span className="text-[10px] text-text-muted">{unit}</span>
      </div>
      {sublabel && (
        <span className="text-[9px] text-text-muted mt-0.5 block">{sublabel}</span>
      )}
    </div>
  );
}

export default function MapKPIRibbon({ kpis }: MapKPIRibbonProps) {
  const capacityPct = kpis.capacityFactorPct;
  const capacityColor = capacityPct > 80 ? "#3ecf6e" : capacityPct > 50 ? "#f5a623" : "#ef4444";
  const alertColor = kpis.activeAlerts === 0 ? "#3ecf6e" : kpis.activeAlerts > 3 ? "#ef4444" : "#f5a623";
  const freqColor = Math.abs(kpis.gridFrequencyHz - 50) < 0.05 ? "#3ecf6e" : "#f5a623";

  return (
    <div className="flex flex-col bg-bg-secondary border border-border-primary rounded-lg overflow-hidden h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border-primary bg-bg-tertiary">
        <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Live KPIs</span>
      </div>

      {/* KPI items */}
      <div className="flex-1 overflow-y-auto">
        <KPIItem
          label="Total Output"
          value={kpis.totalOutputMW.toFixed(0)}
          unit="MW / 510"
          icon={<Zap size={12} />}
          color="#3ecf6e"
          sublabel={`${capacityPct.toFixed(0)}% capacity`}
        />

        <KPIItem
          label="Wind Speed"
          value={kpis.averageWindSpeedMs.toFixed(1)}
          unit="m/s"
          icon={<Wind size={12} />}
          color="#3b82f6"
        />

        <KPIItem
          label="Availability"
          value={kpis.availabilityPercent.toFixed(1)}
          unit="%"
          icon={<Gauge size={12} />}
          color={kpis.availabilityPercent >= 95 ? "#3ecf6e" : "#f5a623"}
          sublabel={kpis.availabilityPercent >= 95 ? "Target met" : "Below target"}
        />

        <KPIItem
          label="Active Alerts"
          value={String(kpis.activeAlerts)}
          unit={kpis.activeAlerts === 1 ? "alarm" : "alarms"}
          icon={<AlertTriangle size={12} />}
          color={alertColor}
          sublabel={kpis.activeAlerts === 0 ? "All clear" : "Attention needed"}
        />

        {/* Capacity factor bar */}
        <div className="px-3 py-2.5 border-b border-border-primary">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-text-muted"><TrendingUp size={12} /></span>
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">Capacity Factor</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-700")}
                style={{ width: `${Math.min(capacityPct, 100)}%`, backgroundColor: capacityColor }}
              />
            </div>
            <span className="text-xs font-bold tabular-nums" style={{ color: capacityColor }}>
              {capacityPct.toFixed(1)}%
            </span>
          </div>
        </div>

        <KPIItem
          label="Grid Frequency"
          value={kpis.gridFrequencyHz.toFixed(2)}
          unit="Hz"
          icon={<Activity size={12} />}
          color={freqColor}
          sublabel="PSE 50 Hz ± 0.2 Hz"
        />

        <KPIItem
          label="Revenue Today"
          value={`€${kpis.revenueTodayEUR.toLocaleString()}`}
          unit=""
          icon={<DollarSign size={12} />}
          color="#a78bfa"
          sublabel="Spot price ~€80/MWh"
        />
      </div>
    </div>
  );
}
