/**
 * KPI summary cards — top-level forecasting metrics.
 *
 * Displays: Best RMSE, Best MAE, Skill Score, Grid Alerts, Est. Revenue.
 * Color-coded per ISA-101: green = normal, amber = warning, red = fault.
 */

import { useForecastStore } from "../../store/forecastStore";
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
      <p
        className="text-2xl font-bold mt-1"
        style={color ? { color } : undefined}
      >
        {value}
        <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>
      </p>
      {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}

export default function ForecastKPIHeader() {
  const {
    modelComparison,
    rampDetection,
    ensembleForecast,
    spotPriceEurMwh,
  } = useForecastStore();

  if (!modelComparison || !rampDetection || !ensembleForecast) return null;

  // Find best RMSE model
  const bestRmseModel = modelComparison.model_metrics.find(
    (m) => m.model_name === modelComparison.best_rmse,
  );
  const bestSkillModel = modelComparison.model_metrics.find(
    (m) => m.model_name === modelComparison.best_skill,
  );

  const rmseVal = bestRmseModel?.rmse_mw ?? 0;
  const maeVal = bestRmseModel?.mae_mw ?? 0;
  const skillVal = bestSkillModel?.skill_score ?? 0;
  const alertCount = rampDetection.grid_alerts.length;

  // RMSE color: green <1.2 MW, amber <1.8, red ≥1.8
  const rmseColor =
    rmseVal < 1.2
      ? SCADA_COLORS.ENERGIZED
      : rmseVal < 1.8
        ? SCADA_COLORS.WARNING
        : SCADA_COLORS.FAULT;

  // MAE color: green <0.75, amber <1.0, red otherwise
  const maeColor =
    maeVal < 0.75
      ? SCADA_COLORS.ENERGIZED
      : maeVal < 1.0
        ? SCADA_COLORS.WARNING
        : SCADA_COLORS.FAULT;

  // Skill score color: green >0.3, amber >0.1, red otherwise
  const skillColor =
    skillVal > 0.3
      ? SCADA_COLORS.ENERGIZED
      : skillVal > 0.1
        ? SCADA_COLORS.WARNING
        : SCADA_COLORS.FAULT;

  // Alert color: green 0, amber 1-2, red ≥3
  const alertColor =
    alertCount === 0
      ? SCADA_COLORS.ENERGIZED
      : alertCount <= 2
        ? SCADA_COLORS.WARNING
        : SCADA_COLORS.FAULT;

  // Revenue estimate: Σ(P50 × spotPrice × Δt × numTurbines)
  // 10-min intervals = 10/60 hours per step, 34 turbines
  const totalRevenue = ensembleForecast.power_p50_mw.reduce(
    (sum, p) => sum + p * spotPriceEurMwh * (10 / 60) * 34,
    0,
  );
  const revenueStr =
    totalRevenue >= 1_000_000
      ? `${(totalRevenue / 1_000_000).toFixed(1)}M`
      : `${(totalRevenue / 1_000).toFixed(0)}k`;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <KPICard
        label="Best RMSE"
        value={rmseVal.toFixed(2)}
        unit="MW"
        color={rmseColor}
        subtitle={`Model: ${modelComparison.best_rmse}`}
      />
      <KPICard
        label="Best MAE"
        value={maeVal.toFixed(2)}
        unit="MW"
        color={maeColor}
        subtitle={`Model: ${modelComparison.best_rmse}`}
      />
      <KPICard
        label="Skill Score"
        value={skillVal.toFixed(3)}
        unit=""
        color={skillColor}
        subtitle={`Model: ${modelComparison.best_skill} (vs persistence)`}
      />
      <KPICard
        label="Grid Alerts"
        value={String(alertCount)}
        unit=""
        color={alertColor}
        subtitle={`${rampDetection.num_ramp_up}↑ ${rampDetection.num_ramp_down}↓ ramps detected`}
      />
      <KPICard
        label="Est. Revenue"
        value={revenueStr}
        unit="EUR"
        color="#60A5FA"
        subtitle={`@ ${spotPriceEurMwh} EUR/MWh (synthetic)`}
      />
    </div>
  );
}
