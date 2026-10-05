/**
 * Fault size over time — windowed estimates (±1.96 SE), the injected ground
 * truth, and for wear faults the ISO 13381-1 projection to the limit.
 */

import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useChartPalette } from "../../hooks/useChartPalette";
import { useDigitalTwinStore } from "../../store/digitalTwinStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { FAULT_LABEL, isoTime } from "./twinFormat";

const DAY = 86_400;

export default function SeverityTrendPanel() {
  const detail = useDigitalTwinStore((s) => s.detail);
  const c = useChartPalette();
  const d = detail?.turbine.diagnosis;
  const kind = d?.kind;

  if (!detail || !kind || detail.severity_trend.length === 0) {
    return (
      <ChartWrapper title="Fault size over time & prognosis">
        <p className="py-16 text-center text-sm text-text-muted">
          Shown once a fault has been identified on this turbine.
        </p>
      </ChartWrapper>
    );
  }

  const unit = d.unit ?? "";
  const pts = detail.severity_trend;
  const truth = detail.truth.find((t) => t.kind === kind);
  const p = detail.turbine.prognosis;
  const traces: Plotly.Data[] = [
    {
      x: pts.map((q) => isoTime(q.time)),
      y: pts.map((q) => q.severity),
      error_y: { type: "data", array: pts.map((q) => 1.96 * q.std_error), color: c.blue, thickness: 1 },
      type: "scatter",
      mode: "markers",
      name: "Estimated (12 h windows)",
      marker: { color: c.blue, size: 7 },
      hovertemplate: `%{x|%d %b %H:%M}<br>%{y:.3f} ${unit}<extra>estimate</extra>`,
    },
  ];
  if (truth) {
    const step = Math.max(1, Math.floor(truth.values.length / 400));
    const idx = truth.values.map((_, i) => i).filter((i) => i % step === 0);
    traces.push({
      x: idx.map((i) => isoTime(detail.timestamps[i])),
      y: idx.map((i) => truth.values[i]),
      type: "scatter",
      mode: "lines",
      name: "Injected (ground truth)",
      line: { color: c.aqua, width: 1.5 },
      hovertemplate: `%{y:.3f} ${unit}<extra>injected</extra>`,
    });
  }

  const shapes: Partial<Plotly.Shape>[] = [];
  if (p && p.status === "trend" && p.rul_days != null && p.current != null) {
    const tNow = detail.timestamps[detail.timestamps.length - 1];
    const tEnd = tNow + p.rul_days * DAY;
    traces.push({
      x: [isoTime(tNow), isoTime(tEnd)],
      y: [p.current, p.limit],
      type: "scatter",
      mode: "lines+markers",
      name: `Projection · RUL ${p.rul_days.toFixed(1)} d`,
      line: { color: c.red, width: 2, dash: "dash" },
      marker: { size: [0, 9], color: c.red, symbol: "x" },
      hovertemplate: `%{x|%d %b %H:%M}<br>%{y:.3f} ${unit}<extra>projection</extra>`,
    });
    if (p.rul_lower_days != null && p.rul_upper_days != null) {
      shapes.push({
        type: "rect",
        xref: "x",
        yref: "paper",
        x0: isoTime(tNow + p.rul_lower_days * DAY),
        x1: isoTime(tNow + p.rul_upper_days * DAY),
        y0: 0,
        y1: 1,
        fillcolor: c.red,
        opacity: 0.1,
        line: { width: 0 },
        layer: "below",
      });
    }
  }
  if (p) {
    shapes.push({
      type: "line",
      xref: "paper",
      x0: 0,
      x1: 1,
      y0: p.limit,
      y1: p.limit,
      line: { color: c.red, width: 1, dash: "dot" },
    });
  }

  return (
    <ChartWrapper
      title={`Fault size over time — ${FAULT_LABEL[kind]}`}
      footer={
        p
          ? `Dotted red = limit ${p.limit} ${unit} (${p.limit_note}) · shaded = 90 % RUL interval · weighted least squares, one-sided t-test (ISO 13381-1)`
          : "Not a wear process: no life projection. Error bars = 95 % (±1.96 SE)."
      }
    >
      <Plot
        data={traces}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: 340,
          margin: { t: 30, r: 16, b: 44, l: 64 },
          legend: { ...DARK_PLOTLY_LAYOUT.legend, orientation: "h", x: 0, y: 1.12 },
          xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, type: "date" },
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            title: { text: `${d.label} [${unit}]`, font: { size: 11 } },
          },
          shapes,
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: 340 }}
      />
    </ChartWrapper>
  );
}
