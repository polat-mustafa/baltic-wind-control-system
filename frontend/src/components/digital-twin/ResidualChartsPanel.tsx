/**
 * Five EWMA control charts of the selected turbine (state detection, SD).
 *
 * Each row is the EWMA of the standardised residual of one channel, in σ
 * units, with its exact time-varying control limit (inner band = alert,
 * dashed = 2 × limit = alarm). Shaded spans are confirmed events.
 */

import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useChartPalette } from "../../hooks/useChartPalette";
import { useDigitalTwinStore } from "../../store/digitalTwinStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { CHANNEL_META, isoTime, spans } from "./twinFormat";

const GAP = 0.035;

export default function ResidualChartsPanel() {
  const detail = useDigitalTwinStore((s) => s.detail);
  const c = useChartPalette();
  if (!detail) return null;

  const x = detail.timestamps.map(isoTime);
  const n = detail.channels.length;
  const h = (1 - GAP * (n - 1)) / n;
  const traces: Plotly.Data[] = [];
  const layout: Record<string, unknown> = {};

  detail.channels.forEach((ch, i) => {
    const axis = i === 0 ? "y" : `y${i + 1}`;
    const key = i === 0 ? "yaxis" : `yaxis${i + 1}`;
    const top = 1 - i * (h + GAP);
    const ewma = ch.ewma.map((v, k) => (ch.valid[k] ? v : null));
    const lim = Math.max(...ch.limit);
    const peak = ch.ewma.reduce((m, v, k) => (ch.valid[k] ? Math.max(m, Math.abs(v)) : m), 0);
    traces.push(
      {
        x,
        y: ch.limit,
        type: "scatter",
        mode: "lines",
        line: { width: 0 },
        hoverinfo: "skip",
        showlegend: false,
        yaxis: axis,
      },
      {
        x,
        y: ch.limit.map((v) => -v),
        type: "scatter",
        mode: "lines",
        line: { width: 0 },
        fill: "tonexty",
        fillcolor: c.band,
        hoverinfo: "skip",
        showlegend: false,
        yaxis: axis,
      },
      {
        x,
        y: ch.limit.map((v) => 2 * v),
        type: "scatter",
        mode: "lines",
        line: { color: c.red, width: 1, dash: "dash" },
        hoverinfo: "skip",
        showlegend: false,
        yaxis: axis,
      },
      {
        x,
        y: ch.limit.map((v) => -2 * v),
        type: "scatter",
        mode: "lines",
        line: { color: c.red, width: 1, dash: "dash" },
        hoverinfo: "skip",
        showlegend: false,
        yaxis: axis,
      },
      {
        x,
        y: ewma,
        type: "scatter",
        mode: "lines",
        name: CHANNEL_META[ch.key].label,
        line: { color: c.blue, width: 1.6 },
        connectgaps: false,
        hovertemplate: `${CHANNEL_META[ch.key].label}<br>%{x|%d %b %H:%M}<br>EWMA %{y:.2f} σ<extra></extra>`,
        showlegend: false,
        yaxis: axis,
      },
    );
    const range = Math.max(2.4 * lim, peak) * 1.1;
    layout[key] = {
      ...DARK_PLOTLY_LAYOUT.yaxis,
      domain: [top - h, top],
      range: [-range, range],
      zeroline: true,
      zerolinecolor: c.ref,
      title: { text: `${CHANNEL_META[ch.key].short} [σ]`, font: { size: 11 } },
      tickfont: { ...DARK_PLOTLY_LAYOUT.yaxis.tickfont, size: 10 },
      nticks: 4,
    };
  });

  const shapes = spans(detail.in_event).map(([a, b]) => ({
    type: "rect" as const,
    xref: "x" as const,
    yref: "paper" as const,
    x0: x[a],
    x1: x[b],
    y0: 0,
    y1: 1,
    fillcolor: c.yellow,
    opacity: 0.12,
    line: { width: 0 },
    layer: "below" as const,
  }));
  const annotations = detail.channels.map((ch, i) => ({
    xref: "paper" as const,
    yref: "paper" as const,
    x: 0.005,
    y: 1 - i * (h + GAP) - 0.004,
    xanchor: "left" as const,
    yanchor: "top" as const,
    text: `${CHANNEL_META[ch.key].label} · ${ch.logical_node}`,
    showarrow: false,
    font: { size: 10, color: c.ink },
  }));

  return (
    <ChartWrapper
      title="Control charts — EWMA of standardised residuals"
      footer="Band = control limit (alert), dashed = 2 × limit (alarm), shaded = confirmed events. Gaps: turbine not producing."
    >
      <Plot
        data={traces}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: 620,
          margin: { t: 10, r: 16, b: 40, l: 56 },
          showlegend: false,
          hovermode: "x unified",
          xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, type: "date", anchor: `y${n}` },
          shapes,
          annotations,
          ...layout,
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: 620 }}
      />
    </ChartWrapper>
  );
}
