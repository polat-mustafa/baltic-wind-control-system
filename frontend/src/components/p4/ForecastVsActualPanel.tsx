/**
 * Forecast vs Actual panel — P10/P50/P90 time-series with confidence bands.
 *
 * X-axis: forecast horizon (timestamps from ensemble prediction)
 * Y-axis: power output [MW]
 * P50 as solid line, P10-P90 shaded band, wind speed on secondary axis.
 */

import Plot from "react-plotly.js";
import { useForecastStore } from "../../store/forecastStore";
import {
  DARK_PLOTLY_LAYOUT,
  PLOTLY_CONFIG,
  CHART_HEIGHT,
} from "../../constants/plotlyDefaults";
import { InfoButton } from "../ui/InfoButton";
import { forecastVsActualInfo } from "../../constants/panelInfo";

/** Model color palette per plan spec */
const ENSEMBLE_COLOR = "#CC66FF";
const BAND_FILL = "rgba(0, 170, 255, 0.15)";
const WIND_COLOR = "#FFAA00";

export default function ForecastVsActualPanel() {
  const { ensembleForecast } = useForecastStore();

  if (!ensembleForecast) return null;

  // Create hour labels from timestamps
  const hours = ensembleForecast.timestamps_utc.map((_ts, i) => {
    const hoursFromStart = (i * 10) / 60;
    return `+${hoursFromStart.toFixed(1)}h`;
  });

  // Downsample for performance if > 500 points
  const step = Math.max(1, Math.floor(hours.length / 500));
  const idx = Array.from(
    { length: Math.ceil(hours.length / step) },
    (_, i) => i * step,
  );
  const xLabels = idx.map((i) => hours[i]);
  const p10 = idx.map((i) => ensembleForecast.power_p10_mw[i]);
  const p50 = idx.map((i) => ensembleForecast.power_p50_mw[i]);
  const p90 = idx.map((i) => ensembleForecast.power_p90_mw[i]);
  const wind = idx.map((i) => ensembleForecast.wind_speed_ms[i]);

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold text-text-primary">
          Ensemble Forecast — P10 / P50 / P90
        </h3>
        <InfoButton info={forecastVsActualInfo} />
      </div>
      <div className="w-full" style={{ height: CHART_HEIGHT }}>
      <Plot
        data={[
          // P90 upper bound (invisible line for fill)
          {
            type: "scatter",
            x: xLabels,
            y: p90,
            mode: "lines",
            line: { width: 0 },
            showlegend: false,
            hoverinfo: "skip",
          },
          // P10 lower bound (fill to P90)
          {
            type: "scatter",
            x: xLabels,
            y: p10,
            mode: "lines",
            line: { width: 0 },
            fill: "tonexty",
            fillcolor: BAND_FILL,
            name: "P10-P90 band",
            hoverinfo: "skip",
          },
          // P50 median forecast
          {
            type: "scatter",
            x: xLabels,
            y: p50,
            mode: "lines",
            name: "P50 (median)",
            line: { color: ENSEMBLE_COLOR, width: 2 },
            hovertemplate: "%{x}<br>P50: %{y:.2f} MW<extra></extra>",
          },
          // Wind speed on secondary axis
          {
            type: "scatter",
            x: xLabels,
            y: wind,
            mode: "lines",
            name: "Wind speed",
            line: { color: WIND_COLOR, width: 1, dash: "dot" },
            yaxis: "y2",
            hovertemplate: "%{x}<br>Wind: %{y:.1f} m/s<extra></extra>",
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
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            title: "Power [MW]",
          },
          yaxis2: {
            title: { text: "Wind [m/s]", font: { color: WIND_COLOR, size: 11 } },
            overlaying: "y",
            side: "right",
            gridcolor: "rgba(148, 163, 184, 0.08)",
            tickfont: { color: WIND_COLOR, size: 10 },
          },
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            title: "Forecast Horizon",
            nticks: 12,
          },
        }}
        config={PLOTLY_CONFIG}
        className="w-full h-full"
      />
      </div>
    </div>
  );
}
