/**
 * SHAP feature importance panel — horizontal bar chart.
 *
 * Shows top-K features by mean |SHAP| value from XGBoost model.
 * Bars sorted descending, colored by importance magnitude.
 */

import Plot from "react-plotly.js";
import { useForecastStore } from "../../store/forecastStore";
import {
  DARK_PLOTLY_LAYOUT,
  PLOTLY_CONFIG,
} from "../../constants/plotlyDefaults";

export default function SHAPPanel() {
  const { shapResult } = useForecastStore();

  if (!shapResult) return null;

  // Sort by importance descending (already sorted from backend, but ensure)
  const sorted = [...shapResult.feature_importance].sort(
    (a, b) => b.importance - a.importance,
  );

  // Reverse for horizontal bar (Plotly renders bottom-to-top)
  const reversed = [...sorted].reverse();
  const names = reversed.map((f) => f.name);
  const values = reversed.map((f) => f.importance);

  // Color gradient: higher importance = more saturated orange
  const maxVal = Math.max(...values, 1e-9);
  const colors = values.map((v) => {
    const ratio = v / maxVal;
    return `rgba(255, 149, 0, ${0.3 + 0.7 * ratio})`;
  });

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-sm font-semibold text-slate-200 mb-2">
        SHAP Feature Importance — XGBoost
      </h3>
      <Plot
        data={[
          {
            type: "bar",
            orientation: "h",
            x: values,
            y: names,
            marker: { color: colors },
            text: values.map((v) => v.toFixed(4)),
            textposition: "outside",
            textfont: { size: 9, color: "rgb(148, 163, 184)" },
            hovertemplate:
              "%{y}<br>Mean |SHAP|: %{x:.4f}<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: 320,
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            title: "Mean |SHAP| Value",
          },
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            tickfont: { size: 10, color: "rgb(148, 163, 184)" },
          },
          margin: { t: 30, r: 60, b: 50, l: 120 },
        }}
        config={PLOTLY_CONFIG}
        className="w-full"
      />
    </div>
  );
}
