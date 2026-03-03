/**
 * AEP cascade panel — waterfall loss cascade + P50/P75/P90/P99 bars.
 *
 * Left: Waterfall chart showing multiplicative loss cascade
 *       (Gross → wake → blockage → electrical → availability → env → Net).
 * Right: Exceedance probability bars with revenue labels.
 *
 * Domain Rule 10: P90 labeled "Used for financing".
 */

import Plot from "react-plotly.js";
import { useWindResourceStore } from "../../store/windResourceStore";
import { CHART_HEIGHT, DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { SCADA_COLORS } from "../../constants/scadaColors";
import { InfoButton } from "../ui/InfoButton";
import { aepCascadeInfo } from "../../constants/panelInfo";
import { ChartWrapper } from "../ui/ChartWrapper";

export default function AEPCascadePanel() {
  const { aepCascade } = useWindResourceStore();

  if (!aepCascade) return null;

  // Build waterfall data
  const waterfallLabels = [
    "Gross AEP",
    ...aepCascade.loss_factors.map((lf) => lf.name),
    "Net AEP",
  ];

  // Waterfall measures: first is "absolute", losses are "relative", last is "total"
  const measures = [
    "absolute",
    ...aepCascade.loss_factors.map(() => "relative"),
    "total",
  ];

  // Compute loss amounts in GWh (sequential from gross)
  const lossAmounts = aepCascade.loss_factors.reduce<number[]>((acc, lf) => {
    const prev = acc.length === 0
      ? aepCascade.gross_aep_gwh
      : aepCascade.gross_aep_gwh + acc.reduce((s, v) => s + v, 0);
    const amount = prev * (lf.loss_percent / 100.0);
    return [...acc, -amount];
  }, []);

  const waterfallValues = [
    aepCascade.gross_aep_gwh,
    ...lossAmounts,
    aepCascade.net_aep_gwh,
  ];

  // P-value bars
  const pLabels = ["P50", "P75", "P90", "P99"];
  const pValues = [
    aepCascade.p50_gwh,
    aepCascade.p75_gwh,
    aepCascade.p90_gwh,
    aepCascade.p99_gwh,
  ];
  const pColors = [
    "rgb(59, 130, 246)", // blue
    "rgb(34, 197, 94)", // green
    "rgb(234, 179, 8)", // amber
    "rgb(239, 68, 68)", // red
  ];

  return (
    <ChartWrapper
      title="AEP Loss Cascade & Exceedance (P-values)"
      headerRight={<InfoButton info={aepCascadeInfo} />}
      footer={`Total loss: ${aepCascade.total_loss_percent.toFixed(1)}% · Uncertainty: ±${aepCascade.combined_uncertainty_percent.toFixed(1)}% (RSS, IEC 61400-15)`}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Waterfall */}
        <Plot
          data={[
            {
              type: "waterfall" as const,
              orientation: "v",
              x: waterfallLabels,
              y: waterfallValues,
              measure: measures,
              connector: { line: { color: "rgba(148, 163, 184, 0.3)" } },
              increasing: { marker: { color: SCADA_COLORS.ENERGIZED } },
              decreasing: { marker: { color: "rgb(239, 68, 68)" } },
              totals: { marker: { color: "rgb(59, 130, 246)" } },
              texttemplate: "%{y:.1f}",
              textposition: "outside",
              textfont: { size: 9 },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
          ]}
          layout={{
            ...DARK_PLOTLY_LAYOUT,
            title: {
              text: "Gross → Net Cascade",
              font: { size: 12, color: "rgb(148, 163, 184)" },
              x: 0.5,
            },
            yaxis: {
              ...DARK_PLOTLY_LAYOUT.yaxis,
              title: { text: "AEP [GWh/yr]", font: { size: 11 } },
            },
            xaxis: {
              ...DARK_PLOTLY_LAYOUT.xaxis,
              tickangle: -30,
              tickfont: { size: 9 },
            },
            margin: { t: 40, r: 20, b: 80, l: 60 },
          }}
          config={PLOTLY_CONFIG}
          useResizeHandler
          className="w-full"
          style={{ height: CHART_HEIGHT }}
        />

        {/* P-values */}
        <Plot
          data={[
            {
              type: "bar",
              x: pLabels,
              y: pValues,
              marker: { color: pColors },
              text: pValues.map(
                (v) =>
                  `${v.toFixed(1)} GWh<br>${(v * 1000 * aepCascade.price_eur_mwh / 1e6).toFixed(1)} M\u20AC`,
              ),
              textposition: "outside",
              textfont: { size: 10 },
              hovertemplate: "%{x}: %{y:.1f} GWh<extra></extra>",
            },
          ]}
          layout={{
            ...DARK_PLOTLY_LAYOUT,
            title: {
              text: "Exceedance Probabilities",
              font: { size: 12, color: "rgb(148, 163, 184)" },
              x: 0.5,
            },
            yaxis: {
              ...DARK_PLOTLY_LAYOUT.yaxis,
              title: { text: "AEP [GWh/yr]", font: { size: 11 } },
              range: [0, aepCascade.p50_gwh * 1.15],
            },
            xaxis: {
              ...DARK_PLOTLY_LAYOUT.xaxis,
            },
            annotations: [
              {
                x: "P90",
                y: aepCascade.p90_gwh,
                text: "Used for financing",
                showarrow: true,
                arrowhead: 2,
                arrowcolor: "rgb(234, 179, 8)",
                font: { size: 9, color: "rgb(234, 179, 8)" },
                ax: 60,
                ay: -30,
              },
            ],
            margin: { t: 40, r: 20, b: 50, l: 60 },
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
