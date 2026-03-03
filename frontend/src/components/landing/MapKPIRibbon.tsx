/**
 * Bottom KPI ribbon — farm-level metrics updated every 3s.
 *
 * Displays: total power output, average wind speed, availability, active alerts.
 * Uses the shared KPICard component from the design system.
 */

import type { FarmKPI } from "../../types/landing";
import { KPICard } from "../ui/KPICard";
import { Zap, Wind, Gauge, AlertTriangle } from "lucide-react";

interface MapKPIRibbonProps {
  kpis: FarmKPI;
}

export default function MapKPIRibbon({ kpis }: MapKPIRibbonProps) {
  const availTrend: "up" | "down" | "flat" =
    kpis.availabilityPercent >= 95
      ? "up"
      : kpis.availabilityPercent >= 85
        ? "flat"
        : "down";

  const alertTrend: "up" | "down" | "flat" =
    kpis.activeAlerts === 0 ? "down" : "up";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
      <KPICard
        label="Total Output"
        value={kpis.totalOutputMW.toFixed(0)}
        unit="MW / 510"
        icon={<Zap size={16} />}
        trend="up"
        trendValue={`${((kpis.totalOutputMW / 510) * 100).toFixed(0)}% capacity`}
      />
      <KPICard
        label="Avg Wind Speed"
        value={kpis.averageWindSpeedMs.toFixed(1)}
        unit="m/s"
        icon={<Wind size={16} />}
      />
      <KPICard
        label="Availability"
        value={kpis.availabilityPercent.toFixed(1)}
        unit="%"
        icon={<Gauge size={16} />}
        trend={availTrend}
        trendValue={availTrend === "up" ? "Target met" : "Below target"}
      />
      <KPICard
        label="Active Alerts"
        value={String(kpis.activeAlerts)}
        unit={kpis.activeAlerts === 1 ? "alarm" : "alarms"}
        icon={<AlertTriangle size={16} />}
        trend={alertTrend}
        trendValue={kpis.activeAlerts === 0 ? "All clear" : "Attention needed"}
      />
    </div>
  );
}
