/**
 * Tower-base fore-aft bending moment (GET /turbine-physics/tower-loads, /tower-fatigue).
 *
 * Left: one 10-minute turbulent run at the chosen mean wind — the rotor thrust drives
 * the tower's first fore-aft mode; aerodynamic damping keeps it small while the rotor
 * produces power. Its rainflow-counted damage-equivalent load (DEL, 1 Hz, Wöhler m = 4)
 * is the single number fatigue design compares. Right: the DEL per wind bin and the
 * lifetime DEL weighted by the site's Weibull (computed once, ~15 s the first time).
 */

import { useState } from "react";
import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useChartPalette } from "../../hooks/useChartPalette";
import { useStudy } from "../../hooks/useStudy";
import { getTowerFatigue, getTowerLoads } from "../../services/turbinePhysicsApi";
import { Slider } from "../ui/Slider";
import { LabelValue, Stat, StudyError, StudyLoading, StudyNote } from "../ui/StudyBits";

export default function TowerLoadsPanel() {
  const c = useChartPalette();
  const [wind, setWind] = useState(11);
  const [seed, setSeed] = useState(0);
  const loads = useStudy(() => getTowerLoads(wind, seed), [wind, seed], 400);
  const fatigue = useStudy(getTowerFatigue, []);
  const l = loads.data;
  const f = fatigue.data;

  return (
    <section className="rounded-lg border border-border-primary bg-bg-secondary p-4 space-y-3" aria-label="Tower-base loads and fatigue">
      <h3 className="text-sm font-semibold text-text-primary">Tower-base fore-aft moment — 10-min turbulent run and lifetime fatigue</h3>
      <div className="flex flex-wrap items-end gap-4">
        <Slider label="10-min mean hub wind" value={wind} display={`${wind} m/s`} min={4} max={24} step={1} onChange={setWind} />
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>Turbulence seed</span>
          <span translate="no" className="font-mono text-text-primary">{seed}</span>
          <button type="button" onClick={() => setSeed((s) => (s + 1) % 100)} className="rounded px-2 py-1 text-xs font-medium text-text-secondary hover:bg-bg-tertiary">
            New seed
          </button>
        </div>
        {loads.loading && <StudyLoading>simulating…</StudyLoading>}
      </div>
      {loads.error && <StudyError error={loads.error} />}
      <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-4">
        <div className="space-y-2">
          {l && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <Stat label="DEL, 1 Hz, m = 4" value={l.del_base_moment_mnm.toFixed(1)} unit="MN·m" />
                <Stat label="Mean / max moment" value={`${l.mean_base_moment_mnm.toFixed(0)} / ${l.max_base_moment_mnm.toFixed(0)}`} unit="MN·m" />
                <Stat label="Max tower-top deflection" value={l.max_tower_top_m.toFixed(2)} unit="m" />
                <Stat
                  label="Total damping ratio"
                  value={(l.total_damping_ratio * 100).toFixed(1)}
                  unit="%"
                  sub={<LabelValue label="rotor-effective TI" value={`${(l.turbulence_intensity * 100).toFixed(1)} %`} />}
                />
              </div>
              <Plot
                data={[
                  { type: "scatter", mode: "lines", name: "Base moment [MN·m]", x: l.time_s, y: l.base_moment_mnm, line: { color: c.blue, width: 1.2 }, hovertemplate: "%{y:.1f} MN·m at %{x:.0f} s<extra></extra>" },
                  { type: "scatter", mode: "lines", name: "Hub wind [m/s]", x: l.time_s, y: l.wind_ms, yaxis: "y2", line: { color: c.orange, width: 1 }, hovertemplate: "%{y:.1f} m/s<extra></extra>" },
                ]}
                layout={{
                  ...DARK_PLOTLY_LAYOUT,
                  height: 240,
                  legend: { orientation: "h", y: 1.18, x: 0, font: { size: 11 } },
                  margin: { t: 28, r: 52, b: 44, l: 56 },
                  xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Time [s]", font: { size: 12 } } },
                  yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "MN·m", font: { size: 12 } } },
                  yaxis2: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "m/s", font: { size: 12 } }, overlaying: "y", side: "right", showgrid: false },
                }}
                config={PLOTLY_CONFIG}
                useResizeHandler
                className="w-full"
                style={{ width: "100%" }}
              />
              <StudyNote items={[l.source]} />
            </>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-text-secondary">Lifetime fatigue over the site wind distribution</p>
          {fatigue.loading && !f && <StudyLoading>computing all wind bins (~15 s)…</StudyLoading>}
          {fatigue.error && <StudyError error={fatigue.error} />}
          {f && (
            <>
              <Stat label="Lifetime DEL (Weibull-weighted)" value={f.lifetime_del_mnm.toFixed(1)} unit="MN·m" sub={<span translate="no">{`m = ${f.wohler_m}`}</span>} />
              <Plot
                data={[
                  {
                    type: "bar",
                    name: "10-min DEL",
                    x: f.bins_ms,
                    y: f.del_10min_mnm,
                    marker: { color: f.bins_ms.map((b) => (b === wind ? c.orange : c.blue)) },
                    customdata: f.probability.map((p) => p * 100),
                    hovertemplate: "%{x} m/s: DEL %{y:.1f} MN·m · %{customdata:.1f} % of the time<extra></extra>",
                  },
                ]}
                layout={{
                  ...DARK_PLOTLY_LAYOUT,
                  height: 220,
                  showlegend: false,
                  margin: { t: 12, r: 12, b: 44, l: 56 },
                  xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Mean wind [m/s]", font: { size: 12 } } },
                  yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "10-min DEL [MN·m]", font: { size: 12 } } },
                  shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: f.lifetime_del_mnm, y1: f.lifetime_del_mnm, line: { color: c.ref, width: 1.5, dash: "dash" } } as const],
                }}
                config={PLOTLY_CONFIG}
                useResizeHandler
                className="w-full"
                style={{ width: "100%" }}
              />
              <StudyNote items={[f.source]} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
