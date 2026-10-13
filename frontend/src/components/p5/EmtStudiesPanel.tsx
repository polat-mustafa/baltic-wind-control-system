/**
 * EMT studies around the energisation of export cable 1 (GET /commissioning/energisation/emt-studies):
 * IEC 60071-2 insulation co-ordination from 30 simulated closings, the inrush of an onshore
 * 400/220 kV transformer (checked against Specht's closed form) and the overvoltage after a
 * cleared onshore busbar fault.
 */

import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useChartPalette } from "../../hooks/useChartPalette";
import { useStudy } from "../../hooks/useStudy";
import { getEmtStudies } from "../../services/commissioningApi";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { LabelValue, Stat, StudyError, StudyLoading, StudyNote, Verdict } from "../ui/StudyBits";

const METHOD = [
  "Insulation co-ordination (IEC 60071-2): 30 closings of CB-ON-220-01 over a half cycle with random pole scatter (0–3 ms); phase-peak method: U_e2 = 98th percentile of the far-end peaks, truncation U_et = 1.25·U_e2 − 0.25, no arresters (K_cd = 1), K_s = 1.15 for internal insulation; range I conversion to the short-duration power-frequency and lightning tests (Table 2) against the 245 kV levels 460 kV r.m.s. / 1050 kV peak (IEC 60071-1). 1 p.u. = 245·√2/√3 kV.",
  "Inrush: onshore 300 MVA 400/220 kV transformer energised from the 400 kV grid, two-slope saturation (knee 1.2 p.u. flux, air-core 0.30 p.u.), residual flux 0.8 p.u., closing at a voltage zero — typical values, not vendor data. The lossless case reproduces Specht's closed-form first peak.",
  "TOV: bolted three-phase fault at the onshore 220 kV busbar for 100 ms with cable 1 and its reactor energised; the breaker clears at a current zero and the discharged cable re-charges.",
];

export default function EmtStudiesPanel() {
  const c = useChartPalette();
  const { data: r, error, loading } = useStudy(getEmtStudies, []);
  const ic = r?.insulation_coordination;

  return (
    <Card>
      <CardHeader action={ic ? <Verdict ok={ic.ok} yes="245 kV insulation levels suffice" no="insulation level exceeded" /> : undefined}>
        <CardTitle>Insulation co-ordination, transformer inrush and TOV (EMT)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {loading && !r && <StudyLoading>simulating…</StudyLoading>}
        {error && <StudyError error={error} />}
        {r && ic && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <Stat
                label="Switching overvoltage U_e2 / U_et"
                value={`${ic.switching.ue2_pu.toFixed(2)} / ${ic.switching.uet_pu.toFixed(2)}`}
                unit="pu"
                sub={<LabelValue label="required withstand U_rw" value={`${ic.urw_kv.toFixed(0)} kV`} />}
              />
              <Stat
                label="Inrush first peak"
                value={r.inrush.first_peak_pu_of_rated.toFixed(1)}
                unit="× rated peak"
                sub={<LabelValue label="Specht, lossless" value={`${r.inrush.specht_peak_a.toFixed(0)} A`} />}
              />
              <Stat label="Inrush 2nd harmonic / fundamental" value={(r.inrush.second_harmonic_ratio * 100).toFixed(0)} unit="%" />
              <Stat
                label="Overvoltage after fault clearing"
                value={r.tov.peak_after_clearing_pu.toFixed(2)}
                unit="pu"
                sub={<LabelValue label="steady state" value={`${r.tov.steady_far_end_pu.toFixed(2)} pu`} />}
              />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-text-muted">
                      <th className="py-1 pr-2 font-medium">Insulation</th>
                      <th className="py-1 pr-2 text-right font-medium">Required SDWV [kV]</th>
                      <th className="py-1 pr-2 text-right font-medium">Required LIWV [kV]</th>
                      <th className="py-1 text-right font-medium">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ic.equipment.map((e) => (
                      <tr key={e.insulation} className="border-t border-border-primary text-text-secondary">
                        <td className="py-1 pr-2">{e.insulation}</td>
                        <td className="py-1 pr-2 text-right font-mono">{e.required_sdwv_kv.toFixed(0)}</td>
                        <td className="py-1 pr-2 text-right font-mono">{e.required_liwv_kv.toFixed(0)}</td>
                        <td className={`py-1 text-right font-mono ${e.ok ? "" : "text-status-alarm"}`}>{Math.min(e.margin_sdwv, e.margin_liwv).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Plot
                data={[{ type: "scatter", mode: "lines", name: "Inrush current", x: r.inrush.time_ms, y: r.inrush.current_a, line: { color: c.blue, width: 1.5 }, hovertemplate: "%{y:.0f} A at %{x:.1f} ms<extra></extra>" }]}
                layout={{
                  ...DARK_PLOTLY_LAYOUT,
                  height: 220,
                  showlegend: false,
                  margin: { t: 12, r: 16, b: 44, l: 60 },
                  xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Time after closing [ms]", font: { size: 12 } } },
                  yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "Phase a inrush [A]", font: { size: 12 } } },
                }}
                config={PLOTLY_CONFIG}
                useResizeHandler
                className="w-full"
                style={{ width: "100%" }}
              />
            </div>
            <StudyNote items={METHOD} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
