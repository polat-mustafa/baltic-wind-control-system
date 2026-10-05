/**
 * PPC tab — set the TSO command, wind, reactive mode and a grid event; the
 * simulation re-runs and the panels show how the plant responds:
 *
 *   controls · control-loop diagram · PSE checks
 *   active power | frequency
 *   reactive power | POC voltage
 *   pro-rata dispatch to the 34 turbines
 */

import { useEffect } from "react";
import { motion, MotionConfig } from "framer-motion";
import Plot from "react-plotly.js";

import { powerPlantControllerEducation } from "../../constants/education/p2";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { PPC_EVENTS, type PPCEvent, usePPCStore } from "../../store/ppcStore";
import type { ActivePowerMode, ReactivePowerMode } from "../../types/ppc";
import { ChartWrapper } from "../ui/ChartWrapper";
import { EducationButton } from "../ui/EducationButton";
import PPCControlDiagram from "./PPCControlDiagram";

const P_MODES: [ActivePowerMode, string][] = [
  ["power_reference", "P set-point"],
  ["delta_control", "Delta reserve"],
  ["absolute_limitation", "Absolute limit"],
  ["ramp_rate_control", "Ramp control"],
];
const Q_MODES: [ReactivePowerMode, string][] = [
  ["voltage_control", "Voltage (slope)"],
  ["reactive_power", "Q set-point"],
  ["power_factor", "Power factor"],
  ["q_v_droop", "Q(V) droop"],
];
const PF_OPTIONS: [number, string][] = [
  [1, "1.00"],
  [0.98, "0.98 producing"],
  [0.95, "0.95 producing"],
  [-0.98, "0.98 absorbing"],
  [-0.95, "0.95 absorbing"],
];
const T_COMMAND = 10;
const T_EVENT = 60;

