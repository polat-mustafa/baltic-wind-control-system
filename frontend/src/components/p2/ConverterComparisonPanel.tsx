/**
 * GFL vs GFM after a grid phase jump — active power and control frequency
 * over time, for the grid strength and jump the user picks.
 */

import { useEffect, useRef } from "react";
import Plot from "react-plotly.js";

import { gridFormingEducation } from "../../constants/education/p2";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { useGridStore, useNetwork } from "../../store/gridStore";
import type { ConverterResult, GridStrength } from "../../types/grid";
import { ChartWrapper } from "../ui/ChartWrapper";
import { EducationButton } from "../ui/EducationButton";

const STRENGTH: [GridStrength, string][] = [
  ["strong_grid", "Strong 10 GVA"],
  ["weak_grid", "Weak 2 GVA"],
  ["very_weak_grid", "Very weak 0.75 GVA"],
];

function Row({ label, gfl, gfm }: { label: string; gfl: string; gfm: string }) {
  return (
    <tr className="border-t border-border-primary">
      <td className="py-1 pr-2 text-text-muted">{label}</td>
      <td className="py-1 px-2 font-mono text-right">{gfl}</td>
      <td className="py-1 pl-2 font-mono text-right">{gfm}</td>
    </tr>
  );
}

const stable = (r: ConverterResult) => (r.stable ? "✓ stable" : "✗ lost step");
/** After a pole slip the excursions describe the runaway, not a response — not shown. */
const metric = (r: ConverterResult, v: number, digits: number, unit: string) =>
  r.stable ? `${v.toFixed(digits)} ${unit}` : "—";

