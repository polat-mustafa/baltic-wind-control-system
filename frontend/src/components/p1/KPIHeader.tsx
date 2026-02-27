/**
 * KPI summary cards — top-level wind resource metrics.
 *
 * Displays: Net AEP, Wake Loss, Capacity Factor, Revenue, Uncertainty.
 * Domain Rule 10: uncertainty shown on every AEP figure.
 */

import { useWindResourceStore } from "../../store/windResourceStore";
import { SCADA_COLORS } from "../../constants/scadaColors";

interface KPICardProps {
  label: string;
  value: string;
  unit: string;
  color?: string;
  subtitle?: string;
}

function KPICard({ label, value, unit, color, subtitle }: KPICardProps) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold mt-1" style={color ? { color } : undefined}>
        {value}
        <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>
      </p>
      {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}

export default function KPIHeader() {
  const { aepCascade, wakeAnalysis } = useWindResourceStore();

  if (!aepCascade || !wakeAnalysis) return null;

  const wakeLossColor =
    wakeAnalysis.wake_loss_percent > 15
      ? SCADA_COLORS.FAULT
      : wakeAnalysis.wake_loss_percent > 10
        ? SCADA_COLORS.WARNING
        : SCADA_COLORS.ENERGIZED;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <KPICard
        label="Net AEP (P50)"
        value={aepCascade.net_aep_gwh.toFixed(1)}
        unit="GWh/yr"
        color={SCADA_COLORS.ENERGIZED}
        subtitle={`P90: ${aepCascade.p90_gwh.toFixed(1)} GWh (financing)`}
      />
      <KPICard
        label="Wake Loss"
        value={wakeAnalysis.wake_loss_percent.toFixed(1)}
        unit="%"
        color={wakeLossColor}
      />
      <KPICard
        label="Capacity Factor"
        value={(aepCascade.capacity_factor * 100).toFixed(1)}
        unit="%"
        subtitle={`CF = Net AEP / (${34 * 15} MW x 8760h)`}
      />
      <KPICard
        label="Revenue (P50)"
        value={aepCascade.revenue_meur.toFixed(1)}
        unit={"M\u20AC/yr"}
        subtitle={`@ ${aepCascade.price_eur_mwh} \u20AC/MWh`}
      />
      <KPICard
        label="Uncertainty"
        value={`\u00B1${aepCascade.combined_uncertainty_percent.toFixed(1)}`}
        unit="%"
        color={SCADA_COLORS.ALARM_MEDIUM}
        subtitle="RSS combined (IEC 61400-15)"
      />
    </div>
  );
}
