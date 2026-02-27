/**
 * Wind rose chart — Plotly scatterpolar showing frequency + energy rose.
 *
 * Meteorological convention: N = top, directions are "from".
 * Two traces: frequency (outer) and energy fraction (inner, filled).
 */

import Plot from "react-plotly.js";
import { useWindResourceStore } from "../../store/windResourceStore";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";

export default function WindRoseChart() {
  const { windRose } = useWindResourceStore();

  if (!windRose) return null;

  // Close the polygon by appending first value
  const theta = [...windRose.sector_centres_deg, windRose.sector_centres_deg[0]];
  const freq = [...windRose.frequencies, windRose.frequencies[0]];
  const energy = [...windRose.energy_fractions, windRose.energy_fractions[0]];

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <h3 className="text-sm font-semibold text-slate-300 mb-2">
        Wind Rose — Frequency & Energy
      </h3>
      <Plot
        data={[
          {
            type: "scatterpolar",
            r: freq.map((f) => f * 100),
            theta,
            name: "Frequency (%)",
            line: { color: "rgb(59, 130, 246)", width: 2 },
            marker: { size: 4 },
          },
          {
            type: "scatterpolar",
            r: energy.map((e) => e * 100),
            theta,
            fill: "toself",
            fillcolor: "rgba(234, 179, 8, 0.2)",
            name: "Energy (%)",
            line: { color: "rgb(234, 179, 8)", width: 2 },
            marker: { size: 4 },
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          showlegend: true,
          legend: { x: 0, y: -0.15, orientation: "h", font: { size: 10 } },
          polar: {
            bgcolor: "rgb(15, 23, 42)",
            radialaxis: {
              gridcolor: "rgba(148, 163, 184, 0.15)",
              tickfont: { size: 9, color: "rgb(148, 163, 184)" },
              ticksuffix: "%",
            },
            angularaxis: {
              direction: "clockwise",
              rotation: 90,
              gridcolor: "rgba(148, 163, 184, 0.15)",
              tickfont: { size: 10, color: "rgb(203, 213, 225)" },
            },
          },
          margin: { t: 10, r: 30, b: 40, l: 30 },
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: 350 }}
      />
      <p className="text-xs text-slate-500 mt-1 text-center">
        Dominant: {windRose.dominant_direction_deg}° · Circ. σ:{" "}
        {windRose.circular_std_deg}°
      </p>
    </div>
  );
}
