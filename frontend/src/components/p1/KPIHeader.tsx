/**
 * KPI summary cards — top-level wind resource metrics.
 *
 * Displays: Net AEP, Wake Loss, Capacity Factor, Revenue, Uncertainty.
 * Domain Rule 10: uncertainty shown on every AEP figure.
 */

import { useWindResourceStore } from "../../store/windResourceStore";
import { KPICard } from "../ui/KPICard";
import { Wind, Gauge, TrendingUp, AlertTriangle, Waves } from "lucide-react";

export default function KPIHeader() {
  const { aepCascade, wakeAnalysis } = useWindResourceStore();

  if (!aepCascade || !wakeAnalysis) return null;

  const wakeTrend: "up" | "down" | "flat" =
    wakeAnalysis.wake_loss_percent > 15
      ? "up"
      : wakeAnalysis.wake_loss_percent > 10
        ? "flat"
        : "down";

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <KPICard
        label="Net AEP (P50)"
        value={aepCascade.net_aep_gwh.toFixed(1)}
        unit="GWh/yr"
        icon={<Wind size={16} />}
        trend="up"
        trendValue={`P90: ${aepCascade.p90_gwh.toFixed(1)} GWh`}
      />
      <KPICard
        label="Wake Loss"
        value={wakeAnalysis.wake_loss_percent.toFixed(1)}
        unit="%"
        icon={<Waves size={16} />}
        trend={wakeTrend}
        trendValue={wakeTrend === "up" ? "Above target" : "Within target"}
      />
      <KPICard
        label="Capacity Factor"
        value={(aepCascade.capacity_factor * 100).toFixed(1)}
        unit="%"
        icon={<Gauge size={16} />}
      />
      <KPICard
        label="Revenue (P50)"
        value={aepCascade.revenue_meur.toFixed(1)}
        unit={`M\u20AC/yr`}
        icon={<TrendingUp size={16} />}
        trend="up"
        trendValue={`@ ${aepCascade.price_eur_mwh} \u20AC/MWh`}
      />
      <KPICard
        label="Uncertainty"
        value={`\u00B1${aepCascade.combined_uncertainty_percent.toFixed(1)}`}
        unit="%"
        icon={<AlertTriangle size={16} />}
        trend="flat"
        trendValue="IEC 61400-15 RSS"
      />
    </div>
  );
}
