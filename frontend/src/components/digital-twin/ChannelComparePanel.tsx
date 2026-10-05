/**
 * Measured vs. twin for one channel of the selected turbine.
 *
 * The twin runs on the measured wind and air density of each 10-min record,
 * so the two lines differ by sensor scatter — or by a fault.
 */

import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useChartPalette } from "../../hooks/useChartPalette";
import { useDigitalTwinStore } from "../../store/digitalTwinStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { CHANNEL_META, CHANNEL_ORDER, isoTime, spans } from "./twinFormat";

const EXPECTED_LABEL = {
  anemometer: "Neighbour median",
} as const;

export default function ChannelComparePanel() {
  const detail = useDigitalTwinStore((s) => s.detail);
  const channel = useDigitalTwinStore((s) => s.selectedChannel);
  const setChannel = useDigitalTwinStore((s) => s.setSelectedChannel);
  const c = useChartPalette();
  if (!detail) return null;

  const ch = detail.channels.find((x) => x.key === channel) ?? detail.channels[0];
  const meta = CHANNEL_META[ch.key];
  const x = detail.timestamps.map(isoTime);
  const unit = ch.key === "anemometer" ? "m/s" : meta.unit;
  const measured = ch.measured.map((v, k) => (ch.valid[k] || ch.key === "anemometer" ? v : null));
  const expected = ch.expected.map((v, k) => (ch.valid[k] || ch.key === "anemometer" ? v : null));
  const expectedName = ch.key === "anemometer" ? EXPECTED_LABEL.anemometer : "Twin";

  return (
    <ChartWrapper
      title={`Measured vs twin — ${meta.label}`}
      headerRight={
        <div className="flex flex-wrap rounded-md border border-border-secondary overflow-hidden text-[11px]">
          {CHANNEL_ORDER.map((k) => (
            <button
              key={k}
              onClick={() => setChannel(k)}
              aria-pressed={channel === k}
              title={CHANNEL_META[k].label}
              className={`px-2 py-0.5 font-mono ${
                channel === k ? "bg-accent text-white" : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
              }`}
            >
              {CHANNEL_META[k].short}
            </button>
          ))}
        </div>
      }
      footer={`${ch.logical_node} · gaps = turbine not producing · shaded = confirmed events`}
    >
      <Plot
        data={[
          {
            x,
            y: measured,
            type: "scatter",
            mode: "lines",
            name: "Measured (SCADA)",
            line: { color: c.blue, width: 1.3 },
            connectgaps: false,
            hovertemplate: `%{y:.2f} ${unit}<extra>measured</extra>`,
          },
          {
            x,
            y: expected,
            type: "scatter",
            mode: "lines",
            name: expectedName,
            line: { color: c.orange, width: 1.3, dash: "dot" },
            connectgaps: false,
            hovertemplate: `%{y:.2f} ${unit}<extra>${expectedName.toLowerCase()}</extra>`,
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: 360,
          margin: { t: 30, r: 16, b: 44, l: 60 },
          hovermode: "x unified",
          legend: { ...DARK_PLOTLY_LAYOUT.legend, orientation: "h", x: 0, y: 1.1 },
          xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, type: "date" },
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            title: { text: `${meta.label} [${unit}]`, font: { size: 12 } },
          },
          shapes: spans(detail.in_event).map(([a, b]) => ({
            type: "rect",
            xref: "x",
            yref: "paper",
            x0: x[a],
            x1: x[b],
            y0: 0,
            y1: 1,
            fillcolor: c.yellow,
            opacity: 0.12,
            line: { width: 0 },
            layer: "below",
          })),
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: 360 }}
      />
    </ChartWrapper>
  );
}
