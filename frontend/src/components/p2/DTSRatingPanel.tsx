/**
 * Steady-state rating of each route zone against ambient temperature. The
 * lowest curve is the route rating; the operating current and today's
 * ambient are marked.
 */

import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { useCableDTSStore } from "../../store/cableDtsStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { zoneColor } from "./dtsZoneColors";

export default function DTSRatingPanel() {
  const { profile: p } = useCableDTSStore();
  const c = useChartPalette();
  if (!p) return null;

  const { ambient_c, zones } = p.rating_curve;
  const over = p.current_a > p.rating_at_ambient_a;
  const all = [...zones.flatMap((z) => z.rating_a), p.current_a];
  const yRange = [Math.floor(Math.min(...all) / 100) * 100 - 50, Math.ceil(Math.max(...all) / 100) * 100 + 50];

  return (
    <ChartWrapper
      title="Rating against ambient temperature"
      footer={`${over ? "✗" : "✓"} ${p.current_a} A ${over ? "exceeds" : "is within"} the ${p.rating_at_ambient_a.toFixed(0)} A route rating at ${p.ambient_temp_c} °C, set by the ${p.limiting_zone}. Steady state (IEC 60287); 950 A at 15 °C is the calibration point.`}
    >
      <Plot
        data={[
          ...zones.map((z) => ({
            type: "scatter" as const,
            mode: "lines" as const,
            name: z.name,
            x: ambient_c,
            y: z.rating_a,
            line: { color: zoneColor(c, z.name), width: 2 },
            hovertemplate: `${z.name}: %{y:.0f} A at %{x} °C<extra></extra>`,
          })),
          {
            type: "scatter",
            mode: "markers",
            name: "Route rating now",
            x: [p.ambient_temp_c],
            y: [p.rating_at_ambient_a],
            marker: { color: zoneColor(c, p.limiting_zone), size: 10, line: { color: c.ink, width: 1.5 } },
            hovertemplate: "route rating %{y:.0f} A at %{x} °C<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          transition: CHART_TRANSITION,
          legend: { orientation: "h", y: 1.18, x: 0, font: { size: 11 } },
          margin: { t: 48, r: 12, b: 44, l: 60 },
          xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Ambient temperature [°C]", font: { size: 12 } }, range: [0, 30] },
          yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "Current per circuit [A]", font: { size: 12 } }, range: yRange },
          shapes: [
            { type: "line", xref: "paper", x0: 0, x1: 1, y0: p.current_a, y1: p.current_a, line: { color: over ? c.red : c.ref, width: 1.5, dash: "dash" } },
          ],
          annotations: [
            { x: 30, y: p.current_a, xanchor: "right", yanchor: "bottom", text: `operating ${p.current_a} A`, showarrow: false, font: { size: 10, color: c.ref } },
          ],
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: 300 }}
      />
    </ChartWrapper>
  );
}
