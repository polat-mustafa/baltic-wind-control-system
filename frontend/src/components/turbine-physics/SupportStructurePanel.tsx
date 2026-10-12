/**
 * Tower + jacket natural frequency against the excitation bands (GET /turbine-physics/support-structure).
 *
 * Campbell-style strip on one frequency axis: the rotor 1P band (5.0–7.56 rpm), the
 * blade-passing 3P band and the 50-year sea state's 1/Tp band. A "soft-stiff" design
 * puts the first fore-aft bending mode f1 between 1P and 3P with the DNV-ST-0126
 * margin (10 %) to both, and above the wave band. The dashed line is DEME's OpenFAST
 * free-decay reference for the same jacket.
 */

import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useChartPalette, withAlpha } from "../../hooks/useChartPalette";
import { useStudy } from "../../hooks/useStudy";
import { getSupportStructure } from "../../services/turbinePhysicsApi";
import { LabelValue, Stat, StudyError, StudyLoading, StudyNote, Verdict } from "../ui/StudyBits";

export default function SupportStructurePanel() {
  const c = useChartPalette();
  const { data: s, error, loading } = useStudy(getSupportStructure, []);

  const bands = s
    ? [
        { name: "50-year waves (1/Tp)", band: s.wave_band_hz, color: c.aqua },
        { name: "Rotor 1P", band: s.band_1p_hz, color: c.blue },
        { name: "Blade passing 3P", band: s.band_3p_hz, color: c.orange },
      ]
    : [];
  const xMax = s ? Math.max(s.band_3p_hz[1], s.first_bending_hz) * 1.12 : 1;
  const f1 = s?.first_bending_hz ?? 0;
  const f1ErrPct = s ? ((s.first_bending_hz - s.reference_hz) / s.reference_hz) * 100 : 0;

  return (
    <section className="rounded-lg border border-border-primary bg-bg-secondary p-4 space-y-3" aria-label="Support structure natural frequency">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-primary">Support structure — first natural frequency vs 1P, 3P and waves</h3>
        {s && <Verdict ok={s.soft_stiff_ok} yes="soft-stiff: margins met" no="margin to 1P / 3P too small" />}
        {loading && !s && <StudyLoading />}
      </div>
      {error && <StudyError error={error} />}
      {s && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Stat label="First fore-aft bending f1" value={f1.toFixed(3)} unit="Hz" sub={<LabelValue label="OpenFAST reference" value={`${s.reference_hz.toFixed(3)} Hz (${f1ErrPct >= 0 ? "+" : ""}${f1ErrPct.toFixed(1)} %)`} />} />
            <Stat label="Margin above 1P" value={(s.margin_to_1p * 100).toFixed(1)} unit="%" tone={s.margin_to_1p >= s.required_margin ? "ok" : "bad"} sub={<span translate="no">{`≥ ${(s.required_margin * 100).toFixed(0)} % (DNV-ST-0126)`}</span>} />
            <Stat label="Margin below 3P" value={(s.margin_to_3p * 100).toFixed(1)} unit="%" tone={s.margin_to_3p >= s.required_margin ? "ok" : "bad"} sub={<span translate="no">{`≥ ${(s.required_margin * 100).toFixed(0)} % (DNV-ST-0126)`}</span>} />
            <Stat label="50-year significant wave height" value={s.hs50_m.toFixed(1)} unit="m" sub={<span translate="no" className="font-mono">{`1/Tp ${s.wave_band_hz[0].toFixed(3)}–${s.wave_band_hz[1].toFixed(3)} Hz`}</span>} />
          </div>
          <Plot
            data={[
              {
                // hover targets at the band centres; the bands themselves are shapes
                type: "scatter",
                mode: "markers",
                x: bands.map((b) => (b.band[0] + b.band[1]) / 2),
                y: bands.map((_, i) => i),
                marker: { size: 1, opacity: 0 },
                customdata: bands.map((b) => [b.band[0], b.band[1]]),
                text: bands.map((b) => b.name),
                hovertemplate: "%{text}: %{customdata[0]:.3f}–%{customdata[1]:.3f} Hz<extra></extra>",
              },
            ]}
            layout={{
              ...DARK_PLOTLY_LAYOUT,
              height: 200,
              showlegend: false,
              margin: { t: 24, r: 16, b: 44, l: 8 },
              xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, range: [0, xMax], title: { text: "Frequency [Hz]", font: { size: 12 } } },
              yaxis: {
                ...DARK_PLOTLY_LAYOUT.yaxis,
                range: [-0.6, bands.length - 0.4],
                tickvals: bands.map((_, i) => i),
                ticktext: bands.map((b) => b.name),
                showgrid: false,
                zeroline: false,
                automargin: true,
                tickfont: { size: 11 },
              },
              shapes: [
                ...bands.map(
                  (b, i) =>
                    ({
                      type: "rect",
                      xref: "x",
                      yref: "y",
                      x0: b.band[0],
                      x1: b.band[1],
                      y0: i - 0.28,
                      y1: i + 0.28,
                      fillcolor: withAlpha(b.color, 0.55),
                      line: { color: b.color, width: 1.5 },
                    }) as const,
                ),
                // DNV margin zones next to 1P and 3P
                { type: "rect", xref: "x", yref: "paper", x0: s.band_1p_hz[1], x1: s.band_1p_hz[1] * (1 + s.required_margin), y0: 0, y1: 1, fillcolor: c.band, line: { width: 0 } } as const,
                { type: "rect", xref: "x", yref: "paper", x0: s.band_3p_hz[0] * (1 - s.required_margin), x1: s.band_3p_hz[0], y0: 0, y1: 1, fillcolor: c.band, line: { width: 0 } } as const,
                { type: "line", xref: "x", yref: "paper", x0: s.reference_hz, x1: s.reference_hz, y0: 0, y1: 1, line: { color: c.ref, width: 1.5, dash: "dash" } } as const,
                { type: "line", xref: "x", yref: "paper", x0: f1, x1: f1, y0: 0, y1: 1, line: { color: s.soft_stiff_ok ? c.ink : c.red, width: 2.5 } } as const,
              ],
              annotations: [
                { x: f1, y: 1, xref: "x", yref: "paper", yanchor: "bottom", xanchor: "left", text: `f1 ${f1.toFixed(3)} Hz`, showarrow: false, font: { size: 11 } } as const,
                { x: s.reference_hz, y: 1, xref: "x", yref: "paper", yanchor: "bottom", xanchor: "right", text: "OpenFAST", showarrow: false, font: { size: 10 } } as const,
              ],
            }}
            config={PLOTLY_CONFIG}
            useResizeHandler
            className="w-full"
            style={{ width: "100%" }}
          />
          <p className="text-xs text-text-muted">
            <span>First natural frequencies:</span>{" "}
            <span translate="no" className="font-mono">{s.frequencies_hz.slice(0, 6).map((f) => f.toFixed(3)).join(" · ")} Hz</span>
          </p>
          <StudyNote items={[s.source]} />
        </>
      )}
    </section>
  );
}
