/**
 * KPI summary — headline wind-resource numbers, each with its context line.
 *
 * No trend arrows: these are single-run results, not time series. Domain
 * Rule 10: uncertainty is shown next to the AEP figures.
 */

import { AlertTriangle, Gauge, TrendingUp, Waves, Wind } from "lucide-react";

import {
  aepCascadeEducation,
  capacityFactorEducation,
  lcoeEducation,
  uncertaintyEducation,
  wakeLossEducation,
} from "../../constants/education/p1";
import { useWindResourceStore } from "../../store/windResourceStore";
import { KPICard } from "../ui/KPICard";

/** Typical offshore wake losses for large arrays (literature range). */
const TYPICAL_WAKE = [5, 15] as const;

export default function KPIHeader() {
  const { aepCascade, wakeAnalysis } = useWindResourceStore();
  if (!aepCascade || !wakeAnalysis) return null;

  const wake = wakeAnalysis.wake_loss_percent;
  const wakeNote =
    wake < TYPICAL_WAKE[0] ? "Below typical offshore 5–15 %" : wake > TYPICAL_WAKE[1] ? "Above typical offshore 5–15 %" : "Within typical offshore 5–15 %";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
      <KPICard
        label="Net AEP (P50)"
        value={aepCascade.net_aep_gwh.toFixed(0)}
        unit="GWh/yr"
        icon={<Wind size={16} />}
        trendValue={`P90 ${aepCascade.p90_gwh.toFixed(0)} GWh/yr`}
        education={aepCascadeEducation}
      />
      <KPICard
        label="Wake loss"
        value={wake.toFixed(1)}
        unit="%"
        icon={<Waves size={16} />}
        trendValue={wakeNote}
        education={wakeLossEducation}
      />
      <KPICard
        label="Net capacity factor"
        value={(aepCascade.capacity_factor * 100).toFixed(1)}
        unit="%"
        icon={<Gauge size={16} />}
        trendValue={`${((aepCascade.capacity_factor * 8760) | 0).toLocaleString("en")} full-load h/yr`}
        education={capacityFactorEducation}
      />
      <KPICard
        label="Revenue (P50)"
        value={aepCascade.revenue_meur.toFixed(1)}
        unit="M€/yr"
        icon={<TrendingUp size={16} />}
        trendValue={`at ${aepCascade.price_eur_mwh} €/MWh flat`}
        education={lcoeEducation}
      />
      <KPICard
        label="AEP uncertainty (1σ)"
        value={`±${aepCascade.combined_uncertainty_percent.toFixed(1)}`}
        unit="%"
        icon={<AlertTriangle size={16} />}
        trendValue="RSS of 8 sources · IEC 61400-15"
        education={uncertaintyEducation}
      />
    </div>
  );
}
