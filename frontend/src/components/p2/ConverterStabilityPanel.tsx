/**
 * Converter–array interaction (POST /grid/power-quality/converter-stability).
 *
 * Every array section and WTG transformer is modelled and each grid-side converter is
 * a Norton equivalent: a current source behind its own admittance Y(f), which turns
 * non-passive (negative real part) above some frequency because of the control delay.
 * Generalized Nyquist on det(I + Z·Y) gives the verdict; the closest approach of the
 * characteristic loci to −1 is the vector margin. With Norton models the harmonic
 * voltages differ from the textbook "ideal current source" emission.
 *
 * The study takes ~3 s, so control changes are debounced and the last result stays
 * on screen while the next one runs.
 */

import { useState } from "react";
import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useChartPalette } from "../../hooks/useChartPalette";
import { useStudy } from "../../hooks/useStudy";
import { runConverterStability } from "../../services/powerQualityApi";
import { Slider } from "../ui/Slider";
import { LabelValue, Stat, StudyError, StudyLoading, StudyNote, Verdict } from "../ui/StudyBits";

export default function ConverterStabilityPanel() {
  const c = useChartPalette();
  const [fSw, setFSw] = useState(2500);
  const [bw, setBw] = useState(250);
  const [cf, setCf] = useState(0.08);
  const [noDamping, setNoDamping] = useState(false);
  const { data: r, error, loading } = useStudy(
    () => runConverterStability({ f_sw_hz: fSw, bandwidth_hz: bw, c_filter_pu: cf, ...(noDamping ? { damping_r_pu: 0 } : {}) }),
    [fSw, bw, cf, noDamping],
    600,
  );
  const buses = r ? Object.keys(r.thd_norton_pct) : [];

  return (
    <section className="rounded-lg border border-border-primary bg-bg-secondary p-4 space-y-3" aria-label="Converter–array harmonic stability" aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-primary">Converter–array stability — Norton models and generalized Nyquist</h3>
        {r && <Verdict ok={r.stable} yes="stable" no="unstable" />}
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <Slider label="Switching frequency f_sw" value={fSw} display={`${fSw} Hz`} min={1000} max={5000} step={100} onChange={setFSw} />
        <Slider label="Current-loop bandwidth" value={bw} display={`${bw} Hz`} min={100} max={600} step={10} onChange={setBw} />
        <Slider label="Filter capacitor C_f" value={cf} display={`${cf.toFixed(2)} pu`} min={0.02} max={0.2} step={0.01} onChange={setCf} />
        <label className="flex items-center gap-1.5 text-xs text-text-secondary">
          <input type="checkbox" checked={noDamping} onChange={(e) => setNoDamping(e.target.checked)} className="accent-accent" />
          Damping resistor off
        </label>
        {loading && <StudyLoading>solving (~3 s)…</StudyLoading>}
      </div>
      {error && <StudyError error={error} />}
      {r && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Stat
              label="One converter on a stiff grid"
              value={r.standalone_stable ? "✓" : "✗"}
              tone={r.standalone_stable ? "ok" : "bad"}
              sub={<LabelValue label="vector margin" value={r.standalone_vector_margin.toFixed(2)} />}
            />
            <Stat
              label="Vector margin (whole array)"
              value={r.vector_margin.toFixed(2)}
              unit={`@ ${r.vector_margin_hz.toFixed(0)} Hz`}
              tone={r.stable ? "ok" : "bad"}
              sub={<LabelValue label="unstable poles (RHP)" value={String(r.unstable_poles)} />}
            />
            <Stat label="Phase margin" value={r.phase_margin_deg.toFixed(0)} unit={`° @ ${r.phase_margin_hz.toFixed(0)} Hz`} />
            <Stat
              label="LCL resonance vs non-passive from"
              value={`${r.lcl_resonance_hz.toFixed(0)} / ${r.non_passive_from_hz.toFixed(0)}`}
              unit="Hz"
              sub={<LabelValue label="damping resistor R_d" value={`${r.damping_r_pu.toFixed(3)} pu`} />}
            />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Plot
              data={[
                {
                  type: "scatter",
                  mode: "lines",
                  name: "min |1 + λ|",
                  x: r.loci_hz,
                  y: r.loci_min_distance,
                  line: { color: c.blue, width: 2 },
                  hovertemplate: "%{x:.0f} Hz: %{y:.3f}<extra></extra>",
                },
              ]}
              layout={{
                ...DARK_PLOTLY_LAYOUT,
                height: 240,
                showlegend: false,
                margin: { t: 16, r: 16, b: 44, l: 56 },
                xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, type: "log", title: { text: "Frequency [Hz]", font: { size: 12 } } },
                yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "Distance of loci to −1", font: { size: 12 } }, rangemode: "tozero" },
                shapes: [
                  { type: "line", xref: "paper", x0: 0, x1: 1, y0: 0, y1: 0, line: { color: c.red, width: 1.5, dash: "dash" } } as const,
                  { type: "line", xref: "x", yref: "paper", x0: r.vector_margin_hz, x1: r.vector_margin_hz, y0: 0, y1: 1, line: { color: c.ref, width: 1, dash: "dot" } } as const,
                ],
                annotations: [
                  { xref: "paper", x: 1, y: 0, xanchor: "right", yanchor: "bottom", text: "instability", showarrow: false, font: { size: 10, color: c.red } } as const,
                ],
              }}
              config={PLOTLY_CONFIG}
              useResizeHandler
              className="w-full"
              style={{ width: "100%" }}
            />
            <table className="w-full self-start text-xs">
              <thead>
                <tr className="text-left text-text-muted">
                  <th className="py-1 pr-2 font-medium">Bus</th>
                  <th className="py-1 pr-2 text-right font-medium">THD, Norton [%]</th>
                  <th className="py-1 pr-2 text-right font-medium">THD, ideal sources [%]</th>
                  <th className="py-1 text-right font-medium">Limit [%]</th>
                </tr>
              </thead>
              <tbody>
                {buses.map((b) => {
                  const n = r.thd_norton_pct[b];
                  const lim = r.thd_limit_pct[b];
                  return (
                    <tr key={b} className="border-t border-border-primary text-text-secondary">
                      <td className="py-1 pr-2" translate="no">{b}</td>
                      <td className={`py-1 pr-2 text-right font-mono ${n > lim ? "text-status-alarm" : "text-text-primary"}`}>{n.toFixed(2)}</td>
                      <td className="py-1 pr-2 text-right font-mono">{r.thd_ideal_sources_pct[b]?.toFixed(2) ?? "—"}</td>
                      <td className="py-1 text-right font-mono">{lim?.toFixed(1) ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <StudyNote label="Assumptions:" items={r.assumptions} />
        </>
      )}
    </section>
  );
}
