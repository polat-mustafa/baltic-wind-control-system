/**
 * Model comparison panel — grouped bar chart of XGBoost vs LSTM vs TFT vs Ensemble.
 *
 * Shows RMSE, MAE, and Skill Score side-by-side for each model.
 * Color-coded by model type with a mini summary table below.
 */

import Plot from "react-plotly.js";
import { useForecastStore } from "../../store/forecastStore";
import {
  DARK_PLOTLY_LAYOUT,
  PLOTLY_CONFIG,
  CHART_HEIGHT,
} from "../../constants/plotlyDefaults";
import { InfoButton } from "../ui/InfoButton";
import { modelComparisonInfo } from "../../constants/panelInfo";

/** Per-model colors from plan spec */
const MODEL_COLORS: Record<string, string> = {
  XGBoost: "#FF9500",
  LSTM: "#00AAFF",
  TFT: "#00CC66",
  Ensemble: "#CC66FF",
  Persistence: "#94A3B8",
};

export default function ModelComparisonPanel() {
  const { modelComparison } = useForecastStore();

  if (!modelComparison) return null;

  const models = modelComparison.model_metrics;
  const names = models.map((m) => m.model_name);
  const colors = names.map((n) => MODEL_COLORS[n] ?? "#94A3B8");

  // Detect ensemble under-performance: an ensemble should never be worse
  // than its best base member. When this happens we surface a hint so
  // the user understands why (adaptive weighting has already mitigated
  // it, but a very weak base model can still leak some error through).
  const ensemble = models.find((m) => m.model_name === "Ensemble");
  const baseMembers = models.filter(
    (m) => m.model_name === "XGBoost" || m.model_name === "LSTM" || m.model_name === "TFT",
  );
  const bestBaseRmse = baseMembers.length
    ? Math.min(...baseMembers.map((m) => m.rmse_mw))
    : Number.POSITIVE_INFINITY;
  const ensembleUnderperforms = ensemble !== undefined && ensemble.rmse_mw > bestBaseRmse + 1e-6;
  const worstBase = baseMembers.reduce(
    (acc, m) => (m.rmse_mw > acc.rmse_mw ? m : acc),
    baseMembers[0] ?? { model_name: "", rmse_mw: 0 },
  );

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold text-text-primary">
          Model Comparison — Error Metrics
        </h3>
        <InfoButton info={modelComparisonInfo} />
      </div>
      <div className="w-full" style={{ height: CHART_HEIGHT }}>
      <Plot
        data={[
          {
            type: "bar",
            name: "RMSE (MW)",
            x: names,
            y: models.map((m) => m.rmse_mw),
            marker: { color: colors, opacity: 0.9 },
            hovertemplate: "%{x}<br>RMSE: %{y:.3f} MW<extra></extra>",
          },
          {
            type: "bar",
            name: "MAE (MW)",
            x: names,
            y: models.map((m) => m.mae_mw),
            marker: {
              color: colors,
              opacity: 0.6,
            },
            hovertemplate: "%{x}<br>MAE: %{y:.3f} MW<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          autosize: true,
          barmode: "group",
          legend: {
            x: 0,
            y: 1.15,
            orientation: "h",
            font: { size: 10, color: "rgb(148, 163, 184)" },
          },
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            title: "Error [MW]",
          },
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
          },
        }}
        config={PLOTLY_CONFIG}
        className="w-full h-full"
      />
      </div>

      {ensembleUnderperforms && (
        <div className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          ⚠ Ensemble RMSE ({ensemble?.rmse_mw.toFixed(3)} MW) is higher than the
          best base model. Likely cause: {worstBase.model_name} underperformed
          ({worstBase.rmse_mw.toFixed(3)} MW) and leaked residual error through
          the weighted average. Skill-gate + inverse-RMSE weighting mitigate
          but cannot always eliminate this.
        </div>
      )}

      {/* Mini summary table */}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-xs text-slate-400">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-1 px-2">Model</th>
              <th className="text-right py-1 px-2">RMSE</th>
              <th className="text-right py-1 px-2">MAE</th>
              <th className="text-right py-1 px-2">Skill</th>
              <th className="text-right py-1 px-2">R²</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr
                key={m.model_name}
                className="border-b border-slate-700/50"
              >
                <td
                  className="py-1 px-2 font-medium"
                  style={{ color: MODEL_COLORS[m.model_name] ?? "#94A3B8" }}
                >
                  {m.model_name}
                  {m.model_name === modelComparison.best_rmse ? " ★" : ""}
                </td>
                <td className="text-right py-1 px-2">
                  {m.rmse_mw.toFixed(3)}
                </td>
                <td className="text-right py-1 px-2">
                  {m.mae_mw.toFixed(3)}
                </td>
                <td className="text-right py-1 px-2">
                  {m.skill_score.toFixed(3)}
                </td>
                <td className="text-right py-1 px-2">
                  {m.r_squared.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
