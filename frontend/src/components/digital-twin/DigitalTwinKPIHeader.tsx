/**
 * DigitalTwinKPIHeader — 6 KPI cards for farm-level health summary.
 *
 * Shows: Farm Health %, Healthy count, Degraded count, Critical count,
 * Worst Turbine, Total Anomalies Found.
 */

import { useDigitalTwinStore } from "../../store/digitalTwinStore";

const STATUS_COLORS = {
  healthy: "text-green-400",
  degraded: "text-amber-400",
  critical: "text-red-400",
} as const;

export default function DigitalTwinKPIHeader() {
  const analysis = useDigitalTwinStore((s) => s.analysis);

  if (!analysis) return null;

  const { farm_health } = analysis;

  const healthColor =
    farm_health.farm_health_pct >= 70
      ? "text-green-400"
      : farm_health.farm_health_pct >= 40
        ? "text-amber-400"
        : "text-red-400";

  const kpis = [
    {
      label: "Farm Health",
      value: `${farm_health.farm_health_pct.toFixed(1)}%`,
      color: healthColor,
    },
    {
      label: "Healthy",
      value: farm_health.healthy_count,
      color: STATUS_COLORS.healthy,
    },
    {
      label: "Degraded",
      value: farm_health.degraded_count,
      color: STATUS_COLORS.degraded,
    },
    {
      label: "Critical",
      value: farm_health.critical_count,
      color: STATUS_COLORS.critical,
    },
    {
      label: "Worst Turbine",
      value: farm_health.worst_turbine_name,
      color: "text-red-400",
    },
    {
      label: "Anomalies",
      value: farm_health.total_anomalies,
      color: farm_health.total_anomalies > 0 ? "text-amber-400" : "text-green-400",
    },
  ];

  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="bg-bg-secondary rounded-lg border border-border-primary p-3 text-center"
        >
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
            {kpi.label}
          </p>
          <p className={`text-lg font-bold font-mono ${kpi.color}`}>
            {kpi.value}
          </p>
        </div>
      ))}
    </div>
  );
}
