/**
 * Wind rose — stacked by speed class, with the energy rose as an outline.
 *
 * Meteorological convention: N at the top, clockwise, direction the wind
 * blows FROM. Bar length = share of all hours from that sector, split into
 * speed classes (sequential ramp, darker = faster). The outline is the share
 * of wind ENERGY (∝ v³) per sector: where it pokes out beyond the bars, that
 * sector brings stronger winds than its frequency suggests.
 */

import Plot from "react-plotly.js";

import { windRoseEducation } from "../../constants/education/p1";
import { CHART_HEIGHT, DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useChartPalette } from "../../hooks/useChartPalette";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useWindResourceStore } from "../../store/windResourceStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { EducationButton } from "../ui/EducationButton";

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export default function WindRoseChart() {
  const { windRose } = useWindResourceStore();
  const c = useChartPalette();
  const narrow = useMediaQuery("(max-width: 640px)");
  if (!windRose) return null;

  const theta = windRose.sector_centres_deg;
  const width = 360 / windRose.num_sectors - 2;
  // Older APIs (before the speed-class table) → one class holding the plain frequencies
  const hasClasses = (windRose.speed_bin_edges_ms?.length ?? 0) > 0 && !!windRose.sector_speed_frequencies;
  const edges = hasClasses ? windRose.speed_bin_edges_ms : [0];
  const table = hasClasses ? windRose.sector_speed_frequencies : windRose.frequencies.map((f) => [f]);
  const classLabel = (i: number) =>
    !hasClasses ? "All speeds" : i === edges.length - 1 ? `≥ ${edges[i]} m/s` : `${edges[i]}–${edges[i + 1]} m/s`;
  const energy = [...windRose.energy_fractions, windRose.energy_fractions[0]].map((e) => e * 100);
  const dominant = COMPASS[Math.round(windRose.dominant_direction_deg / 45) % 8];

  return (
    <ChartWrapper
      title="Wind rose — direction × speed, with energy share"
      headerRight={<EducationButton content={windRoseEducation} />}
      footer={`Prevailing from ${windRose.dominant_direction_deg.toFixed(0)}° (${dominant}) · circular σ ${windRose.circular_std_deg.toFixed(0)}° · ${windRose.num_sectors} sectors · direction = where the wind comes FROM`}
    >
      <Plot
        data={[
          ...edges.map((_, k) => ({
            type: "barpolar" as const,
            r: table.map((row) => row[k] * 100),
            theta,
            width,
            name: classLabel(k),
            marker: { color: c.seq[k] ?? c.seq[c.seq.length - 1], line: { width: 0 } },
            hovertemplate: `%{theta:.0f}° · ${classLabel(k)}: %{r:.2f} % of hours<extra></extra>`,
          })),
          {
            type: "scatterpolar" as const,
            mode: "lines" as const,
            r: energy,
            theta: [...theta, theta[0]],
            name: "Energy share (∝ v³)",
            line: { color: c.orange, width: 2.5 },
            hovertemplate: "%{theta:.0f}°: %{r:.1f} % of energy<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          showlegend: true,
          // Side legend on wide screens; below the rose on phones so the rose keeps its size
          legend: narrow
            ? { ...DARK_PLOTLY_LAYOUT.legend, orientation: "h", x: 0, y: -0.08, yanchor: "top", font: { size: 10 } }
            : { ...DARK_PLOTLY_LAYOUT.legend, x: 1.02, y: 0.5, yanchor: "middle", font: { size: 11 }, title: { text: "Speed class", font: { size: 11 } } },
          barmode: "stack",
          polar: {
            bgcolor: "rgba(0,0,0,0)",
            radialaxis: { ticksuffix: " %", angle: 90, tickangle: 90, tickfont: { size: 10 }, gridcolor: "rgba(127,127,127,0.25)", linecolor: "rgba(127,127,127,0.3)" },
            angularaxis: {
              direction: "clockwise",
              rotation: 90,
              tickmode: "array",
              tickvals: [0, 45, 90, 135, 180, 225, 270, 315],
              ticktext: COMPASS,
              tickfont: { size: 12 },
              gridcolor: "rgba(127,127,127,0.25)",
              linecolor: "rgba(127,127,127,0.4)",
            },
          },
          margin: { t: 24, r: 24, b: narrow ? 90 : 24, l: 24 },
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: CHART_HEIGHT }}
      />
    </ChartWrapper>
  );
}
