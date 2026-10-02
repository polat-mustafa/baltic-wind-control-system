/**
 * FCR — the frequency event, the battery's answer and the CE characteristic
 * it follows. Three single-axis charts; battery power positive = discharge.
 */

import Plot from "react-plotly.js";

import { bessEducation } from "../../constants/education/p2";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { FFR_THRESHOLD_HZ, FREQUENCY_EVENTS, useBESSStore } from "../../store/bessStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { EducationButton } from "../ui/EducationButton";

const plotProps = { config: PLOTLY_CONFIG, useResizeHandler: true, className: "w-full", style: { height: 240 } };

export default function BESSFrequencyPanel() {
  const { fcr, event, fcrCapacityMw, ffrEnabled } = useBESSStore();
  const c = useChartPalette();
  if (!fcr) return null;

  const t = fcr.time_s;
  const fLo = Math.min(49.1, fcr.nadir_hz - 0.05);
  const fHi = Math.max(50.3, ...fcr.frequency_hz.map((f) => f + 0.05));
  const base = {
    ...DARK_PLOTLY_LAYOUT,
    transition: CHART_TRANSITION,
    showlegend: false,
    margin: { t: 16, r: 12, b: 44, l: 60 },
  };
  const timeAxis = { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Time [s]", font: { size: 12 } }, range: [0, t[t.length - 1]] };
  // CE characteristic for the offered capacity
  const fGrid = Array.from({ length: Math.round((fHi - fLo) / 0.01) + 1 }, (_, i) => fLo + i * 0.01);
  const pChar = fGrid.map((f) => (Math.abs(50 - f) <= 0.01 ? 0 : fcrCapacityMw * Math.max(-1, Math.min(1, (50 - f) / 0.2))));

  return (
    <ChartWrapper
      title={`Frequency containment — ${FREQUENCY_EVENTS[event].label}`}
      headerRight={<EducationButton content={bessEducation} />}
      footer={`${FREQUENCY_EVENTS[event].note} ${fcr.assessment}. Frequency trace is illustrative and an input — 50 MW does not move the CE system frequency.`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-text-muted mb-1">System frequency [Hz]</p>
          <Plot
            data={[
              {
                type: "scatter",
                mode: "lines",
                x: t,
                y: fcr.frequency_hz,
                line: { color: c.blue, width: 2 },
                hovertemplate: "%{x} s: %{y:.3f} Hz<extra></extra>",
              },
            ]}
            layout={{
              ...base,
              xaxis: timeAxis,
              yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "f [Hz]", font: { size: 12 } }, range: [fLo, fHi], dtick: 0.2 },
              shapes: [
                { type: "rect", xref: "paper", x0: 0, x1: 1, y0: 49.8, y1: 50.2, fillcolor: c.band, line: { width: 0 }, layer: "below" } as const,
                ...(fLo < 49.0
                  ? [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 49, y1: 49, line: { color: c.red, width: 1, dash: "dash" } } as const]
                  : []),
                ...(ffrEnabled
                  ? [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: FFR_THRESHOLD_HZ, y1: FFR_THRESHOLD_HZ, line: { color: c.orange, width: 1, dash: "dot" } } as const]
                  : []),
              ],
              annotations: [
                { xref: "paper", x: 1, y: 49.8, xanchor: "right", yanchor: "top", text: "full FCR at ±200 mHz", showarrow: false, font: { size: 10 } } as const,
                { x: fcr.nadir_time_s, y: fcr.nadir_hz, text: `nadir ${fcr.nadir_hz.toFixed(2)} Hz`, showarrow: true, arrowhead: 0, ax: 40, ay: 18, font: { size: 10 } } as const,
              ],
            }}
            {...plotProps}
          />
        </div>
        <div>
          <p className="text-xs text-text-muted mb-1">Battery power [MW], discharge +</p>
          <Plot
            data={[
              {
                type: "scatter",
                mode: "lines",
                x: t,
                y: fcr.bess_power_mw,
                fill: "tozeroy",
                fillcolor: c.band,
                line: { color: c.orange, width: 2 },
                customdata: fcr.soc_percent,
                hovertemplate: "%{x} s: %{y:.1f} MW · SOC %{customdata:.2f} %<extra></extra>",
              },
            ]}
            layout={{
              ...base,
              xaxis: timeAxis,
              yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "P [MW]", font: { size: 12 } }, range: [-55, 55], zeroline: true },
              annotations: [
                { xref: "paper", x: 0.02, y: 52, xanchor: "left", yanchor: "top", text: "discharge", showarrow: false, font: { size: 10 } } as const,
                { xref: "paper", x: 0.02, y: -52, xanchor: "left", yanchor: "bottom", text: "charge", showarrow: false, font: { size: 10 } } as const,
              ],
            }}
            {...plotProps}
          />
        </div>
        <div>
          <p className="text-xs text-text-muted mb-1">CE FCR characteristic and the operating points</p>
          <Plot
            data={[
              {
                type: "scatter",
                mode: "lines",
                x: fGrid,
                y: pChar,
                line: { color: c.ref, width: 1.5, dash: "dash" },
                hoverinfo: "skip",
              },
              {
                type: "scatter",
                mode: "markers",
                x: fcr.frequency_hz,
                y: fcr.bess_power_mw,
                marker: { color: c.orange, size: 8, opacity: 0.55, line: { color: c.ink, width: 0.5 } },
                hovertemplate: "%{x:.3f} Hz → %{y:.1f} MW<extra></extra>",
              },
            ]}
            layout={{
              ...base,
              xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "f [Hz]", font: { size: 12 } }, range: [fLo, fHi], dtick: 0.2 },
              yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "P [MW]", font: { size: 12 } }, range: [-55, 55] },
            }}
            {...plotProps}
          />
        </div>
      </div>
    </ChartWrapper>
  );
}
