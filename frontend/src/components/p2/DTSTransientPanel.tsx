/**
 * Emergency loading — conductor temperature per zone after the current steps
 * from the pre-fault value to the emergency value (e.g. N-1 survivor).
 */

import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { useCableDTSStore } from "../../store/cableDtsStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { zoneColor } from "./dtsZoneColors";

export default function DTSTransientPanel() {
  const { transient: t } = useCableDTSStore();
  const c = useChartPalette();
  if (!t) return null;

  const peak = Math.max(...t.zones.flatMap((z) => z.conductor_temp_c));
  const crossings = t.zones.filter((z) => z.minutes_to_limit !== null);

  return (
    <ChartWrapper
      title={`Step ${t.prefault_current_a} → ${t.emergency_current_a} A at t = 0`}
      footer={`${t.allowed_minutes === null ? "✓" : "⏱"} ${t.assessment}. Two-node thermal ladder per zone (IEC 60853 form); time constants are assumptions: internal 1 h, external ${t.zones.map((z) => `${z.tau_ext_h} h`).join(" / ")}.`}
    >
      <Plot
        data={[
          ...t.zones.map((z) => ({
            type: "scatter" as const,
            mode: "lines" as const,
            name: z.name,
            x: t.time_h,
            y: z.conductor_temp_c,
            line: { color: zoneColor(c, z.name), width: 2 },
            hovertemplate: `${z.name}: %{y:.1f} °C after %{x:.1f} h<extra></extra>`,
          })),
          {
            type: "scatter",
            mode: "markers",
            name: "Reaches 90 °C",
            showlegend: false,
            x: crossings.map((z) => (z.minutes_to_limit ?? 0) / 60),
            y: crossings.map(() => 90),
            marker: { color: crossings.map((z) => zoneColor(c, z.name)), size: 9, symbol: "diamond", line: { color: c.ink, width: 1.5 } },
            hovertemplate: "90 °C after %{x:.1f} h<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          transition: CHART_TRANSITION,
          legend: { orientation: "h", y: 1.18, x: 0, font: { size: 11 } },
          margin: { t: 48, r: 12, b: 44, l: 56 },
          xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Time after the step [h]", font: { size: 12 } }, range: [0, t.time_h[t.time_h.length - 1]], dtick: 4 },
          yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "Conductor temperature [°C]", font: { size: 12 } }, range: [Math.max(0, t.ambient_temp_c - 5), Math.max(100, peak + 5)], dtick: 20 },
          shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 90, y1: 90, line: { color: c.red, width: 1, dash: "dash" } }],
          annotations: [{ x: 0, y: 90, xanchor: "left", yanchor: "bottom", text: "90 °C XLPE limit", showarrow: false, font: { size: 10, color: c.ref } }],
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: 300 }}
      />
    </ChartWrapper>
  );
}
