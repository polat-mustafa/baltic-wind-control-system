/**
 * Accuracy heatmap panel — hour-of-day vs forecast horizon bin.
 *
 * Shows P90-P10 spread (uncertainty width) as a proxy for forecast
 * difficulty. Higher spread = more uncertain = harder to forecast.
 *
 * X-axis: forecast horizon bins (0-6h, 6-12h, 12-18h, 18-24h, etc.)
 * Y-axis: hour of day (0-23)
 * Color: P90-P10 spread [MW]
 */

import Plot from "react-plotly.js";
import { useForecastStore } from "../../store/forecastStore";
import {
  DARK_PLOTLY_LAYOUT,
  PLOTLY_CONFIG,
} from "../../constants/plotlyDefaults";

export default function AccuracyHeatmapPanel() {
  const { ensembleForecast, horizonSteps } = useForecastStore();

  if (!ensembleForecast) return null;

  const numSteps = ensembleForecast.num_steps;

  // Define horizon bins (6-hour blocks)
  const totalHours = (horizonSteps * 10) / 60;
  const binSizeHours = 6;
  const numBins = Math.ceil(totalHours / binSizeHours);
  const binLabels = Array.from(
    { length: numBins },
    (_, i) => `${i * binSizeHours}-${Math.min((i + 1) * binSizeHours, totalHours)}h`,
  );

  // Build 24 × numBins grid of average P90-P10 spread
  const stepsPerHour = 6; // 10-min intervals
  const grid: number[][] = Array.from({ length: 24 }, () =>
    Array(numBins).fill(0),
  );
  const counts: number[][] = Array.from({ length: 24 }, () =>
    Array(numBins).fill(0),
  );

  for (let i = 0; i < numSteps; i++) {
    const hourOfDay = Math.floor((i % (24 * stepsPerHour)) / stepsPerHour);
    const horizonHour = (i * 10) / 60;
    const binIdx = Math.min(
      Math.floor(horizonHour / binSizeHours),
      numBins - 1,
    );

    const spread =
      ensembleForecast.power_p90_mw[i] - ensembleForecast.power_p10_mw[i];
    grid[hourOfDay][binIdx] += spread;
    counts[hourOfDay][binIdx] += 1;
  }

  // Average the spreads
  for (let h = 0; h < 24; h++) {
    for (let b = 0; b < numBins; b++) {
      grid[h][b] = counts[h][b] > 0 ? grid[h][b] / counts[h][b] : 0;
    }
  }

  const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-sm font-semibold text-slate-200 mb-2">
        Forecast Uncertainty — P90-P10 Spread
      </h3>
      <Plot
        data={[
          {
            type: "heatmap",
            z: grid,
            x: binLabels,
            y: hourLabels,
            colorscale: [
              [0, "rgb(15, 23, 42)"],
              [0.25, "rgb(30, 64, 115)"],
              [0.5, "rgb(0, 170, 255)"],
              [0.75, "rgb(255, 170, 0)"],
              [1, "rgb(255, 0, 0)"],
            ],
            colorbar: {
              title: { text: "Spread [MW]", font: { size: 10, color: "rgb(148, 163, 184)" } },
              tickfont: { size: 9, color: "rgb(148, 163, 184)" },
            },
            hovertemplate:
              "Hour: %{y}<br>Horizon: %{x}<br>Spread: %{z:.2f} MW<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: 320,
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            title: "Forecast Horizon",
          },
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            title: "Hour of Day",
            dtick: 3,
          },
        }}
        config={PLOTLY_CONFIG}
        className="w-full"
      />
    </div>
  );
}
