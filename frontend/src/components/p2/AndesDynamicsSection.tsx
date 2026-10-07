/**
 * ANDES RMS simulation of the plant (WECC REGCA1/REECA1/REPCA1) against an
 * over-frequency (LFSM-O) or a fault at the POC (FRT). Runs on demand: the
 * backend needs 4–12 s per event.
 */

import Plot from "react-plotly.js";

import { andesDynamicsEducation } from "../../constants/education/p2";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { useDynamicsStore } from "../../store/n1SecurityStore";
import type { DynamicsEvent, DynamicsResponse } from "../../types/n1Security";
import { ChartWrapper } from "../ui/ChartWrapper";
import { EducationButton } from "../ui/EducationButton";
import { KPICard } from "../ui/KPICard";
import { Slider } from "../ui/Slider";
import { useNetwork } from "../../store/gridStore";

const T_EVENT = 1.0;
// PSE type D FRT profile at the POC (same as the Grid tab): 0 p.u. for 150 ms, 0.85 p.u. at 2.5 s
const FRT_T = [0, 0.15, 2.5].map((t) => t + T_EVENT);
const FRT_U = [0, 0, 0.85];

const EVENTS: [string, DynamicsEvent][] = [
  ["Over-frequency (LFSM-O)", "frequency"],
  ["Fault at the POC (FRT)", "fault"],
];

function kpis(r: DynamicsResponse) {
  if (r.event === "frequency") {
    return [
      { label: "Peak frequency", value: r.f_max_hz?.toFixed(2) ?? "—", unit: "Hz", note: `settles at ${r.f_final_hz?.toFixed(2)} Hz` },
      { label: "Steady ΔP (ANDES)", value: r.dp_final_mw?.toFixed(1) ?? "—", unit: "MW", note: `5 % droop formula: ${r.dp_expected_final_mw?.toFixed(1)} MW` },
      { label: "Response delay", value: r.response_delay_s?.toFixed(1) ?? "—", unit: "s", note: "f > 50.2 Hz → −1 % P · NC RfG: > 2 s must be justified" },
      { label: "Lowest output", value: r.p_min_mw?.toFixed(0) ?? "—", unit: "MW", note: `from ${r.p0_mw.toFixed(0)} MW` },
    ];
  }
  return [
    { label: "Retained POC voltage", value: r.retained_voltage_pu?.toFixed(2) ?? "—", unit: "p.u.", note: "150 ms three-phase fault" },
    { label: "Peak reactive current", value: r.iq_max_pu?.toFixed(2) ?? "—", unit: "p.u.", note: "Kqv = 2, limit 1.1 p.u." },
    { label: "P back to 90 %", value: r.p_recovery_s?.toFixed(2) ?? "—", unit: "s", note: `after clearance · PSE: ≤ ${r.recovery_limit_s} s` },
    { label: "FRT", value: r.stayed_connected ? "Rode through" : "Below profile", note: "U at POC vs PSE type D profile" },
  ];
}

