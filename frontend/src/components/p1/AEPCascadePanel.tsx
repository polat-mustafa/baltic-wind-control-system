/**
 * AEP cascade & exceedance.
 *
 * Left — waterfall: gross → each multiplicative loss → net P50. The y-axis is
 * deliberately truncated (labelled) so 1–7 % losses are visible; each step is
 * labelled in GWh and %.
 * Right — exceedance curve: probability that the long-term AEP is at least x,
 * PoE(x) = 1 − Φ((x − P50)/σ), σ = RSS uncertainty × P50. P50/P75/P90/P99
 * are points on this one curve, not separate quantities; P90 is the value
 * lenders size debt on (Domain Rule 10).
 */

import Plot from "react-plotly.js";

import { aepCascadeEducation } from "../../constants/education/p1";
import { CHART_HEIGHT, DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { useWindResourceStore } from "../../store/windResourceStore";
import { normalCdf } from "../../utils/aepMath";
import { ChartWrapper } from "../ui/ChartWrapper";
import { EducationButton } from "../ui/EducationButton";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function AEPCascadePanel() {
  const { aepCascade: a } = useWindResourceStore();
  const c = useChartPalette();
  if (!a) return null;

  // ── Waterfall (sequential, multiplicative) ──
  const steps = a.loss_factors.reduce<{ name: string; lost: number; pct: number; after: number }[]>((acc, lf) => {
    const before = acc.length ? acc[acc.length - 1].after : a.gross_aep_gwh;
    const lost = (before * lf.loss_percent) / 100;
    return [...acc, { name: cap(lf.name), lost, pct: lf.loss_percent, after: before - lost }];
  }, []);
  const labels = ["Gross", ...steps.map((s) => s.name), "Net (P50)"];
  const yLo = Math.floor((a.net_aep_gwh * 0.8) / 100) * 100;

  // ── Exceedance curve ──
  const sigma = (a.p50_gwh * a.combined_uncertainty_percent) / 100;
  const xs = Array.from({ length: 121 }, (_, i) => a.p50_gwh + sigma * (-3.2 + (6.4 * i) / 120));
  const poe = xs.map((x) => (1 - normalCdf((x - a.p50_gwh) / sigma)) * 100);
  const meur = (gwh: number) => (gwh * a.price_eur_mwh) / 1000;
  const marks = [
    { k: "P50", v: a.p50_gwh, p: 50 },
    { k: "P75", v: a.p75_gwh, p: 75 },
    { k: "P90", v: a.p90_gwh, p: 90 },
    { k: "P99", v: a.p99_gwh, p: 99 },
  ];

  return (
    <ChartWrapper
      title="AEP — loss cascade and exceedance probability"
      headerRight={<EducationButton content={aepCascadeEducation} />}
      footer={`Total loss ${a.total_loss_percent.toFixed(1)} % (losses multiply, they don't add) · combined uncertainty ±${a.combined_uncertainty_percent.toFixed(1)} % (RSS, 1σ) · price ${a.price_eur_mwh} €/MWh`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Plot
          data={[
            {
              type: "waterfall",
              orientation: "v",
              x: labels,
              y: [a.gross_aep_gwh, ...steps.map((s) => -s.lost), a.net_aep_gwh],
              measure: ["absolute", ...steps.map(() => "relative"), "total"],
              base: 0,
              text: [
                a.gross_aep_gwh.toFixed(0),
                ...steps.map((s) => `−${s.lost.toFixed(0)}<br>(${s.pct.toFixed(1)} %)`),
                a.net_aep_gwh.toFixed(0),
              ],
              textposition: "outside",
              cliponaxis: false,
              connector: { line: { color: c.ref, width: 1, dash: "dot" } },
              decreasing: { marker: { color: c.red } },
              increasing: { marker: { color: c.aqua } },
              totals: { marker: { color: c.blue } },
              hovertemplate: "%{x}: %{y:.1f} GWh<extra></extra>",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
          ]}
          layout={{
            ...DARK_PLOTLY_LAYOUT,
            transition: CHART_TRANSITION,
            title: { text: "Gross → net (P50)", font: { size: 13 }, x: 0.02, xanchor: "left" as const },
            showlegend: false,
            xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, tickfont: { size: 11 }, tickangle: 0, automargin: true },
            yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "AEP [GWh/yr]", font: { size: 12 } }, range: [yLo, a.gross_aep_gwh * 1.07] },
            annotations: [
              { xref: "paper", yref: "paper", x: 1, y: 1.01, xanchor: "right", yanchor: "bottom", text: `y-axis starts at ${yLo} GWh`, showarrow: false, font: { size: 10 } } as const,
            ],
            margin: { t: 40, r: 12, b: 64, l: 64 },
          }}
          config={PLOTLY_CONFIG}
          useResizeHandler
          className="w-full"
          style={{ height: CHART_HEIGHT }}
        />

        <Plot
          data={[
            {
              type: "scatter",
              mode: "lines",
              x: xs,
              y: poe,
              line: { color: c.blue, width: 2.5 },
              fill: "tozeroy",
              fillcolor: "rgba(127,127,127,0.06)",
              hovertemplate: "AEP ≥ %{x:.0f} GWh with %{y:.0f} % probability<extra></extra>",
            },
            {
              type: "scatter",
              mode: "text+markers",
              x: marks.map((m) => m.v),
              y: marks.map((m) => m.p),
              text: marks.map((m) => `<b>${m.k}</b> ${m.v.toFixed(0)} GWh · ${meur(m.v).toFixed(1)} M€`),
              textposition: "middle right",
              textfont: { size: 11, color: c.ink },
              marker: {
                size: marks.map((m) => (m.k === "P90" ? 13 : 9)),
                color: marks.map((m) => (m.k === "P90" ? c.orange : c.blue)),
                line: { width: 2, color: "rgba(255,255,255,0.8)" },
              },
              hovertemplate: "%{text}<extra></extra>",
            },
          ]}
          layout={{
            ...DARK_PLOTLY_LAYOUT,
            transition: CHART_TRANSITION,
            title: { text: "Probability the year-average AEP is exceeded", font: { size: 13 }, x: 0.02, xanchor: "left" as const },
            showlegend: false,
            xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Long-term net AEP [GWh/yr]", font: { size: 12 } } },
            yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "Probability of exceedance [%]", font: { size: 12 } }, range: [0, 104], dtick: 25 },
            shapes: [
              { type: "line", xref: "x", yref: "y", x0: a.p90_gwh, x1: a.p90_gwh, y0: 0, y1: 90, line: { color: c.orange, width: 1.5, dash: "dot" } } as const,
            ],
            annotations: [
              { x: a.p90_gwh, y: 4, xref: "x", yref: "y", xanchor: "right", text: "debt sizing →", showarrow: false, font: { size: 10 } } as const,
            ],
            margin: { t: 40, r: 16, b: 52, l: 64 },
          }}
          config={PLOTLY_CONFIG}
          useResizeHandler
          className="w-full"
          style={{ height: CHART_HEIGHT }}
        />
      </div>
    </ChartWrapper>
  );
}
