/**
 * PPC (Power Plant Controller) Dashboard — composed visualization.
 *
 * Displays simulation results from POST /api/v1/grid/ppc/simulate:
 * 1. KPI Header — 5 cards: state, power, curtailment, ramp time, compliance
 * 2. Active Power Ramp — time-series: setpoint vs actual vs available
 * 3. Voltage & Reactive Power — dual-axis: V_pcc and Q over time
 * 4. WTG Dispatch — bar chart: dispatched vs curtailed per turbine
 *
 * Follows ISA-101 dark SCADA theme with Plotly charts.
 */

import Plot from "react-plotly.js";

import { usePPCStore } from "../../store/ppcStore";
import { SCADA_COLORS } from "../../constants/scadaColors";
import {
  DARK_PLOTLY_LAYOUT,
  PLOTLY_CONFIG,
} from "../../constants/plotlyDefaults";

// ── KPI Card (local, matches GridKPIHeader pattern) ─────────────

interface KPIProps {
  label: string;
  value: string;
  unit: string;
  color?: string;
  subtitle?: string;
}

function KPI({ label, value, unit, color, subtitle }: KPIProps) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <p className="text-xs text-slate-400 uppercase tracking-wider">
        {label}
      </p>
      <p
        className="text-2xl font-bold mt-1"
        style={color ? { color } : undefined}
      >
        {value}
        <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>
      </p>
      {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}

// ── State badge color ────────────────────────────────────────────

function stateColor(state: string): string {
  switch (state) {
    case "running":
      return SCADA_COLORS.ENERGIZED;
    case "derated":
      return SCADA_COLORS.WARNING;
    case "stopped":
      return SCADA_COLORS.DE_ENERGIZED;
    case "emergency_stop":
    case "fault":
      return SCADA_COLORS.FAULT;
    default:
      return SCADA_COLORS.DE_ENERGIZED;
  }
}

