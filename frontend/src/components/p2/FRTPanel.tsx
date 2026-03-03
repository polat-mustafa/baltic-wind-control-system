/**
 * Fault Ride-Through simulation panel — LVRT/HVRT time-series.
 *
 * Three subplots:
 * - Top: Voltage vs time [pu] with PSE LVRT envelope
 * - Middle: Active power vs time [MW] with 90% recovery threshold
 * - Bottom: Reactive current vs time [pu]
 *
 * Compliance badges: stayed_connected, reactive_current_compliant, recovery_compliant
 */

import Plot from "react-plotly.js";
import { useGridStore } from "../../store/gridStore";
import { SCADA_COLORS } from "../../constants/scadaColors";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { InfoButton } from "../ui/InfoButton";
import { frtInfo } from "../../constants/panelInfo";

// PSE LVRT envelope (time [s], voltage [pu])
const PSE_LVRT_ENVELOPE = [
  [0.000, 0.15],
  [0.140, 0.25],
  [0.500, 0.85],
  [1.000, 0.85],
  [1.500, 1.00],
  [3.000, 1.00],
];

function ComplianceBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className="text-xs px-2 py-1 rounded font-semibold"
      style={{
        backgroundColor: ok ? "rgba(0, 255, 0, 0.12)" : "rgba(255, 0, 0, 0.12)",
        color: ok ? SCADA_COLORS.ENERGIZED : SCADA_COLORS.FAULT,
      }}
    >
      {label}: {ok ? "PASS" : "FAIL"}
    </span>
  );
}

export default function FRTPanel() {
  const { frtResult } = useGridStore();

  if (!frtResult || frtResult.time_series.length === 0) return null;

  const ts = frtResult.time_series;
  const times = ts.map((p) => p.time_s);
  const voltages = ts.map((p) => p.voltage_pu);
  const powers = ts.map((p) => p.active_power_mw);
  const iq = ts.map((p) => p.reactive_current_pu);

  // Pre-fault power for recovery threshold
  const preFaultP = ts.find((p) => p.time_s < 0.5)?.active_power_mw ?? 510;
  const recoveryThreshold = preFaultP * 0.9;

  // LVRT envelope offset by fault start (0.5s pre-fault)
  const faultStart = 0.5;
  const envelopeTimes = PSE_LVRT_ENVELOPE.map(([t]) => t + faultStart);
  const envelopeVolts = PSE_LVRT_ENVELOPE.map(([, v]) => v);

  const typeLabel = frtResult.frt_type.toUpperCase();

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-text-primary">
          {typeLabel} Simulation — {frtResult.fault_bus}, {(frtResult.fault_duration_s * 1000).toFixed(0)} ms
        </h3>
        <div className="flex items-center gap-2">
          <InfoButton info={frtInfo} />
          <ComplianceBadge label="Connected" ok={frtResult.stayed_connected} />
          <ComplianceBadge label={`Kqv\u2265${2.0}`} ok={frtResult.reactive_current_compliant} />
          <ComplianceBadge label="Recovery" ok={frtResult.recovery_compliant} />
        </div>
      </div>

      {/* Voltage subplot */}
      <Plot
        data={[
          {
            type: "scatter",
            mode: "lines",
            name: "PCC Voltage",
            x: times,
            y: voltages,
            line: { color: SCADA_COLORS.VOLTAGE_220KV, width: 2 },
            hovertemplate: "t=%{x:.3f}s<br>V=%{y:.3f} pu<extra></extra>",
          },
          ...(frtResult.frt_type === "lvrt"
            ? [
                {
                  type: "scatter" as const,
                  mode: "lines" as const,
                  name: "PSE LVRT Envelope",
                  x: envelopeTimes,
                  y: envelopeVolts,
                  line: { color: SCADA_COLORS.FAULT, width: 1.5, dash: "dash" as const },
                  fill: "tozeroy" as const,
                  fillcolor: "rgba(255, 0, 0, 0.05)",
                },
              ]
            : []),
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: 200,
          title: { text: "Voltage [p.u.]", font: { size: 11, color: "rgb(148,163,184)" } },
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            title: "V [pu]",
            range: [0, 1.3],
          },
          xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: "" },
          legend: { orientation: "h", y: 1.2, font: { size: 9, color: "rgb(148,163,184)" } },
          margin: { ...DARK_PLOTLY_LAYOUT.margin, b: 20 },
        }}
        config={PLOTLY_CONFIG}
        className="w-full"
      />

      {/* Active power subplot */}
      <Plot
        data={[
          {
            type: "scatter",
            mode: "lines",
            name: "Active Power",
            x: times,
            y: powers,
            line: { color: SCADA_COLORS.ENERGIZED, width: 2 },
            hovertemplate: "t=%{x:.3f}s<br>P=%{y:.1f} MW<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: 180,
          title: { text: "Active Power [MW]", font: { size: 11, color: "rgb(148,163,184)" } },
          yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: "P [MW]" },
          xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: "" },
          shapes: [
            {
              type: "line",
              x0: times[0], x1: times[times.length - 1],
              y0: recoveryThreshold, y1: recoveryThreshold,
              line: { color: SCADA_COLORS.WARNING, width: 1, dash: "dot" },
            },
          ],
          showlegend: false,
          margin: { ...DARK_PLOTLY_LAYOUT.margin, b: 20, t: 30 },
        }}
        config={PLOTLY_CONFIG}
        className="w-full"
      />

      {/* Reactive current subplot */}
      <Plot
        data={[
          {
            type: "scatter",
            mode: "lines",
            name: "Reactive Current",
            x: times,
            y: iq,
            line: { color: SCADA_COLORS.ALARM_MEDIUM, width: 2 },
            hovertemplate: "t=%{x:.3f}s<br>Iq=%{y:.3f} pu<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: 160,
          title: { text: "Reactive Current [p.u.]", font: { size: 11, color: "rgb(148,163,184)" } },
          yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: "Iq [pu]" },
          xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: "Time [s]" },
          showlegend: false,
          margin: { ...DARK_PLOTLY_LAYOUT.margin, t: 30 },
        }}
        config={PLOTLY_CONFIG}
        className="w-full"
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mt-2 text-center">
        <div>
          <p className="text-xs text-text-muted">Kqv Achieved</p>
          <p className="text-sm font-bold" style={{
            color: frtResult.reactive_current_gain >= 2.0
              ? SCADA_COLORS.ENERGIZED
              : SCADA_COLORS.FAULT,
          }}>
            {frtResult.reactive_current_gain.toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Recovery Time</p>
          <p className="text-sm font-bold" style={{
            color: frtResult.recovery_time_s <= 1.0
              ? SCADA_COLORS.ENERGIZED
              : SCADA_COLORS.FAULT,
          }}>
            {frtResult.recovery_time_s === Infinity ? "\u221E" : `${frtResult.recovery_time_s.toFixed(3)}s`}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-muted">STATCOM Peak Q</p>
          <p className="text-sm font-bold text-slate-200">
            {frtResult.statcom_peak_q_mvar.toFixed(1)} MVAR
          </p>
        </div>
      </div>
    </div>
  );
}
