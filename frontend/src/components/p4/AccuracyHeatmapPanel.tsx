/**
 * Uncertainty vs Lead Time panel — monotone growth of forecast spread.
 *
 * A single 48 h forecast does not support an hour-of-day × horizon heatmap
 * (each step maps to exactly one cell → forced diagonal, no aggregation).
 * We instead plot the direct quantity that is actually available: the
 * P90–P10 spread [MW] as a function of lead time. Forecast error grows
 * with horizon, so this curve should rise monotonically.
 *
 * X-axis: lead time [h]
 * Y-axis: P90–P10 spread [MW]
 * Trace: P90 upper / P10 lower (invisible lines) with a shaded fill between,
 *        plus the instantaneous spread as a solid line for hover details.
 */

import Plot from "react-plotly.js";
import { useForecastStore } from "../../store/forecastStore";
import {
  DARK_PLOTLY_LAYOUT,
  PLOTLY_CONFIG,
  CHART_HEIGHT,
} from "../../constants/plotlyDefaults";
import { InfoButton } from "../ui/InfoButton";
import { accuracyHeatmapInfo } from "../../constants/panelInfo";

const BAND_FILL = "rgba(0, 170, 255, 0.18)";
const SPREAD_LINE = "#00AAFF";
const SMOOTH_LINE = "#CC66FF";
const SMOOTHING_WINDOW = 6; // 1 hour at 10-min resolution

function centredMovingAverage(values: number[], window: number): number[] {
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(values.length, i + half + 1);
    let s = 0;
    for (let j = lo; j < hi; j++) s += values[j];
    return s / (hi - lo);
  });
}

export default function AccuracyHeatmapPanel() {
  const { ensembleForecast } = useForecastStore();

  if (!ensembleForecast) return null;

  const numSteps = ensembleForecast.num_steps;
  const leadHours: number[] = [];
  const spread: number[] = [];
  for (let i = 0; i < numSteps; i++) {
    leadHours.push((i * 10) / 60);
    spread.push(
      ensembleForecast.power_p90_mw[i] - ensembleForecast.power_p10_mw[i],
    );
  }
  const smoothed = centredMovingAverage(spread, SMOOTHING_WINDOW);

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold text-text-primary">
          Uncertainty vs Lead Time — P90-P10 Spread
        </h3>
        <InfoButton info={accuracyHeatmapInfo} />
      </div>
      <div className="w-full" style={{ height: CHART_HEIGHT }}>
      <Plot
        data={[
          {
            type: "scatter",
            x: leadHours,
            y: spread,
            mode: "lines",
            name: "Spread (raw)",
            line: { color: SPREAD_LINE, width: 1 },
            fill: "tozeroy",
            fillcolor: BAND_FILL,
            hovertemplate: "%{x:.1f} h<br>Spread: %{y:.2f} MW<extra></extra>",
          },
          {
            type: "scatter",
            x: leadHours,
            y: smoothed,
            mode: "lines",
            name: `Smoothed (${SMOOTHING_WINDOW * 10} min)`,
            line: { color: SMOOTH_LINE, width: 2 },
            hovertemplate:
              "%{x:.1f} h<br>Smoothed: %{y:.2f} MW<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          autosize: true,
          legend: {
            x: 0,
            y: 1.15,
            orientation: "h",
            font: { size: 10, color: "rgb(148, 163, 184)" },
          },
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            title: "Lead Time [h]",
            nticks: 12,
          },
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            title: "P90-P10 Spread [MW]",
            rangemode: "tozero",
          },
        }}
        config={PLOTLY_CONFIG}
        className="w-full h-full"
      />
      </div>
    </div>
  );
}