export default function ConverterComparisonPanel() {
  const n = useNetwork();
  const {
    converterComparison: cc,
    converterScenario,
    phaseJumpDeg,
    converterLoading,
    setConverterScenario,
    setPhaseJumpDeg,
    runConverter,
  } = useGridStore();
  const c = useChartPalette();

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = setTimeout(() => void runConverter(), 300);
    return () => clearTimeout(id);
  }, [converterScenario, phaseJumpDeg, runConverter]);

  if (!cc?.time_series.length) return null;
  const ts = cc.time_series.filter((p) => p.time_s <= 1.5);
  const t = ts.map((p) => p.time_s);
  const { gfl_result: gfl, gfm_result: gfm } = cc;
  const xaxis = { ...DARK_PLOTLY_LAYOUT.xaxis, range: [0, 1.5] };
  const jumpLine = { type: "line", xref: "x", yref: "paper", x0: 0.1, x1: 0.1, y0: 0, y1: 1, line: { color: c.ref, width: 1, dash: "dot" } } as const;
  const lines = (a: (number | null)[], b: (number | null)[], unit: string) => [
    { type: "scatter" as const, mode: "lines" as const, name: "Grid-following (PLL)", x: t, y: a, line: { color: c.blue, width: 2 }, hovertemplate: `GFL %{y:.2f} ${unit}<extra></extra>` },
    { type: "scatter" as const, mode: "lines" as const, name: "Grid-forming (VSM)", x: t, y: b, line: { color: c.orange, width: 2 }, hovertemplate: `GFM %{y:.2f} ${unit}<extra></extra>` },
  ];

  return (
    <ChartWrapper
      title="Grid-following vs grid-forming — response to a grid phase jump"
      headerRight={<EducationButton content={gridFormingEducation} />}
      footer={`Aggregate ${n.total_capacity_mw.toFixed(0)} MW converter behind the farm + grid impedance, 50 µs steps · GFL: 10 Hz PLL, 5 ms current loop · GFM: H = 4 s, D = 80, 1.2 pu current limit`}
    >
      <div className="flex flex-wrap items-end gap-3 mb-2" aria-busy={converterLoading}>
        <div role="tablist" aria-label="Grid strength" className="flex flex-wrap gap-1">
          {STRENGTH.map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={converterScenario === k}
              onClick={() => setConverterScenario(k)}
              className={`rounded px-2 py-1 text-xs font-medium ${converterScenario === k ? "bg-accent text-accent-ink" : "text-text-secondary hover:bg-bg-tertiary"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-0.5 text-xs text-text-muted min-w-[10rem]">
          <span className="flex justify-between">
            Phase jump at t = 0.1 s <span className="font-mono text-text-primary">{phaseJumpDeg}°</span>
          </span>
          <input
            type="range"
            min={5}
            max={60}
            step={5}
            value={phaseJumpDeg}
            onChange={(e) => setPhaseJumpDeg(Number(e.target.value))}
            className="accent-accent"
          />
        </label>
        <p className="text-xs text-text-secondary">
          SCR <span className="font-mono">{gfl.scr.toFixed(1)}</span> at the POC →{" "}
          <span className="font-mono">{gfl.scr_terminal.toFixed(1)}</span> at the 66 kV busbar
        </p>
        {converterLoading && <span className="text-xs text-text-muted">simulating…</span>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <Plot
          data={lines(ts.map((p) => p.gfl_p_mw), ts.map((p) => p.gfm_p_mw), "MW")}
          layout={{
            ...DARK_PLOTLY_LAYOUT,
            transition: CHART_TRANSITION,
            legend: { orientation: "h", y: 1.18, x: 0, font: { size: 11 } },
            xaxis: { ...xaxis, title: { text: "Time [s]", font: { size: 12 } } },
            yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "Active power [MW]", font: { size: 12 } } },
            shapes: [jumpLine],
            margin: { t: 40, r: 12, b: 44, l: 60 },
          }}
          config={PLOTLY_CONFIG}
          useResizeHandler
          className="w-full"
          style={{ height: 280 }}
        />
        <Plot
          data={lines(ts.map((p) => p.gfl_f_hz), ts.map((p) => p.gfm_f_hz), "Hz")}
          layout={{
            ...DARK_PLOTLY_LAYOUT,
            transition: CHART_TRANSITION,
            legend: { orientation: "h", y: 1.18, x: 0, font: { size: 11 } },
            xaxis: { ...xaxis, title: { text: "Time [s]", font: { size: 12 } } },
            yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "Frequency seen by the control [Hz]", font: { size: 12 } } },
            shapes: [jumpLine],
            margin: { t: 40, r: 12, b: 44, l: 60 },
          }}
          config={PLOTLY_CONFIG}
          useResizeHandler
          className="w-full"
          style={{ height: 280 }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
        <table className="text-xs w-full">
          <thead>
            <tr className="text-text-muted">
              <th className="text-left font-normal py-1">{cc.phase_jump_deg}° jump</th>
              <th className="text-right font-normal py-1 px-2">GFL</th>
              <th className="text-right font-normal py-1 pl-2">GFM</th>
            </tr>
          </thead>
          <tbody className="text-text-primary">
            <Row label="Outcome" gfl={stable(gfl)} gfm={stable(gfm)} />
            <Row label="Power swing" gfl={metric(gfl, gfl.power_swing_mw, 0, "MW")} gfm={metric(gfm, gfm.power_swing_mw, 0, "MW")} />
            <Row label="Peak current" gfl={metric(gfl, gfl.peak_current_pu, 2, "pu")} gfm={metric(gfm, gfm.peak_current_pu, 2, "pu")} />
            <Row
              label="Max frequency excursion"
              gfl={metric(gfl, gfl.frequency_deviation_hz, 2, "Hz")}
              gfm={metric(gfm, gfm.frequency_deviation_hz, 2, "Hz")}
            />
            <Row
              label="Terminal voltage change"
              gfl={metric(gfl, gfl.voltage_deviation_pu, 3, "pu")}
              gfm={metric(gfm, gfm.voltage_deviation_pu, 3, "pu")}
            />
            <Row
              label="Settled within ±2 % in"
              gfl={gfl.stable ? `${gfl.settling_time_s.toFixed(2)} s` : "—"}
              gfm={gfm.stable ? `${gfm.settling_time_s.toFixed(2)} s` : "—"}
            />
          </tbody>
        </table>
        <p className="text-xs text-text-secondary leading-relaxed self-center">{cc.gfm_advantage}</p>
      </div>
    </ChartWrapper>
  );
}
