/**
 * KPI ribbon — farm-level metrics updated every 3s.
 *
 * Supports two layouts:
 *   horizontal (default): glassmorphic bar across the top of the map
 *   vertical: right sidebar strip (legacy, unused by default)
 *
 * Uses ISA-101 muted colors for control room readability.
 */

import type { FarmKPI } from "../../types/landing";
import { Zap, Wind, Gauge, AlertTriangle, Activity, TrendingUp } from "lucide-react";
import { cn } from "../../lib/utils";

interface MapKPIRibbonProps {
  kpis: FarmKPI;
  horizontal?: boolean;
}

interface KPIItemProps {
  label: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
  color?: string;
}

function KPIChip({ label, value, unit, icon, color = "#3ecf6e" }: KPIItemProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <span className="text-text-muted">{icon}</span>
      <div className="flex items-baseline gap-1">
        <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium mr-1">{label}</span>
        <span className="text-sm font-bold tabular-nums transition-colors duration-700" style={{ color }}>
          {value}
        </span>
        <span className="text-[9px] text-text-muted">{unit}</span>
      </div>
    </div>
  );
}

export default function MapKPIRibbon({ kpis, horizontal = true }: MapKPIRibbonProps) {
  const capacityPct = kpis.capacityFactorPct;
  const capacityColor = capacityPct > 80 ? "#3ecf6e" : capacityPct > 50 ? "#f5a623" : "#ef4444";
  const alertColor = kpis.activeAlerts === 0 ? "#3ecf6e" : kpis.activeAlerts > 3 ? "#ef4444" : "#f5a623";
  const freqColor = Math.abs(kpis.gridFrequencyHz - 50) < 0.05 ? "#3ecf6e" : "#f5a623";

  if (!horizontal) {
    // Legacy vertical layout (kept for backward compatibility)
    return (
      <div className="flex flex-col bg-bg-secondary border border-border-primary rounded-lg overflow-hidden h-full">
        <div className="px-3 py-2 border-b border-border-primary bg-bg-tertiary">
          <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Live KPIs</span>
        </div>
        <div className="flex-1 overflow-y-auto text-sm">
          <div className="px-3 py-2 border-b border-border-primary">
            <span className="text-text-muted text-[10px]">Total Output</span>
            <div className="font-bold tabular-nums transition-colors duration-700" style={{ color: "#3ecf6e" }}>
              {kpis.totalOutputMW.toFixed(0)} <span className="text-[10px] text-text-muted">MW / 510</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Horizontal glassmorphic bar
  return (
    <div
      className={cn(
        "flex items-center justify-between flex-wrap gap-y-0.5",
        "bg-bg-secondary/80 backdrop-blur-md border-b border-border-primary",
        "rounded-b-lg mx-12 shadow-lg shadow-black/20",
        "pointer-events-auto",
      )}
    >
      <KPIChip
        label="Output"
        value={kpis.totalOutputMW.toFixed(0)}
        unit="MW"
        icon={<Zap size={12} />}
        color="#3ecf6e"
      />
      <KPIChip
        label="Wind"
        value={kpis.averageWindSpeedMs.toFixed(1)}
        unit="m/s"
        icon={<Wind size={12} />}
        color="#3b82f6"
      />
      <KPIChip
        label="Avail"
        value={kpis.availabilityPercent.toFixed(1)}
        unit="%"
        icon={<Gauge size={12} />}
        color={kpis.availabilityPercent >= 95 ? "#3ecf6e" : "#f5a623"}
      />
      <KPIChip
        label="Alerts"
        value={String(kpis.activeAlerts)}
        unit={kpis.activeAlerts === 1 ? "alarm" : "alarms"}
        icon={<AlertTriangle size={12} />}
        color={alertColor}
      />

      {/* Capacity factor with mini bar */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className="text-text-muted"><TrendingUp size={12} /></span>
        <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">CF</span>
        <div className="w-16 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(capacityPct, 100)}%`, backgroundColor: capacityColor }}
          />
        </div>
        <span className="text-xs font-bold tabular-nums transition-colors duration-700" style={{ color: capacityColor }}>
          {capacityPct.toFixed(1)}%
        </span>
      </div>

      <KPIChip
        label="Freq"
        value={kpis.gridFrequencyHz.toFixed(2)}
        unit="Hz"
        icon={<Activity size={12} />}
        color={freqColor}
      />
    </div>
  );
}
