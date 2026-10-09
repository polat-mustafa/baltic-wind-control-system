/**
 * Cp(λ,β) contour heatmap — the core aerodynamic characteristic.
 *
 * Loaded independently on mount via fetchCpSurface().
 * x: tip_speed_ratios (λ), y: pitch_angles_deg (β), z: cp_matrix.
 * Colorscale: Viridis. Marks optimal point (λ_opt, β=0).
 * Footer shows Cp_max and Betz limit.
 */

import Plot from "react-plotly.js";

import { ChartWrapper } from "../ui/ChartWrapper";
import {
  CHART_HEIGHT,
  DARK_PLOTLY_LAYOUT,
  PLOTLY_CONFIG,
} from "../../constants/plotlyDefaults";
import { useChartPalette } from "../../hooks/useChartPalette";
import { useTurbinePhysicsStore } from "../../store/turbinePhysicsStore";

export default function CpSurfaceChart() {
  const pal = useChartPalette();
  const cpSurface = useTurbinePhysicsStore((s) => s.cpSurface);
  if (!cpSurface) return null;

  const traces: Plotly.Data[] = [
    {
      x: cpSurface.tip_speed_ratios,
      y: cpSurface.pitch_angles_deg,
      z: cpSurface.cp_matrix,
      type: "contour",
      colorscale: pal.seq.map((c, i) => [i / (pal.seq.length - 1), c] as [number, string]),
      contours: {
        coloring: "heatmap",
        showlabels: true,
        labelfont: {
          family: "'IBM Plex Mono', monospace",
          size: 11,
          color: pal.ink,
        },
      },
      colorbar: {
        title: { text: "Cp", font: { color: pal.ink, size: 11 } },
        tickfont: {
          family: "'IBM Plex Mono', monospace",
          size: 10,
          color: pal.ref,
        },
      },
      hovertemplate:
        "λ = %{x:.1f}<br>β = %{y:.1f}°<br>Cp = %{z:.4f}<extra></extra>",
    },
    // Optimal point marker
    {
      x: [cpSurface.lambda_opt],
      y: [0],
      type: "scatter",
      mode: "markers" as const,
      marker: { color: pal.ink, size: 10, symbol: "star" },
      text: [`Cp_max = ${cpSurface.cp_max.toFixed(4)}`],
      textposition: "top center",
      textfont: {
        family: "'IBM Plex Mono', monospace",
        size: 10,
        color: pal.ink,
      },
      showlegend: false,
      hovertemplate:
        `λ_opt = ${cpSurface.lambda_opt}<br>Cp_max = ${cpSurface.cp_max.toFixed(4)}<extra>Optimal</extra>`,
    },
  ];

  const layout: Partial<Plotly.Layout> = {
    ...DARK_PLOTLY_LAYOUT,
    title: undefined,
    xaxis: {
      ...DARK_PLOTLY_LAYOUT.xaxis,
      title: "Tip-Speed Ratio λ [-]",
    },
    yaxis: {
      ...DARK_PLOTLY_LAYOUT.yaxis,
      title: "Pitch Angle β [deg]",
    },
  };

  return (
    <ChartWrapper
      title="Cp Surface — Cp(λ, β)"
      footer={`Cp_max = ${cpSurface.cp_max.toFixed(4)} at λ = ${cpSurface.lambda_opt} | Betz limit = ${cpSurface.betz_limit.toFixed(4)} (16/27)`}
    >
      <div style={{ height: CHART_HEIGHT }}>
        <Plot
          data={traces}
          layout={layout}
          config={PLOTLY_CONFIG}
          className="w-full h-full"
          useResizeHandler
        />
      </div>
    </ChartWrapper>
  );
}