function Tabs<T extends string>({ items, value, onChange, label }: { items: [T, string][]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1">
      {items.map(([k, l]) => (
        <button
          key={k}
          role="tab"
          aria-selected={value === k}
          onClick={() => onChange(k)}
          className={`rounded px-2 py-1 text-[11px] font-medium ${value === k ? "bg-accent text-white" : "text-text-secondary hover:bg-bg-tertiary"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function Slider(p: { label: string; value: number; min: number; max: number; step: number; unit: string; digits?: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-0.5 text-[11px] text-text-muted min-w-[9rem] flex-1">
      <span className="flex justify-between">
        {p.label}
        <span className="font-mono text-text-primary">
          {p.value.toFixed(p.digits ?? 0)} {p.unit}
        </span>
      </span>
      <input type="range" min={p.min} max={p.max} step={p.step} value={p.value} onChange={(e) => p.onChange(Number(e.target.value))} className="accent-accent" />
    </label>
  );
}

function Check({ pass, children }: { pass: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-1.5">
      <span aria-label={pass ? "pass" : "fail"} className={pass ? "text-status-normal" : "text-status-alarm"}>
        {pass ? "✓" : "✗"}
      </span>
      <span>{children}</span>
    </li>
  );
}

function Controls() {
  const s = usePPCStore();
  return (
    <div className="rounded-lg border border-border-primary bg-bg-secondary p-4 space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-text-secondary">TSO active-power command (arrives at t = {T_COMMAND} s)</p>
          <Tabs label="Active power mode" items={P_MODES} value={s.activePowerMode} onChange={s.setActivePowerMode} />
          <div className="flex flex-wrap gap-3">
            {(s.activePowerMode === "power_reference" || s.activePowerMode === "ramp_rate_control") && (
              <Slider label="Set-point" value={s.powerSetpointMW} min={0} max={510} step={10} unit="MW" onChange={s.setPowerSetpointMW} />
            )}
            {s.activePowerMode === "ramp_rate_control" && (
              <Slider label="Ramp rate" value={s.rampRateMWPerMin} min={10} max={510} step={10} unit="MW/min" onChange={s.setRampRateMWPerMin} />
            )}
            {s.activePowerMode === "delta_control" && (
              <Slider label="Reserve held" value={s.deltaReserveMW} min={0} max={100} step={5} unit="MW" onChange={s.setDeltaReserveMW} />
            )}
            {s.activePowerMode === "absolute_limitation" && (
              <Slider label="Limit" value={s.absoluteLimitMW} min={0} max={510} step={10} unit="MW" onChange={s.setAbsoluteLimitMW} />
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Slider label="Wind at hub" value={s.windSpeedMS} min={0} max={30} step={0.5} unit="m/s" digits={1} onChange={s.setWindSpeedMS} />
            <Slider label="Turbines online" value={s.availableTurbines} min={0} max={34} step={1} unit="/ 34" onChange={s.setAvailableTurbines} />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-text-secondary">Reactive power at the POC</p>
          <Tabs label="Reactive power mode" items={Q_MODES} value={s.reactivePowerMode} onChange={s.setReactivePowerMode} />
          <div className="flex flex-wrap gap-3">
            {(s.reactivePowerMode === "voltage_control" || s.reactivePowerMode === "q_v_droop") && (
              <Slider label="V reference" value={s.voltageSetpointPU} min={0.95} max={1.05} step={0.01} unit="pu" digits={2} onChange={s.setVoltageSetpointPU} />
            )}
            {s.reactivePowerMode === "reactive_power" && (
              <Slider label="Q set-point" value={s.reactiveSetpointMVAR} min={-200} max={200} step={10} unit="MVAR" onChange={s.setReactiveSetpointMVAR} />
            )}
            {s.reactivePowerMode === "power_factor" && (
              <label className="flex flex-col gap-0.5 text-[11px] text-text-muted">
                Power factor
                <select
                  value={s.powerFactor}
                  onChange={(e) => s.setPowerFactor(Number(e.target.value))}
                  className="rounded border border-border-primary bg-bg-primary px-1.5 py-1 text-xs text-text-primary"
                >
                  {PF_OPTIONS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <label className="flex flex-col gap-0.5 text-[11px] text-text-muted max-w-xs">
            Grid event at t = {T_EVENT} s
            <select
              value={s.event}
              onChange={(e) => s.setEvent(e.target.value as PPCEvent)}
              className="rounded border border-border-primary bg-bg-primary px-1.5 py-1 text-xs text-text-primary"
            >
              {(Object.keys(PPC_EVENTS) as PPCEvent[]).map((k) => (
                <option key={k} value={k}>
                  {PPC_EVENTS[k].label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {s.loading && <p className="text-[11px] text-text-muted">simulating…</p>}
    </div>
  );
}

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

export default function PPCDashboard() {
  const store = usePPCStore();
  const { simulation: sim, runSimulation } = store;
  const c = useChartPalette();

  // Re-run whenever an input changes (debounced); the first run happens on mount
  const key = [
    store.activePowerMode, store.powerSetpointMW, store.deltaReserveMW, store.absoluteLimitMW, store.rampRateMWPerMin,
    store.windSpeedMS, store.availableTurbines, store.reactivePowerMode, store.voltageSetpointPU,
    store.reactiveSetpointMVAR, store.powerFactor, store.event,
  ].join("|");
  useEffect(() => {
    const id = setTimeout(() => void runSimulation(), 350);
    return () => clearTimeout(id);
  }, [key, runSimulation]);

  if (!sim?.time_series.length) {
    return (
      <div className="space-y-4">
        <Controls />
        <p className="text-sm text-text-muted">Simulating the plant controller…</p>
      </div>
    );
  }

  const ts = sim.time_series;
  const t = ts.map((p) => p.time_s);
  const tEnd = t[t.length - 1];
  const markers = [
    { type: "line", xref: "x", yref: "paper", x0: T_COMMAND, x1: T_COMMAND, y0: 0, y1: 1, line: { color: c.ref, width: 1, dash: "dot" } } as const,
    { type: "line", xref: "x", yref: "paper", x0: T_EVENT, x1: T_EVENT, y0: 0, y1: 1, line: { color: c.ref, width: 1, dash: "dot" } } as const,
  ];
  const markerText = [
    { x: T_COMMAND, y: 1, xref: "x", yref: "paper", yanchor: "bottom", text: "TSO command", showarrow: false, font: { size: 10 } } as const,
    { x: T_EVENT, y: 1, xref: "x", yref: "paper", yanchor: "bottom", text: "grid event", showarrow: false, font: { size: 10 } } as const,
  ];
  const base = {
    ...DARK_PLOTLY_LAYOUT,
    transition: CHART_TRANSITION,
    legend: { orientation: "h" as const, y: 1.2, x: 0, font: { size: 11 } },
    xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, range: [0, tEnd], title: { text: "Time [s]", font: { size: 12 } } },
    shapes: markers,
    annotations: markerText,
    margin: { t: 44, r: 12, b: 44, l: 60 },
  };
  const line = (name: string, y: number[], color: string, unit: string, dash?: "dash" | "dot") => ({
    type: "scatter" as const,
    mode: "lines" as const,
    name,
    x: t,
    y,
    line: { color, width: 2, dash },
    hovertemplate: `${name}: %{y:.2f} ${unit} at %{x:.1f} s<extra></extra>`,
  });
  const ev = PPC_EVENTS[store.event];
  const plotProps = { config: PLOTLY_CONFIG, useResizeHandler: true, className: "w-full", style: { height: 280 } };

  return (
    <MotionConfig reducedMotion="user">
      <motion.div className="space-y-4" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }}>
        <motion.div variants={item}>
          <Controls />
        </motion.div>

        <motion.div variants={item} className="grid grid-cols-1 xl:grid-cols-[1fr_20rem] gap-4">
          <div className="rounded-lg border border-border-primary bg-bg-secondary p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold text-text-primary">How the PPC controls the plant</h3>
              <EducationButton content={powerPlantControllerEducation} />
            </div>
            <div className="overflow-x-auto">
              <PPCControlDiagram sim={sim} />
            </div>
          </div>
          <div className="rounded-lg border border-border-primary bg-bg-secondary p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-2">PSE requirements (NC RfG, 2018)</h3>
            <ul className="space-y-2 text-xs text-text-secondary">
              <Check pass={sim.setpoint_accuracy_compliant}>
                Set-point {sim.tso_power_setpoint_mw.toFixed(0)} MW reached within 2 % in {sim.ramp_time_s.toFixed(0)} s (≤ 15 min) · Art. 15(2)(a)
              </Check>
              {ev.frequency !== undefined && (
                <Check pass={sim.frequency_response_compliant}>
                  {ev.frequency > 50 ? "LFSM-O" : "LFSM-U / FSM"}: droop asks {sim.frequency_response_expected_mw.toFixed(1)} MW, plant gives{" "}
                  {sim.frequency_response_actual_mw.toFixed(1)} MW after 30 s · Art. 13(2), 15(2)
                </Check>
              )}
              {ev.voltageStep !== undefined && (
                <Check pass={sim.q_response_compliant}>
                  90 % of the Q change in {sim.q_response_90_s.toFixed(1)} s (≤ 5 s) · Art. 21(3)(d)(iv)
                </Check>
              )}
              <Check pass={sim.voltage_compliant}>POC voltage kept within 0.95–1.05 pu (planning band)</Check>
              <li className="text-text-muted pt-1">
                Ramp limit 10 % P<sub>max</sub>/min is a plant setting; PSE requires the capability to ramp 90–100 %/min (Art. 15(6)(e)). Fast Q
                range used: {sim.q_range_mvar[0]?.toFixed(0)} … +{sim.q_range_mvar[1]?.toFixed(0)} MVAR.
              </li>
            </ul>
          </div>
        </motion.div>

        <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartWrapper title="Active power" headerRight={<EducationButton content={powerPlantControllerEducation} />}>
            <Plot
              data={[
                line("Available", ts.map((p) => p.available_power_mw), c.ref, "MW", "dot"),
                line("PPC set-point", ts.map((p) => p.power_setpoint_mw), c.orange, "MW", "dash"),
                line("Plant output", ts.map((p) => p.power_actual_mw), c.blue, "MW"),
              ]}
              layout={{ ...base, yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "P [MW]", font: { size: 12 } }, rangemode: "tozero" } }}
              {...plotProps}
            />
          </ChartWrapper>
          <ChartWrapper title="Grid frequency">
            <Plot
              data={[line("Frequency", ts.map((p) => p.frequency_hz), c.blue, "Hz")]}
              layout={{
                ...base,
                showlegend: false,
                yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "f [Hz]", font: { size: 12 } }, range: [49.4, 50.6] },
                shapes: [
                  ...markers,
                  { type: "rect", xref: "paper", x0: 0, x1: 1, y0: 49.8, y1: 50.2, fillcolor: c.band, line: { width: 0 }, layer: "below" } as const,
                ],
                annotations: [
                  ...markerText,
                  { xref: "paper", x: 1, y: 50.2, xanchor: "right", yanchor: "bottom", text: "LFSM-O 50.2 Hz", showarrow: false, font: { size: 10 } } as const,
                  { xref: "paper", x: 1, y: 49.8, xanchor: "right", yanchor: "top", text: "LFSM-U 49.8 Hz", showarrow: false, font: { size: 10 } } as const,
                ],
              }}
              {...plotProps}
            />
          </ChartWrapper>
          <ChartWrapper title="Reactive power at the POC">
            <Plot
              data={[
                line("Q reference", ts.map((p) => p.q_setpoint_mvar), c.orange, "MVAR", "dash"),
                line("Q delivered", ts.map((p) => p.q_actual_mvar), c.blue, "MVAR"),
              ]}
              layout={{ ...base, yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "Q [MVAR], producing +", font: { size: 12 } } } }}
              {...plotProps}
            />
          </ChartWrapper>
          <ChartWrapper title="Voltage at the POC (PSE 400 kV)">
            <Plot
              data={[line("V POC", ts.map((p) => p.voltage_pcc_pu), c.blue, "pu")]}
              layout={{
                ...base,
                showlegend: false,
                yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "V [pu]", font: { size: 12 } }, range: [0.94, 1.06] },
                shapes: [
                  ...markers,
                  { type: "rect", xref: "paper", x0: 0, x1: 1, y0: 0.95, y1: 1.05, fillcolor: c.band, line: { width: 0 }, layer: "below" } as const,
                ],
              }}
              {...plotProps}
            />
          </ChartWrapper>
        </motion.div>

        <motion.div variants={item}>
          <ChartWrapper
            title="Pro-rata dispatch to the 34 turbines (end of simulation)"
            footer={`${sim.final_power_mw.toFixed(0)} MW dispatched · ${sim.total_curtailment_mw.toFixed(0)} MW curtailed of ${sim.total_available_mw.toFixed(0)} MW available — every turbine curtailed by the same fraction`}
          >
            <Plot
              data={[
                {
                  type: "bar",
                  name: "Dispatched",
                  x: sim.wtg_dispatch.map((w) => w.wtg_id.replace("WTG_", "")),
                  y: sim.wtg_dispatch.map((w) => w.dispatched_power_mw),
                  marker: { color: c.blue },
                  hovertemplate: "WTG %{x}: %{y:.2f} MW<extra></extra>",
                },
                {
                  type: "bar",
                  name: "Curtailed",
                  x: sim.wtg_dispatch.map((w) => w.wtg_id.replace("WTG_", "")),
                  y: sim.wtg_dispatch.map((w) => w.curtailment_mw),
                  marker: { color: c.orange },
                  hovertemplate: "WTG %{x}: %{y:.2f} MW curtailed<extra></extra>",
                },
              ]}
              layout={{
                ...DARK_PLOTLY_LAYOUT,
                transition: CHART_TRANSITION,
                barmode: "stack",
                bargap: 0.25,
                legend: { orientation: "h", y: 1.15, x: 0, font: { size: 11 } },
                xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, type: "category", title: { text: "Turbine", font: { size: 12 } }, tickfont: { size: 10 } },
                yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "P [MW]", font: { size: 12 } }, range: [0, 16] },
                margin: { t: 36, r: 12, b: 48, l: 56 },
              }}
              config={PLOTLY_CONFIG}
              useResizeHandler
              className="w-full"
              style={{ height: 260 }}
            />
          </ChartWrapper>
        </motion.div>
      </motion.div>
    </MotionConfig>
  );
}
