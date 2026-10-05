/**
 * Frequency scan — |Z(f)| seen from the assessed bus, with the converter
 * characteristic harmonics marked. Where a peak sits on a marker, emission
 * at that order is amplified.
 */

import Plot from "react-plotly.js";

import { powerQualityEducation } from "../../constants/education/p2";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { usePowerQualityStore } from "../../store/powerQualityStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { EducationButton } from "../ui/EducationButton";

const CHARACTERISTIC = [5, 7, 11, 13, 17, 19, 23, 25];

export default function ResonanceScanPanel() {
  const { resonance } = usePowerQualityStore();
  const c = useChartPalette();
  if (!resonance?.frequencies_hz.length) return null;
  const peaks = resonance.resonance_points;
  return (
    <ChartWrapper
      title={`Network impedance seen from ${resonance.viewpoint}`}
      headerRight={<EducationButton content={powerQualityEducation} />}
      footer={resonance.assessment}
    >
      <Plot
        data={[
          {
            type: "scatter",
            mode: "lines",
            x: resonance.frequencies_hz,
            y: resonance.impedances_ohm,
            line: { color: c.blue, width: 2 },
            hovertemplate: "%{x:.0f} Hz (h %{customdata:.1f}): |Z| %{y:.1f} Ω<extra></extra>",
            customdata: resonance.frequencies_hz.map((f) => f / 50),
            name: "|Z(f)|",
          },
          {
            type: "scatter",
            x: peaks.map((p) => p.frequency_hz),
            y: peaks.map((p) => p.impedance_ohm),
            marker: { color: c.orange, size: 9, line: { color: c.ink, width: 1 } },
            text: peaks.map((p) => `h ${p.harmonic_order.toFixed(1)} · ×${p.amplification.toFixed(0)}`),
            textposition: "top center",
            textfont: { color: c.ink, size: 10 },
            mode: "text+markers",
            hovertemplate: "Resonance at %{x:.0f} Hz: %{y:.0f} Ω (%{text})<extra></extra>",
            name: "Resonance",
          } as const,
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          transition: CHART_TRANSITION,
          showlegend: false,
          xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Frequency [Hz]", font: { size: 12 } }, range: [50, 1400] },
          yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, type: "log", title: { text: "|Z| [Ω]", font: { size: 12 } }, tickvals: [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000] },
          shapes: CHARACTERISTIC.map(
            (h) => ({ type: "line", xref: "x", yref: "paper", x0: h * 50, x1: h * 50, y0: 0, y1: 1, line: { color: c.ref, width: 1, dash: "dot" } }) as const,
          ),
          annotations: CHARACTERISTIC.map(
            (h) => ({ x: h * 50, y: 1, xref: "x", yref: "paper", yanchor: "bottom", text: `h${h}`, showarrow: false, font: { size: 9 } }) as const,
          ),
          margin: { t: 28, r: 12, b: 48, l: 60 },
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: 300 }}
      />
    </ChartWrapper>
  );
}
