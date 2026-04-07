/**
 * Wind rose chart — Plotly scatterpolar showing frequency + energy rose.
 *
 * Meteorological convention: N = top, directions are "from".
 * Two traces: frequency (outer) and energy fraction (inner, filled).
 */

import Plot from "react-plotly.js";
import { useWindResourceStore } from "../../store/windResourceStore";
import { CHART_HEIGHT, DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { EducationButton } from "../ui/EducationButton";
import { windRoseEducation } from "../../constants/education/p1";
import { ChartWrapper } from "../ui/ChartWrapper";

export default function WindRoseChart() {
  const { windRose } = useWindResourceStore();

  if (!windRose) return null;

  // Close the polygon by appending first value
  const theta = [...windRose.sector_centres_deg, windRose.sector_centres_deg[0]];
  const freq = [...windRose.frequencies, windRose.frequencies[0]];
  const energy = [...windRose.energy_fractions, windRose.energy_fractions[0]];

  return (
    <ChartWrapper
      title="Wind Rose — Frequency & Energy"
      headerRight={<EducationButton content={windRoseEducation} />}
      footer={`Dominant: ${windRose.dominant_direction_deg}° · Circ. σ: ${windRose.circular_std_deg}°`}
    >
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
              tickfont: { size: 11, color: "rgb(148, 163, 184)" },
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
        style={{ height: CHART_HEIGHT }}
      />
    </ChartWrapper>
  );
}
