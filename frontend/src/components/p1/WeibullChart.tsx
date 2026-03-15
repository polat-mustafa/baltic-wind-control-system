/**
 * Weibull chart — histogram of wind speeds with fitted PDF overlay.
 *
 * Shows cut-in, rated, and cut-out speed markers as vertical lines.
 * PDF overlay demonstrates the Weibull fit quality.
 */

import Plot from "react-plotly.js";
import { useWindResourceStore } from "../../store/windResourceStore";
import { CHART_HEIGHT, DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { SCADA_COLORS } from "../../constants/scadaColors";
import { InfoButton } from "../ui/InfoButton";
import { weibullInfo } from "../../constants/panelInfo";
import { ChartWrapper } from "../ui/ChartWrapper";

export default function WeibullChart() {
  const { weibullFit, turbineSpec } = useWindResourceStore();

  if (!weibullFit || !turbineSpec) return null;

  const maxPdf = Math.max(...weibullFit.pdf_values);

  return (
    <ChartWrapper
      title={`Weibull Distribution — A=${weibullFit.fitted_a} m/s, k=${weibullFit.fitted_k}`}
      headerRight={<InfoButton info={weibullInfo} />}
      footer={`Mean: ${weibullFit.mean_speed_ms} m/s · 8760 synthetic hours`}
    >
      <Plot
        data={[
          {
            type: "bar",
            x: weibullFit.bin_centres,
            y: weibullFit.bin_frequencies,
            name: "Histogram",
            marker: { color: "rgba(59, 130, 246, 0.5)" },
          },
          {
            type: "scatter",
            mode: "lines",
            x: weibullFit.bin_centres,
            y: weibullFit.pdf_values,
            name: `Weibull PDF`,
            line: { color: "rgb(234, 179, 8)", width: 2.5 },
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          showlegend: true,
          legend: { x: 0.65, y: 0.95, font: { size: 10 } },
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            title: { text: "Wind Speed [m/s]", font: { size: 11 } },
          },
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            title: { text: "Probability Density [1/(m/s)]", font: { size: 11 } },
          },
          shapes: [
            {
              type: "line",
              x0: turbineSpec.cut_in_speed_ms,
              x1: turbineSpec.cut_in_speed_ms,
              y0: 0,
              y1: maxPdf * 1.1,
              line: { color: SCADA_COLORS.ALARM_LOW, width: 1, dash: "dash" },
            },
            {
              type: "line",
              x0: turbineSpec.rated_speed_ms,
              x1: turbineSpec.rated_speed_ms,
              y0: 0,
              y1: maxPdf * 1.1,
              line: { color: SCADA_COLORS.ENERGIZED, width: 1, dash: "dash" },
            },
            {
              type: "line",
              x0: turbineSpec.cut_out_speed_ms,
              x1: turbineSpec.cut_out_speed_ms,
              y0: 0,
              y1: maxPdf * 1.1,
              line: { color: SCADA_COLORS.FAULT, width: 1, dash: "dash" },
            },
          ],
          annotations: [
            {
              x: turbineSpec.cut_in_speed_ms,
              y: maxPdf * 1.05,
              text: "Cut-in",
              showarrow: false,
              font: { size: 11, color: SCADA_COLORS.ALARM_LOW },
            },
            {
              x: turbineSpec.rated_speed_ms,
              y: maxPdf * 1.05,
              text: "Rated",
              showarrow: false,
              font: { size: 11, color: SCADA_COLORS.ENERGIZED },
            },
            {
              x: turbineSpec.cut_out_speed_ms,
              y: maxPdf * 1.05,
              text: "Cut-out",
              showarrow: false,
              font: { size: 11, color: SCADA_COLORS.FAULT },
            },
          ],
          bargap: 0.05,
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: CHART_HEIGHT }}
      />
    </ChartWrapper>
  );
}