function stateLabel(state: string): string {
  return state.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Main Dashboard ───────────────────────────────────────────────

export default function PPCDashboard() {
  const simulation = usePPCStore((s) => s.simulation);

  if (!simulation) return null;

  const {
    ppc_state,
    final_power_mw,
    total_available_mw,
    total_curtailment_mw,
    ramp_time_s,
    overall_compliant,
    setpoint_accuracy_compliant,
    ramp_rate_compliant,
    voltage_compliant,
    active_power_mode,
    time_series,
    wtg_dispatch,
    final_voltage_pu,
  } = simulation;

  // Time-series data
  const times = time_series.map((p) => p.time_s);
  const pActual = time_series.map((p) => p.power_actual_mw);
  const pSetpoint = time_series.map((p) => p.power_setpoint_mw);
  const pAvail = time_series.map((p) => p.available_power_mw);
  const voltages = time_series.map((p) => p.voltage_pcc_pu);
  const qActual = time_series.map((p) => p.q_actual_mvar);

  // WTG dispatch data
  const wtgIds = wtg_dispatch.map((w) => w.wtg_id);
  const wtgDispatched = wtg_dispatch.map((w) => w.dispatched_power_mw);
  const wtgCurtailed = wtg_dispatch.map((w) => w.curtailment_mw);

  // Downsample time series for performance (max 300 points)
  const step = Math.max(1, Math.floor(times.length / 300));
  const dsTime = times.filter((_, i) => i % step === 0);
  const dsPActual = pActual.filter((_, i) => i % step === 0);
  const dsPSetpoint = pSetpoint.filter((_, i) => i % step === 0);
  const dsPAvail = pAvail.filter((_, i) => i % step === 0);
  const dsVoltage = voltages.filter((_, i) => i % step === 0);
  const dsQ = qActual.filter((_, i) => i % step === 0);

  // Compliance color
  const complianceColor = overall_compliant
    ? SCADA_COLORS.ENERGIZED
    : SCADA_COLORS.FAULT;

  // Mode label
  const modeLabel = active_power_mode
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-4">
      {/* ── KPI Header ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI
          label="PPC State"
          value={stateLabel(ppc_state)}
          unit=""
          color={stateColor(ppc_state)}
          subtitle={modeLabel}
        />
        <KPI
          label="Active Power"
          value={final_power_mw.toFixed(1)}
          unit="MW"
          color={SCADA_COLORS.ENERGIZED}
          subtitle={`of ${total_available_mw.toFixed(0)} MW available`}
        />
        <KPI
          label="Curtailment"
          value={total_curtailment_mw.toFixed(1)}
          unit="MW"
          color={
            total_curtailment_mw > 0
              ? SCADA_COLORS.WARNING
              : SCADA_COLORS.ENERGIZED
          }
          subtitle={
            total_available_mw > 0
              ? `${((total_curtailment_mw / total_available_mw) * 100).toFixed(1)}% of available`
              : "No wind"
          }
        />
        <KPI
          label="Ramp Time"
          value={ramp_time_s.toFixed(1)}
          unit="s"
          color={SCADA_COLORS.VOLTAGE_220KV}
          subtitle={`V_pcc = ${final_voltage_pu.toFixed(4)} pu`}
        />
        <KPI
          label="Compliance"
          value={overall_compliant ? "PASS" : "FAIL"}
          unit=""
          color={complianceColor}
          subtitle={[
            setpoint_accuracy_compliant ? "Acc" : "!Acc",
            ramp_rate_compliant ? "Ramp" : "!Ramp",
            voltage_compliant ? "V" : "!V",
          ].join(" / ")}
        />
      </div>

      {/* ── Active Power Ramp Chart ────────────────────────────── */}
      <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
        <h3 className="text-base font-semibold text-text-primary mb-2">
          Active Power Ramp Response
        </h3>
        <Plot
          data={[
            {
              type: "scatter",
              mode: "lines",
              x: dsTime,
              y: dsPAvail,
              name: "Available",
              line: { color: "rgba(255,255,255,0.15)", width: 1, dash: "dot" },
              hovertemplate: "t=%{x:.0f}s<br>Available: %{y:.1f} MW<extra></extra>",
            },
            {
              type: "scatter",
              mode: "lines",
              x: dsTime,
              y: dsPSetpoint,
              name: "Setpoint",
              line: { color: SCADA_COLORS.WARNING, width: 2, dash: "dash" },
              hovertemplate: "t=%{x:.0f}s<br>Setpoint: %{y:.1f} MW<extra></extra>",
            },
            {
              type: "scatter",
              mode: "lines",
              x: dsTime,
              y: dsPActual,
              name: "Actual",
              line: { color: SCADA_COLORS.ENERGIZED, width: 2 },
              hovertemplate: "t=%{x:.0f}s<br>Actual: %{y:.1f} MW<extra></extra>",
            },
          ]}
          layout={{
            ...DARK_PLOTLY_LAYOUT,
            height: 400,
            xaxis: {
              ...DARK_PLOTLY_LAYOUT.xaxis,
              title: "Time [s]",
            },
            yaxis: {
              ...DARK_PLOTLY_LAYOUT.yaxis,
              title: "Active Power [MW]",
              rangemode: "tozero" as const,
            },
            legend: {
              ...DARK_PLOTLY_LAYOUT.legend,
              orientation: "h" as const,
              x: 0.5,
              xanchor: "center" as const,
              y: 1.12,
            },
            shapes: [
              // Ramp time marker
              {
                type: "line" as const,
                x0: ramp_time_s,
                x1: ramp_time_s,
                y0: 0,
                y1: 1,
                yref: "paper" as const,
                line: {
                  color: SCADA_COLORS.VOLTAGE_220KV,
                  width: 1,
                  dash: "dot" as const,
                },
              },
            ],
            annotations: [
              {
                x: ramp_time_s,
                y: 1.05,
                yref: "paper" as const,
                text: `t=${ramp_time_s.toFixed(0)}s`,
                showarrow: false,
                font: { size: 11, color: SCADA_COLORS.VOLTAGE_220KV },
              },
            ],
          }}
          config={PLOTLY_CONFIG}
          className="w-full"
        />
      </div>

      {/* ── Two-Column: Voltage/Q + WTG Dispatch ─────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Voltage & Reactive Power */}
        <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
          <h3 className="text-base font-semibold text-text-primary mb-2">
            PCC Voltage & Reactive Power
          </h3>
          <Plot
            data={[
              {
                type: "scatter",
                mode: "lines",
                x: dsTime,
                y: dsVoltage,
                name: "V_pcc [pu]",
                line: { color: SCADA_COLORS.VOLTAGE_220KV, width: 2 },
                hovertemplate: "t=%{x:.0f}s<br>V=%{y:.4f} pu<extra></extra>",
              },
              {
                type: "scatter",
                mode: "lines",
                x: dsTime,
                y: dsQ,
                name: "Q [MVAR]",
                yaxis: "y2",
                line: { color: SCADA_COLORS.EARTHED, width: 2 },
                hovertemplate: "t=%{x:.0f}s<br>Q=%{y:.1f} MVAR<extra></extra>",
              },
            ]}
            layout={{
              ...DARK_PLOTLY_LAYOUT,
              height: 380,
              xaxis: {
                ...DARK_PLOTLY_LAYOUT.xaxis,
                title: "Time [s]",
              },
              yaxis: {
                ...DARK_PLOTLY_LAYOUT.yaxis,
                title: "Voltage [p.u.]",
                side: "left" as const,
              },
              yaxis2: {
                ...DARK_PLOTLY_LAYOUT.yaxis,
                title: "Q [MVAR]",
                overlaying: "y" as const,
                side: "right" as const,
              },
              legend: {
                ...DARK_PLOTLY_LAYOUT.legend,
                orientation: "h" as const,
                x: 0.5,
                xanchor: "center" as const,
                y: 1.12,
              },
              shapes: [
                // PSE voltage limits
                {
                  type: "line" as const,
                  x0: 0,
                  x1: 1,
                  xref: "paper" as const,
                  y0: 1.05,
                  y1: 1.05,
                  line: {
                    color: SCADA_COLORS.FAULT,
                    width: 1,
                    dash: "dot" as const,
                  },
                },
                {
                  type: "line" as const,
                  x0: 0,
                  x1: 1,
                  xref: "paper" as const,
                  y0: 0.95,
                  y1: 0.95,
                  line: {
                    color: SCADA_COLORS.FAULT,
                    width: 1,
                    dash: "dot" as const,
                  },
                },
              ],
            }}
            config={PLOTLY_CONFIG}
            className="w-full"
          />
        </div>

        {/* WTG Pro-Rata Dispatch */}
        <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
          <h3 className="text-base font-semibold text-text-primary mb-2">
            WTG Pro-Rata Dispatch
          </h3>
          <Plot
            data={[
              {
                type: "bar",
                x: wtgIds,
                y: wtgDispatched,
                name: "Dispatched",
                marker: { color: SCADA_COLORS.ENERGIZED },
                hovertemplate: "%{x}<br>P=%{y:.2f} MW<extra></extra>",
              },
              {
                type: "bar",
                x: wtgIds,
                y: wtgCurtailed,
                name: "Curtailed",
                marker: { color: SCADA_COLORS.WARNING, opacity: 0.6 },
                hovertemplate: "%{x}<br>Curt=%{y:.2f} MW<extra></extra>",
              },
            ]}
            layout={{
              ...DARK_PLOTLY_LAYOUT,
              height: 380,
              barmode: "stack" as const,
              xaxis: {
                ...DARK_PLOTLY_LAYOUT.xaxis,
                tickangle: -45,
                tickfont: { size: 11, color: "rgb(148, 163, 184)" },
              },
              yaxis: {
                ...DARK_PLOTLY_LAYOUT.yaxis,
                title: "Power [MW]",
                range: [0, 16],
              },
              legend: {
                ...DARK_PLOTLY_LAYOUT.legend,
                orientation: "h" as const,
                x: 0.5,
                xanchor: "center" as const,
                y: 1.12,
              },
              shapes: [
                // Rated power line
                {
                  type: "line" as const,
                  x0: 0,
                  x1: 1,
                  xref: "paper" as const,
                  y0: 15,
                  y1: 15,
                  line: {
                    color: "rgba(255,255,255,0.2)",
                    width: 1,
                    dash: "dot" as const,
                  },
                },
              ],
            }}
            config={PLOTLY_CONFIG}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
