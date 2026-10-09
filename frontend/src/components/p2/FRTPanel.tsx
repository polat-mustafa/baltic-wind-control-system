/**
 * Fault ride-through — voltage against the PSE profile, then power and
 * reactive current, for a fault the user places and sizes.
 *
 * Changing a control re-runs the (fast) backend model; the new traces are
 * swept in left to right like an oscilloscope (skipped with reduced motion).
 */

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import Plot from "react-plotly.js";

import { faultRideThroughEducation } from "../../constants/education/p2";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useChartPalette } from "../../hooks/useChartPalette";
import { useGridStore } from "../../store/gridStore";
import type { FaultBus } from "../../types/grid";
import { ChartWrapper } from "../ui/ChartWrapper";
import { EducationButton } from "../ui/EducationButton";

const FAULT_BUSES: [FaultBus, string][] = [
  ["PSE_400kV", "PSE 400 kV (grid fault)"],
  ["Onshore_220kV", "Onshore 220 kV"],
  ["OSS_220kV", "Offshore 220 kV"],
  ["OSS_66kV", "Offshore 66 kV (internal)"],
];
const SWEEP_MS = 1200;

/** Reveal 0 → n points over SWEEP_MS whenever `key` changes. */
function useSweep(n: number, key: unknown): number {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(n);
  const raf = useRef(0);
  useEffect(() => {
    if (reduce || n === 0) {
      setShown(n);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const f = Math.min((now - start) / SWEEP_MS, 1);
      setShown(Math.max(2, Math.round(f * n)));
      if (f < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [key, n, reduce]);
  return shown;
}

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-xs text-text-muted min-w-[9rem] flex-1">
      <span className="flex justify-between">
        {props.label}
        <span className="font-mono text-text-primary">{props.format(props.value)}</span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="accent-accent"
      />
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

export default function FRTPanel() {
  const { frtResult: r, frtType, frtParams, frtLoading, setFrtType, setFrtParams, runFrt } = useGridStore();
  const c = useChartPalette();

  // Re-run 300 ms after the last control change
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = setTimeout(() => void runFrt(), 300);
    return () => clearTimeout(id);
  }, [frtType, frtParams, runFrt]);

  const n = r?.time_series.length ?? 0;
  const shown = useSweep(n, r);
  if (!r || n === 0) return null;

  const pts = r.time_series.slice(0, shown);
  const t = pts.map((p) => p.time_s);
  const lvrt = r.frt_type === "lvrt";
  const tEnd = r.time_series[n - 1].time_s;
  const tFault = r.envelope[0]?.time_s ?? 0.2; // backend pre-fault window is 0.2 s
  const endOfEvent = [...r.time_series].reverse().find((p) => p.time_s < tFault + r.fault_duration_s);
  const xaxis = { ...DARK_PLOTLY_LAYOUT.xaxis, range: [0, tEnd], title: { text: "Time [s]", font: { size: 12 } } };
  const envT = r.envelope.map((e) => e.time_s);
  const envV = r.envelope.map((e) => e.voltage_pu);
  const pPre = r.time_series[0].active_power_mw;

  return (
    <ChartWrapper
      title={lvrt ? "Fault ride-through — PSE type-D profile" : "Overvoltage ride-through (illustrative)"}
      headerRight={<EducationButton content={faultRideThroughEducation} />}
      footer="Quasi-static phasor screening model: radial chain, WTGs aggregated at 66 kV, STATCOM at 220 kV, K-characteristic with Iq priority, 1.0 pu current limit"
    >
      <div className="flex flex-wrap items-end gap-3 mb-2" aria-busy={frtLoading}>
        <div role="tablist" aria-label="Event type" className="flex gap-1">
          {(["lvrt", "hvrt"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={frtType === k}
              onClick={() => setFrtType(k)}
              className={`rounded px-2 py-1 text-xs font-medium ${frtType === k ? "bg-accent text-accent-ink" : "text-text-secondary hover:bg-bg-tertiary"}`}
            >
              {k === "lvrt" ? "LVRT · fault" : "HVRT · swell"}
            </button>
          ))}
        </div>
        {frtType === "lvrt" && (
          <label className="flex flex-col gap-0.5 text-xs text-text-muted">
            Fault location
            <select
              value={frtParams.faultBus}
              onChange={(e) => setFrtParams({ faultBus: e.target.value as FaultBus })}
              className="rounded border border-border-primary bg-bg-primary px-1.5 py-1 text-xs text-text-primary"
            >
              {FAULT_BUSES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        )}
        {frtType === "lvrt" && (
          <Slider
            label="Fault impedance (100 MVA)"
            value={frtParams.faultImpedancePu}
            min={0}
            max={0.05}
            step={0.001}
            format={(v) => (v === 0 ? "bolted" : `${v.toFixed(3)} pu`)}
            onChange={(v) => setFrtParams({ faultImpedancePu: v })}
          />
        )}
        <Slider
          label="Duration"
          value={frtParams.faultDurationS}
          min={0.05}
          max={0.5}
          step={0.01}
          format={(v) => `${(v * 1000).toFixed(0)} ms`}
          onChange={(v) => setFrtParams({ faultDurationS: v })}
        />
        <Slider
          label="K factor (PSE 2–10)"
          value={frtParams.kFactor}
          min={2}
          max={10}
          step={0.5}
          format={(v) => v.toFixed(1)}
          onChange={(v) => setFrtParams({ kFactor: v })}
        />
        {frtLoading && <span className="text-xs text-text-muted">simulating…</span>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_16rem] gap-3">
        <div>
          <Plot
            data={[
              ...(lvrt
                ? [
                    {
                      type: "scatter" as const,
                      mode: "lines" as const,
                      name: "PSE profile (may disconnect below)",
                      x: [...envT, tEnd, envT[0]],
                      y: [...envV, 0, 0],
                      fill: "toself" as const,
                      fillcolor: c.band,
                      line: { color: c.ink, width: 1.5, dash: "dash" as const },
                      hoverinfo: "skip" as const,
                    },
                  ]
                : []),
              {
                type: "scatter" as const,
                mode: "lines" as const,
                name: "POC 400 kV",
                x: t,
                y: pts.map((p) => p.voltage_pu),
                line: { color: c.blue, width: 2 },
                hovertemplate: "POC %{y:.3f} pu at %{x:.3f} s<extra></extra>",
              },
              {
                type: "scatter" as const,
                mode: "lines" as const,
                name: "WTG terminals 66 kV",
                x: t,
                y: pts.map((p) => p.terminal_voltage_pu),
                line: { color: c.orange, width: 2 },
                hovertemplate: "Terminals %{y:.3f} pu at %{x:.3f} s<extra></extra>",
              },
            ]}
            layout={{
              ...DARK_PLOTLY_LAYOUT,
              showlegend: true,
              legend: { orientation: "h", y: 1.18, x: 0, font: { size: 11 } },
              xaxis: { ...xaxis, title: undefined },
              yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "Voltage [pu]", font: { size: 12 } }, range: [0, lvrt ? 1.3 : 1.45] },
              shapes: [
                { type: "line", xref: "x", yref: "paper", x0: tFault, x1: tFault, y0: 0, y1: 1, line: { color: c.ref, width: 1, dash: "dot" } } as const,
              ],
              margin: { t: 40, r: 12, b: 24, l: 56 },
            }}
            config={PLOTLY_CONFIG}
            useResizeHandler
            className="w-full"
            style={{ height: 260 }}
          />
          <Plot
            data={[
              {
                type: "scatter",
                mode: "lines",
                name: "WTG active power [MW]",
                x: t,
                y: pts.map((p) => p.active_power_mw),
                line: { color: c.blue, width: 2 },
                hovertemplate: "P %{y:.0f} MW<extra></extra>",
              },
              {
                type: "scatter",
                mode: "lines",
                name: "WTG reactive power [MVAR]",
                x: t,
                y: pts.map((p) => p.reactive_power_mvar),
                line: { color: c.orange, width: 2 },
                hovertemplate: "Q %{y:.0f} MVAR<extra></extra>",
              },
              {
                type: "scatter",
                mode: "lines",
                name: "STATCOM [MVAR]",
                x: t,
                y: pts.map((p) => p.statcom_q_mvar),
                line: { color: c.aqua, width: 2 },
                hovertemplate: "STATCOM %{y:.0f} MVAR<extra></extra>",
              },
            ]}
            layout={{
              ...DARK_PLOTLY_LAYOUT,
              showlegend: true,
              legend: { orientation: "h", y: 1.2, x: 0, font: { size: 11 } },
              xaxis,
              yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "MW / MVAR", font: { size: 12 } } },
              shapes: [
                { type: "line", xref: "paper", x0: 0, x1: 1, y0: 0.9 * pPre, y1: 0.9 * pPre, line: { color: c.ref, width: 1, dash: "dot" } } as const,
              ],
              annotations: pPre > 0
                ? [{ xref: "paper", x: 1, y: 0.9 * pPre, xanchor: "right", yanchor: "bottom", text: "90 % of pre-fault P", showarrow: false, font: { size: 10 } } as const]
                : [],
              margin: { t: 40, r: 12, b: 44, l: 56 },
            }}
            config={PLOTLY_CONFIG}
            useResizeHandler
            className="w-full"
            style={{ height: 240 }}
          />
        </div>
        <ul className="space-y-2 text-xs text-text-secondary self-center">
          {lvrt ? (
            <Check pass={r.stayed_connected}>
              POC voltage {r.retained_voltage_pu.toFixed(2)} pu for {(r.fault_duration_s * 1000).toFixed(0)} ms —{" "}
              {r.stayed_connected ? "above the PSE profile: the farm must ride through" : "below the profile: disconnection permitted"}
            </Check>
          ) : (
            <Check pass={r.stayed_connected}>
              POC {r.retained_voltage_pu.toFixed(2)} pu, terminals {r.terminal_voltage_pu.toFixed(2)} pu — within the assumed 1.30 pu
              converter withstand (PSE sets no short HVRT profile)
            </Check>
          )}
          <Check pass={r.reactive_current_compliant}>
            Fast fault current ΔIq/ΔU = {r.reactive_current_gain.toFixed(2)} (K = {r.k_factor}, capped at rated current) · PSE Art. 20(2)(b)
          </Check>
          <Check pass={r.recovery_compliant}>
            {pPre > 0
              ? `90 % of ${pPre.toFixed(0)} MW back ${Number.isFinite(r.recovery_time_s) ? `in ${r.recovery_time_s.toFixed(2)} s` : "— never"} (limit ${r.recovery_limit_s} s) · Art. 20(3)(a)`
              : "No pre-fault power — nothing to recover"}
          </Check>
          <li className="pt-1 text-text-muted">
            End of event: POC {endOfEvent?.voltage_pu.toFixed(3)} pu with reactive current vs {r.passive_voltage_pu.toFixed(3)} pu
            without; terminals {endOfEvent?.terminal_voltage_pu.toFixed(2)} pu. STATCOM peak {r.statcom_peak_q_mvar.toFixed(0)} MVAR.
          </li>
        </ul>
      </div>
    </ChartWrapper>
  );
}
