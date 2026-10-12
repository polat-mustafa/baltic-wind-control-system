/**
 * Electromagnetic transient of the first switching step that energises export cable 1:
 * closing CB-ON-220-01 from shore onto the cable and its line reactor
 * (GET /commissioning/energisation/emt).
 *
 * The cable draws a capacitive charging current, the reactor an inductive one that
 * nearly cancels it; the reactor's DC offset then decays slowly, so the breaker current
 * may not cross zero for many cycles ("zero-missing") — a breaker cannot interrupt it
 * until it does. Closing near the voltage peak (point-on-wave) or a pre-insertion
 * resistor removes the offset. The open OSS end shows the switching overvoltage.
 * Phase a, first 300 ms, every 0.5 ms.
 */

import { useState } from "react";
import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useChartPalette } from "../../hooks/useChartPalette";
import { useStudy } from "../../hooks/useStudy";
import { getEnergisationEmt } from "../../services/commissioningApi";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { LabelValue, Stat, StudyError, StudyLoading, StudyNote, Verdict } from "../ui/StudyBits";

const ANGLES: [number, string][] = [
  [0, "at voltage zero (0°)"],
  [45, "45°"],
  [90, "at voltage peak (90°)"],
];

const METHOD =
  "Per-phase EMT, Dommel trapezoidal companion models (the EMTP method), Δt = 20 µs: grid Thevenin source behind the onshore transformers (IEC 60909 fault level), the 108 km cable as 30 cascaded exact-π sections, line reactor X/R 400 on the cable side of the breaker, optional 400 Ω pre-insertion resistor for 10 ms; poles close 120° apart with the given scatter. Zero-missing after CIGRE TB 556. Not modelled: frequency-dependent cable parameters, phase coupling, surge arresters, arc dynamics.";

type Wave = "current" | "voltage";

export default function EnergisationEmtPanel() {
  const c = useChartPalette();
  const [angle, setAngle] = useState(0);
  const [preInsertion, setPreInsertion] = useState(false);
  const [withReactor, setWithReactor] = useState(true);
  const [wave, setWave] = useState<Wave>("current");
  const { data: r, error, loading } = useStudy(
    () => getEnergisationEmt({ closingAngleDeg: angle, poleScatterMs: 1, preInsertion, withReactor }),
    [angle, preInsertion, withReactor],
    200,
  );

  const btn = (on: boolean) => `rounded px-2 py-1 text-xs font-medium ${on ? "bg-accent text-accent-ink" : "text-text-secondary hover:bg-bg-tertiary"}`;

  return (
    <Card>
      <CardHeader action={r ? <Verdict ok={!r.zero_missing} yes="current crosses zero" no="zero-missing" /> : undefined}>
        <CardTitle>Energising export cable 1 — switching transient (EMT)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-text-secondary">Point-on-wave closing</p>
            <div role="tablist" aria-label="Closing angle" className="flex flex-wrap gap-1">
              {ANGLES.map(([a, l]) => (
                <button key={a} role="tab" aria-selected={angle === a} onClick={() => setAngle(a)} className={btn(angle === a)}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-text-secondary">
            <input type="checkbox" checked={preInsertion} onChange={(e) => setPreInsertion(e.target.checked)} className="accent-accent" />
            Pre-insertion resistor
          </label>
          <label className="flex items-center gap-1.5 text-xs text-text-secondary">
            <input type="checkbox" checked={withReactor} onChange={(e) => setWithReactor(e.target.checked)} className="accent-accent" />
            Line reactor connected
          </label>
          {loading && <StudyLoading>simulating…</StudyLoading>}
        </div>
        {error && <StudyError error={error} />}
        {r && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <Stat label="DC offset / AC amplitude" value={r.dc_over_ac.toFixed(2)} tone={r.dc_over_ac > 1 ? "bad" : "ok"} />
              <Stat label="Longest time without a current zero" value={r.zero_missing_ms.toFixed(0)} unit="ms" tone={r.zero_missing ? "bad" : "ok"} />
              <Stat label="Peak overvoltage, open OSS end" value={r.peak_far_end_pu.toFixed(2)} unit="pu" sub={<LabelValue label="steady state" value={`${r.steady_far_end_pu.toFixed(3)} pu`} />} />
              <Stat label="Steady breaker current" value={r.steady_breaker_current_a.toFixed(0)} unit="A" sub={<LabelValue label="poles close at" value={`${r.closing_times_ms.map((t) => t.toFixed(1)).join(" / ")} ms`} />} />
            </div>
            <div role="tablist" aria-label="Waveform" className="flex gap-1">
              <button role="tab" aria-selected={wave === "current"} onClick={() => setWave("current")} className={btn(wave === "current")}>
                Breaker and reactor current
              </button>
              <button role="tab" aria-selected={wave === "voltage"} onClick={() => setWave("voltage")} className={btn(wave === "voltage")}>
                Voltage at the open OSS end
              </button>
            </div>
            <Plot
              data={
                wave === "current"
                  ? [
                      { type: "scatter", mode: "lines", name: "Breaker current", x: r.time_ms, y: r.breaker_current_a, line: { color: c.blue, width: 1.5 }, hovertemplate: "%{y:.0f} A at %{x:.1f} ms<extra></extra>" },
                      { type: "scatter", mode: "lines", name: "Reactor current", x: r.time_ms, y: r.reactor_current_a, line: { color: c.orange, width: 1.5 }, hovertemplate: "%{y:.0f} A at %{x:.1f} ms<extra></extra>" },
                    ]
                  : [{ type: "scatter", mode: "lines", name: "Far-end voltage", x: r.time_ms, y: r.far_end_voltage_kv, line: { color: c.blue, width: 1.5 }, hovertemplate: "%{y:.0f} kV at %{x:.1f} ms<extra></extra>" }]
              }
              layout={{
                ...DARK_PLOTLY_LAYOUT,
                height: 260,
                legend: { orientation: "h", y: 1.15, x: 0, font: { size: 11 } },
                margin: { t: 28, r: 16, b: 44, l: 60 },
                xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Time after closing command [ms]", font: { size: 12 } } },
                yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: wave === "current" ? "Phase a current [A]" : "Phase a voltage [kV]", font: { size: 12 } } },
                shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 0, y1: 0, line: { color: c.ref, width: 1, dash: "dot" } } as const],
              }}
              config={PLOTLY_CONFIG}
              useResizeHandler
              className="w-full"
              style={{ width: "100%" }}
            />
            <StudyNote items={[METHOD]} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