export default function AndesDynamicsSection() {
  const n = useNetwork();
  const { event, load_trip_mw, retained_voltage_pu, result: r, loading, error, setParams, run } = useDynamicsStore();
  const c = useChartPalette();
  const shown = r && r.event === event ? r : null;
  const s = shown?.series ?? [];
  const t = s.map((p) => p.t);
  const isFreq = shown?.event === "frequency";
  const xRange = isFreq ? [0, 20] : [0.6, 3.5];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border-primary bg-bg-secondary p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-text-secondary">RMS simulation · ANDES · WECC generic models</p>
            <div className="flex flex-wrap gap-1">
              {EVENTS.map(([label, e]) => (
                <button
                  key={e}
                  aria-pressed={event === e}
                  onClick={() => setParams({ event: e })}
                  className={`rounded px-2 py-1 text-[11px] font-medium ${event === e ? "bg-accent text-white" : "text-text-secondary hover:bg-bg-tertiary"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {event === "frequency" ? (
            <Slider
              label="Load lost in the area at t = 1 s"
              value={load_trip_mw}
              display={`${load_trip_mw.toFixed(0)} MW`}
              min={1000}
              max={4000}
              step={500}
              onChange={(v) => setParams({ load_trip_mw: v })}
            />
          ) : (
            <Slider
              label="Retained POC voltage during the fault"
              value={retained_voltage_pu}
              display={`${retained_voltage_pu.toFixed(2)} p.u.`}
              min={0.05}
              max={0.8}
              step={0.05}
              onChange={(v) => setParams({ retained_voltage_pu: v })}
            />
          )}
          <button
            onClick={() => void run()}
            disabled={loading}
            className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Simulating…" : "Run simulation"}
          </button>
          <span className="ml-auto">
            <EducationButton content={andesDynamicsEducation} />
          </span>
        </div>
        {error && <p className="text-xs text-status-alarm">{error}</p>}
      </div>

      {shown && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kpis(shown).map((k) => (
              <KPICard key={k.label} label={k.label} value={k.value} unit={k.unit} trendValue={k.note} />
            ))}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <ChartWrapper
              title={isFreq ? "Frequency at the POC" : "POC voltage against the PSE FRT profile"}
              footer={
                isFreq
                  ? "An area equivalent (20 GVA, H = 5 s, 5 % governors) loses load at t = 1 s. It stands in for a disturbance; it is not a model of Continental Europe."
                  : "The plant must stay connected while the POC voltage stays above the profile (0 p.u. for 150 ms, 0.85 p.u. at 2.5 s). A bolted fault (0 p.u.) is not solvable in RMS, so 0.05 p.u. is the deepest dip."
              }
            >
              <Plot
                data={[
                  {
                    type: "scatter",
                    mode: "lines",
                    name: isFreq ? "Frequency" : "POC voltage",
                    x: t,
                    y: s.map((p) => (isFreq ? p.f_hz : p.v_poc)),
                    line: { color: c.blue, width: 2 },
                    hovertemplate: isFreq ? "%{y:.3f} Hz at %{x:.2f} s<extra></extra>" : "%{y:.3f} p.u. at %{x:.3f} s<extra></extra>",
                  },
                  ...(isFreq
                    ? []
                    : [
                        {
                          type: "scatter" as const,
                          mode: "lines" as const,
                          name: "PSE type D profile",
                          x: [...FRT_T, 3.5],
                          y: [...FRT_U, 0.85],
                          line: { color: c.red, width: 1.5, dash: "dash" as const, shape: "linear" as const },
                          hovertemplate: "profile %{y:.2f} p.u.<extra></extra>",
                        },
                      ]),
                ]}
                layout={{
                  ...DARK_PLOTLY_LAYOUT,
                  transition: CHART_TRANSITION,
                  legend: { orientation: "h", y: 1.02, yanchor: "bottom", x: 0, font: { size: 11 } },
                  margin: { t: 48, r: 16, b: 44, l: 60 },
                  xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Time [s]", font: { size: 12 } }, range: xRange },
                  yaxis: {
                    ...DARK_PLOTLY_LAYOUT.yaxis,
                    title: { text: isFreq ? "Frequency [Hz]" : "Voltage [p.u.]", font: { size: 12 } },
                    ...(isFreq ? {} : { range: [0, 1.15] }),
                  },
                  shapes: isFreq
                    ? [{ type: "line", xref: "paper", yref: "y", x0: 0, x1: 1, y0: 50.2, y1: 50.2, line: { color: c.ref, width: 1, dash: "dash" } }]
                    : [],
                  annotations: isFreq
                    ? [{ xref: "paper", yref: "y", x: 1, y: 50.2, xanchor: "right", yanchor: "bottom", text: "LFSM-O threshold 50.2 Hz", showarrow: false, font: { size: 10, color: c.ref } }]
                    : [],
                }}
                config={PLOTLY_CONFIG}
                useResizeHandler
                className="w-full"
                style={{ height: 300 }}
              />
            </ChartWrapper>
            <ChartWrapper
              title={isFreq ? "Plant active power" : `Plant response (p.u. of ${n.total_capacity_mw.toFixed(0)} MW)`}
              footer={
                isFreq
                  ? "REPCA1 frequency droop: 5 % of Pmax above 50.2 Hz (PSE). The dashed line is the static droop characteristic of the frequency at each instant — the plant follows it with its plant-controller lag."
                  : "REECA1 switches to reactive-current priority below 0.85 p.u. and injects Iq = Kqv·ΔV; active current gives way and ramps back after clearance."
              }
            >
              <Plot
                data={
                  isFreq
                    ? [
                        {
                          type: "scatter",
                          mode: "lines",
                          name: "ANDES (REPCA1)",
                          x: t,
                          y: s.map((p) => p.p_mw),
                          line: { color: c.blue, width: 2 },
                          hovertemplate: "%{y:.1f} MW at %{x:.2f} s<extra></extra>",
                        },
                        {
                          type: "scatter",
                          mode: "lines",
                          name: "Static 5 % droop",
                          x: t,
                          y: s.map((p) => p.p_expected_mw),
                          line: { color: c.ink, width: 1.5, dash: "dash" },
                          hovertemplate: "droop %{y:.1f} MW<extra></extra>",
                        },
                      ]
                    : [
                        {
                          type: "scatter",
                          mode: "lines",
                          name: "Active power P",
                          x: t,
                          y: s.map((p) => p.p_mw / n.total_capacity_mw),
                          line: { color: c.blue, width: 2 },
                          hovertemplate: "P %{y:.2f} p.u. at %{x:.3f} s<extra></extra>",
                        },
                        {
                          type: "scatter",
                          mode: "lines",
                          name: "Reactive current Iq",
                          x: t,
                          y: s.map((p) => p.iq_pu),
                          line: { color: c.orange, width: 2 },
                          hovertemplate: "Iq %{y:.2f} p.u. at %{x:.3f} s<extra></extra>",
                        },
                      ]
                }
                layout={{
                  ...DARK_PLOTLY_LAYOUT,
                  transition: CHART_TRANSITION,
                  legend: { orientation: "h", y: 1.02, yanchor: "bottom", x: 0, font: { size: 11 } },
                  margin: { t: 48, r: 16, b: 44, l: 60 },
                  xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Time [s]", font: { size: 12 } }, range: xRange },
                  yaxis: {
                    ...DARK_PLOTLY_LAYOUT.yaxis,
                    title: { text: isFreq ? "Power [MW]" : `Per unit of ${n.total_capacity_mw.toFixed(0)} MVA`, font: { size: 12 } },
                    ...(isFreq ? {} : { range: [-0.1, 1.25] }),
                  },
                }}
                config={PLOTLY_CONFIG}
                useResizeHandler
                className="w-full"
                style={{ height: 300 }}
              />
            </ChartWrapper>
          </div>
        </>
      )}
      {!shown && !loading && (
        <p className="text-xs text-text-secondary">Choose an event and run the simulation (4–12 s on the server).</p>
      )}
    </div>
  );
}
