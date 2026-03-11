/**
 * Revenue impact panel — dual-axis chart with power + cumulative revenue.
 *
 * Left axis: P50 power forecast [MW] per turbine
 * Right axis: cumulative revenue [EUR] for full 34-turbine farm
 * Spot price is synthetic (base ± 30% day/night amplitude).
 * Clearly labeled as educational/synthetic.
 */

import Plot from "react-plotly.js";
import { useForecastStore } from "../../store/forecastStore";
import {
  DARK_PLOTLY_LAYOUT,
  PLOTLY_CONFIG,
  CHART_HEIGHT,
} from "../../constants/plotlyDefaults";
import { InfoButton } from "../ui/InfoButton";
import { revenueImpactInfo } from "../../constants/panelInfo";

const POWER_COLOR = "#CC66FF";
const REVENUE_COLOR = "#00CC66";
const SPOT_COLOR = "#FFAA00";

export default function RevenueImpactPanel() {
  const { ensembleForecast, spotPriceEurMwh } = useForecastStore();

  if (!ensembleForecast) return null;

  const numSteps = ensembleForecast.num_steps;
  const dtHours = 10 / 60; // 10-minute intervals
  const numTurbines = 34;

  // Create hour labels
  const xLabels = Array.from({ length: numSteps }, (_, i) => {
    const h = (i * 10) / 60;
    return `+${h.toFixed(1)}h`;
  });

  // Synthetic spot price: base ± 30% with day/night pattern
  const spotPrices = Array.from({ length: numSteps }, (_, i) => {
    const hourOfDay = (i * 10 / 60) % 24;
    const amplitude = spotPriceEurMwh * 0.3;
    // Peak at 12:00, trough at 00:00 (cosine)
    return spotPriceEurMwh + amplitude * Math.cos(((hourOfDay - 12) / 12) * Math.PI);
  });

  // Cumulative revenue: Σ(P50 × spot × dt × numTurbines)
  const cumRevenue: number[] = [];
  let total = 0;
  for (let i = 0; i < numSteps; i++) {
    total +=
      ensembleForecast.power_p50_mw[i] * spotPrices[i] * dtHours * numTurbines;
    cumRevenue.push(total);
  }

  // Downsample for performance
  const step = Math.max(1, Math.floor(numSteps / 500));
  const idx = Array.from(
    { length: Math.ceil(numSteps / step) },
    (_, i) => i * step,
  );
  const xSampled = idx.map((i) => xLabels[i]);
  const p50Sampled = idx.map((i) => ensembleForecast.power_p50_mw[i]);
  const revSampled = idx.map((i) => cumRevenue[i]);
  const spotSampled = idx.map((i) => spotPrices[i]);

  // Format final revenue
  const finalRevenue = cumRevenue[cumRevenue.length - 1] ?? 0;
  const revLabel =
    finalRevenue >= 1_000_000
      ? `${(finalRevenue / 1_000_000).toFixed(2)}M EUR`
      : `${(finalRevenue / 1_000).toFixed(0)}k EUR`;

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold text-text-primary">
          Revenue Impact — 34 Turbines
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">
            Total: {revLabel} (synthetic spot price)
          </span>
          <InfoButton info={revenueImpactInfo} />
        </div>
      </div>
      <div className="w-full" style={{ height: CHART_HEIGHT }}>
      <Plot
        data={[
          // P50 power
          {
            type: "scatter",
            x: xSampled,
            y: p50Sampled,
            mode: "lines",
            name: "P50 Power (per WTG)",
            line: { color: POWER_COLOR, width: 1.5 },
            hovertemplate: "%{x}<br>P50: %{y:.2f} MW<extra></extra>",
          },
          // Spot price on secondary
          {
            type: "scatter",
            x: xSampled,
            y: spotSampled,
            mode: "lines",
            name: "Spot Price",
            line: { color: SPOT_COLOR, width: 1, dash: "dot" },
            yaxis: "y2",
            hovertemplate:
              "%{x}<br>Spot: %{y:.1f} EUR/MWh<extra></extra>",
          },
          // Cumulative revenue on tertiary
          {
            type: "scatter",
            x: xSampled,
            y: revSampled,
            mode: "lines",
            name: "Cumulative Revenue",
            line: { color: REVENUE_COLOR, width: 2 },
            yaxis: "y3",
            fill: "tozeroy",
            fillcolor: "rgba(0, 204, 102, 0.08)",
            hovertemplate:
              "%{x}<br>Revenue: %{y:,.0f} EUR<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          autosize: true,
          legend: {
            x: 0,
            y: 1.18,
            orientation: "h",
            font: { size: 10, color: "rgb(148, 163, 184)" },
          },
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            title: "Forecast Horizon",
            nticks: 12,
            domain: [0, 0.85],
          },
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            title: "Power [MW]",
          },
          yaxis2: {
            title: { text: "EUR/MWh", font: { color: SPOT_COLOR, size: 10 } },
            overlaying: "y",
            side: "right",
            position: 0.88,
            gridcolor: "rgba(148, 163, 184, 0.05)",
            tickfont: { color: SPOT_COLOR, size: 11 },
          },
          yaxis3: {
            title: { text: "Revenue [EUR]", font: { color: REVENUE_COLOR, size: 10 } },
            overlaying: "y",
            side: "right",
            position: 0.95,
            gridcolor: "rgba(148, 163, 184, 0.05)",
            tickfont: { color: REVENUE_COLOR, size: 11 },
          },
          margin: { t: 40, r: 80, b: 50, l: 60 },
        }}
        config={PLOTLY_CONFIG}
        className="w-full h-full"
      />
      </div>
    </div>
  );
}
