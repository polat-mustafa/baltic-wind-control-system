/**
 * Fleet O&M replay (GET /lifecycle/om-simulation): SB-510's 34 turbines through each
 * of the 30 hindcast years with a limited fleet — failures by class, crew transfer
 * vessels with their crews in shifts, jack-up campaigns for major replacements, each
 * waiting for its weather window. Compared with the analytic availability model that
 * assumes unlimited crews; the gap is what the vessel and crew numbers cost.
 */

import { useState } from "react";
import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useChartPalette } from "../../hooks/useChartPalette";
import { useStudy } from "../../hooks/useStudy";
import { getOMSimulation } from "../../services/lifecycleApi";
import type { OMMode } from "../../types/lifecycle";
import { Slider } from "../ui/Slider";
import { LabelValue, Stat, StudyError, StudyLoading, StudyNote } from "../ui/StudyBits";

/** Cost items as the backend names them (om_simulation.simulate_om). */
const COST_LABEL: Record<string, string> = {
  ctv_charter: "CTV charter",
  technicians: "Technicians",
  jackup: "Jack-up campaigns",
  materials: "Materials and spares",
};

const pct = (f: number) => (f * 100).toFixed(2);

export default function OMSimulationPanel() {
  const c = useChartPalette();
  const [nCtv, setNCtv] = useState(2);
  const [crews, setCrews] = useState(3);
  const [mode, setMode] = useState<OMMode>("shifts");
  const { data: r, error, loading } = useStudy(() => getOMSimulation({ n_ctv: nCtv, crews_per_ctv: crews, mode }), [nCtv, crews, mode], 400);
  const costTotal = r ? Object.values(r.cost_eur_per_year).reduce((a, v) => a + v, 0) : 0;

  return (
    <section className="rounded-lg border border-border-primary bg-bg-secondary p-4 space-y-3" aria-label="Fleet O&M simulation">
      <h3 className="text-base font-semibold text-text-primary">Fleet O&amp;M replay — 30 hindcast years with limited vessels and crews</h3>
      <div className="flex flex-wrap items-end gap-4">
        <Slider label="Crew transfer vessels" value={nCtv} display={`${nCtv}`} min={1} max={6} step={1} onChange={setNCtv} />
        <Slider label="Crews per CTV" value={crews} display={`${crews}`} min={1} max={6} step={1} onChange={setCrews} />
        <div role="tablist" aria-label="Working pattern" className="flex gap-1">
          {(["shifts", "continuous"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`rounded px-2 py-1 text-xs font-medium ${mode === m ? "bg-accent text-accent-ink" : "text-text-secondary hover:bg-bg-tertiary"}`}
            >
              {m === "shifts" ? "Day shifts, limited fleet" : "Unlimited crews (analytic check)"}
            </button>
          ))}
        </div>
        {loading && <StudyLoading>replaying 30 years…</StudyLoading>}
      </div>
      {error && <StudyError error={error} />}
      {r && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            <Stat label="Time-based availability" value={pct(r.time_based_mean)} unit="%" />
            <Stat label="Energy-based availability" value={pct(r.energy_based_mean)} unit="%" />
            <Stat label="Energy-based, P90 year" value={pct(r.energy_based_p90)} unit="%" />
            <Stat
              label="Analytic, unlimited crews"
              value={pct(r.analytic_time_based)}
              unit="%"
              sub={<LabelValue label="simulated minus analytic" value={`${((r.time_based_mean - r.analytic_time_based) * 100).toFixed(2)} pp`} />}
            />
            <Stat
              label="Corrective O&M cost"
              value={r.cost_eur_per_mw_year.toLocaleString("en", { maximumFractionDigits: 0 })}
              unit="€/MW/yr"
              sub={<LabelValue label="in total" value={`${(costTotal / 1e6).toFixed(1)} M€/yr`} />}
            />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-4">
            <Plot
              data={[
                {
                  type: "bar",
                  name: "Energy-based",
                  x: r.years.map((y) => y.year),
                  y: r.years.map((y) => y.energy_based * 100),
                  customdata: r.years.map((y) => [y.failures, y.jackup_mobilisations]),
                  marker: { color: c.blue },
                  hovertemplate: "%{x}: %{y:.2f} % · %{customdata[0]} failures · %{customdata[1]} jack-up mobilisations<extra></extra>",
                },
              ]}
              layout={{
                ...DARK_PLOTLY_LAYOUT,
                height: 230,
                showlegend: false,
                margin: { t: 12, r: 12, b: 40, l: 56 },
                xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Hindcast year", font: { size: 12 } } },
                yaxis: {
                  ...DARK_PLOTLY_LAYOUT.yaxis,
                  title: { text: "Energy-based availability [%]", font: { size: 12 } },
                  range: [Math.floor(Math.min(...r.years.map((y) => y.energy_based * 100)) - 1), 100],
                },
                shapes: [
                  { type: "line", xref: "paper", x0: 0, x1: 1, y0: r.energy_based_p90 * 100, y1: r.energy_based_p90 * 100, line: { color: c.orange, width: 1.5, dash: "dash" } } as const,
                ],
                annotations: [
                  { xref: "paper", x: 1, y: r.energy_based_p90 * 100, xanchor: "right", yanchor: "top", text: "P90", showarrow: false, font: { size: 10 } } as const,
                ],
              }}
              config={PLOTLY_CONFIG}
              useResizeHandler
              className="w-full"
              style={{ width: "100%" }}
            />
            <div className="space-y-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-text-muted">
                    <th className="py-1 pr-2 font-medium">Failure class</th>
                    <th className="py-1 text-right font-medium">Mean downtime per failure [h]</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(r.mean_downtime_h).map(([k, h]) => (
                    <tr key={k} className="border-t border-border-primary text-text-secondary">
                      <td className="py-1 pr-2">{k}</td>
                      <td className="py-1 text-right font-mono">{h.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-text-muted">
                    <th className="py-1 pr-2 font-medium">Cost item</th>
                    <th className="py-1 text-right font-medium">[M€/yr]</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(r.cost_eur_per_year).map(([k, v]) => (
                    <tr key={k} className="border-t border-border-primary text-text-secondary">
                      <td className="py-1 pr-2">{COST_LABEL[k] ?? k}</td>
                      <td className="py-1 text-right font-mono">{(v / 1e6).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <StudyNote items={[r.source]} />
        </>
      )}
    </section>
  );
}
