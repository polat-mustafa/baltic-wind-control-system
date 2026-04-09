/**
 * BESS Frequency Response Panel — M08.
 *
 * Dual-axis Plotly chart: system frequency (Hz) + BESS power (MW) vs time.
 * Shows FCR activation and FFR burst response at 49.7 Hz threshold.
 * Nordic frequency nadir event scenario (~49.65 Hz in 10s).
 */

import Plot from "react-plotly.js";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useBESSStore } from "../../store/bessStore";
import { Button } from "../ui/Button";
import { InfoButton } from "../ui/InfoButton";
import { bessFrequencyInfo } from "../../constants/panelInfo";

export default function BESSFrequencyPanel() {
  const { freqResponse, simLoading, simFrequencyResponse } = useBESSStore();

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-1">
            <h3 className="text-sm font-semibold text-text-primary">FCR / FFR Frequency Response</h3>
            <InfoButton info={bessFrequencyInfo} />
          </div>
          <p className="text-xs text-text-muted">Nordic frequency event — 5% droop, FFR @ 49.7 Hz</p>
        </div>
        <Button size="sm" onClick={simFrequencyResponse} disabled={simLoading}>
          {simLoading ? (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Simulating…
            </span>
          ) : freqResponse ? "Re-run" : "Simulate"}
        </Button>
      </div>

      {freqResponse ? (
        <>
          <Plot
            data={[
              {
                type: "scatter",
                x: freqResponse.time_s,
                y: freqResponse.frequency_hz,
                name: "Frequency (Hz)",
                line: { color: "#60a5fa", width: 2 },
                yaxis: "y",
                hovertemplate: "t=%{x:.1f}s<br>f=%{y:.3f} Hz<extra></extra>",
              },
              {
                type: "scatter",
                x: freqResponse.time_s,
                y: freqResponse.bess_power_mw,
                name: "BESS power (MW)",
                line: { color: "#3ecf6e", width: 2, dash: "dash" },
                yaxis: "y2",
                hovertemplate: "t=%{x:.1f}s<br>P=%{y:.1f} MW<extra></extra>",
              },
            ]}
            layout={{
              ...DARK_PLOTLY_LAYOUT,
              height: 280,
              xaxis: {
                ...DARK_PLOTLY_LAYOUT.xaxis,
                title: { text: "Time (s)", font: { color: "#9ba3b8", size: 12 } },
              },
              yaxis: {
                ...DARK_PLOTLY_LAYOUT.yaxis,
                title: { text: "Frequency (Hz)", font: { color: "#60a5fa", size: 11 } },
                range: [49.4, 50.2],
                tickfont: { ...DARK_PLOTLY_LAYOUT.yaxis.tickfont, color: "#60a5fa" },
              },
              yaxis2: {
                title: { text: "BESS Power (MW)", font: { color: "#3ecf6e", size: 11 } },
                overlaying: "y",
                side: "right",
                tickfont: { family: "'JetBrains Mono', monospace", size: 11, color: "#3ecf6e" },
                gridcolor: "transparent",
              },
              legend: { ...DARK_PLOTLY_LAYOUT.legend, orientation: "h", x: 0.5, xanchor: "center", y: 1.04, yanchor: "bottom" },
              margin: { t: 52, r: 72, b: 32, l: 64 },
            }}
            config={PLOTLY_CONFIG}
            className="w-full"
          />
          <div className="flex gap-3 mt-2 text-xs text-text-muted flex-wrap">
            <span>Nadir: <span className="text-text-primary font-mono">{freqResponse.nadir_hz.toFixed(3)} Hz</span> @ {freqResponse.nadir_time_s.toFixed(1)} s</span>
            <span>Energy delivered: <span className="text-text-primary font-mono">{freqResponse.energy_delivered_mwh.toFixed(3)} MWh</span></span>
            {freqResponse.fcr_activated && <span className="text-status-success">FCR ✓</span>}
            {freqResponse.ffr_activated && <span className="text-status-warning">FFR ✓</span>}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-48 text-text-muted text-sm">
          Click "Simulate" to run frequency response simulation
        </div>
      )}
    </div>
  );
}
