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
  CHART_HEIGHT,
} from "../../constants/plotlyDefaults";
import { InfoButton } from "../ui/InfoButton";
import { shapInfo } from "../../constants/panelInfo";

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
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold text-text-primary">
          SHAP Feature Importance — XGBoost
        </h3>
        <InfoButton info={shapInfo} />
      </div>
      <div className="w-full" style={{ height: CHART_HEIGHT }}>
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
            textfont: { size: 11, color: "rgb(148, 163, 184)" },
            hovertemplate:
              "%{y}<br>Mean |SHAP|: %{x:.4f}<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          autosize: true,
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
        className="w-full h-full"
      />
      </div>
    </div>
  );
}
