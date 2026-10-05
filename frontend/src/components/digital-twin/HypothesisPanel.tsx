/**
 * Fault isolation: how well each modelled fault explains the turbine's residuals.
 *
 * Every hypothesis is simulated through the physics reference model and its
 * size fitted by weighted least squares; the bar is the share of the
 * no-fault misfit it removes. The winner is accepted only above 30 % and a
 * likelihood-ratio test at p = 0.001.
 */

import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useChartPalette } from "../../hooks/useChartPalette";
import { useDigitalTwinStore } from "../../store/digitalTwinStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { FAULT_LABEL, formatSeverity } from "./twinFormat";

export default function HypothesisPanel() {
  const detail = useDigitalTwinStore((s) => s.detail);
  const c = useChartPalette();
  const d = detail?.turbine.diagnosis;

  if (!detail || !d || d.hypotheses.length === 0) {
    return (
      <ChartWrapper title="Fault isolation — hypothesis test">
        <p className="py-16 text-center text-sm text-text-muted">
          {d
            ? "Too little producing data inside the event to test hypotheses."
            : "No event on this turbine — nothing to isolate."}
        </p>
      </ChartWrapper>
    );
  }

  const hyps = [...d.hypotheses].reverse(); // best at the top of a horizontal bar chart
  const best = d.hypotheses[0].kind;
  return (
    <ChartWrapper
      title="Fault isolation — hypothesis test"
      footer="Bar = share of the no-fault misfit removed by the best-fitting size of each fault (accept ≥ 30 % and LR test p < 0.001)."
    >
      <Plot
        data={[
          {
            type: "bar",
            orientation: "h",
            y: hyps.map((h) => FAULT_LABEL[h.kind]),
            x: hyps.map((h) => 100 * h.explained),
            marker: {
              color: hyps.map((h) => (h.kind === best && d.kind ? c.blue : c.ref)),
            },
            text: hyps.map(
              (h) => `${formatSeverity(h.kind, h.severity)} · p ${(100 * h.posterior).toFixed(0)} %`,
            ),
            textposition: "outside",
            cliponaxis: false,
            hovertemplate: "%{y}<br>explained %{x:.1f} %<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: 320,
          margin: { t: 10, r: 150, b: 44, l: 200 },
          showlegend: false,
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            range: [0, 100],
            title: { text: "Misfit explained [%]", font: { size: 12 } },
          },
          yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, tickfont: { ...DARK_PLOTLY_LAYOUT.yaxis.tickfont, size: 11 } },
          shapes: [
            {
              type: "line",
              x0: 30,
              x1: 30,
              yref: "paper",
              y0: 0,
              y1: 1,
              line: { color: c.ref, width: 1, dash: "dot" },
            },
          ],
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: 320 }}
      />
    </ChartWrapper>
  );
}
