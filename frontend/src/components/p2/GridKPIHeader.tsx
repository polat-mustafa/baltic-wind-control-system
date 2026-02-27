/**
 * KPI summary cards — top-level HV grid metrics.
 *
 * Displays: Voltage Range, Total Losses, Max Ik'', STATCOM Q, FRT Status.
 * Color-coded per ISA-101: green = normal, amber = warning, red = fault.
 */

import { useGridStore } from "../../store/gridStore";
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

export default function GridKPIHeader() {
  const { loadFlowResults, shortCircuit, statcomSizing, frtResult } =
    useGridStore();

  if (!loadFlowResults || !shortCircuit) return null;

  // Find full-load scenario for primary KPIs
  const fullLoad = loadFlowResults.find((r) => r.scenario === "full_load");
  if (!fullLoad) return null;

  // Voltage compliance color
  const allCompliant = loadFlowResults.every((r) => r.voltage_compliant);
  const voltageColor = allCompliant
    ? SCADA_COLORS.ENERGIZED
    : SCADA_COLORS.FAULT;

  // Loss color (amber if > 2% of generation)
  const lossPct = fullLoad.total_generation_mw > 0
    ? (fullLoad.total_loss_mw / fullLoad.total_generation_mw) * 100
    : 0;
  const lossColor = lossPct > 3
    ? SCADA_COLORS.FAULT
    : lossPct > 2
      ? SCADA_COLORS.WARNING
      : SCADA_COLORS.ENERGIZED;

  // Breaker color
  const breakerColor = shortCircuit.breaker_adequate
    ? SCADA_COLORS.ENERGIZED
    : SCADA_COLORS.FAULT;

  // STATCOM color
  const statcomColor = statcomSizing?.compensation_adequate
    ? SCADA_COLORS.ENERGIZED
    : SCADA_COLORS.WARNING;

  // FRT color
  const frtCompliant =
    frtResult?.stayed_connected &&
    frtResult?.reactive_current_compliant &&
    frtResult?.recovery_compliant;
  const frtColor = frtCompliant
    ? SCADA_COLORS.ENERGIZED
    : SCADA_COLORS.FAULT;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <KPICard
        label="Voltage Range"
        value={`${fullLoad.v_min_pu.toFixed(3)}–${fullLoad.v_max_pu.toFixed(3)}`}
        unit="pu"
        color={voltageColor}
        subtitle={allCompliant ? "All scenarios compliant" : "Violation detected"}
      />
      <KPICard
        label="Total Losses"
        value={fullLoad.total_loss_mw.toFixed(1)}
        unit="MW"
        color={lossColor}
        subtitle={`${lossPct.toFixed(1)}% of ${fullLoad.total_generation_mw} MW`}
      />
      <KPICard
        label={`Max Ik'' (${shortCircuit.max_ikss_bus})`}
        value={shortCircuit.max_ikss_ka.toFixed(1)}
        unit="kA"
        color={breakerColor}
        subtitle={shortCircuit.breaker_adequate ? "Breakers adequate" : "Breakers undersized"}
      />
      <KPICard
        label="STATCOM Rating"
        value={`\u00B1${statcomSizing?.statcom_rating_mvar ?? 120}`}
        unit="MVAR"
        color={statcomColor}
        subtitle={
          statcomSizing
            ? `Ferranti rise: ${(statcomSizing.ferranti_rise_pu * 100).toFixed(1)}%`
            : "Loading..."
        }
      />
      <KPICard
        label="FRT Status"
        value={frtCompliant ? "PASS" : frtResult ? "FAIL" : "---"}
        unit=""
        color={frtColor}
        subtitle={
          frtResult
            ? `Kqv=${frtResult.reactive_current_gain.toFixed(1)}, t_rec=${frtResult.recovery_time_s.toFixed(2)}s`
            : "Not yet simulated"
        }
      />
    </div>
  );
}
