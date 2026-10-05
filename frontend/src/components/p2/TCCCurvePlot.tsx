/**
 * Time–current characteristics of the 66 kV overcurrent stages (log–log).
 *
 * Feeder and incomer curves in primary kA, the IEC 60909 max/min fault
 * currents as vertical lines; the gap between the curves at those lines is
 * the grading margin. TMS sliders PUT the setting and re-run the study.
 */

import { useEffect, useState } from "react";
import Plot from "react-plotly.js";

import { protectionEducation } from "../../constants/education/p2";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { useProtectionStore } from "../../store/protectionStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { EducationButton } from "../ui/EducationButton";

function TmsSlider({ id, label, value }: { id: string; label: string; value: number }) {
  const setTms = useProtectionStore((s) => s.setTms);
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  useEffect(() => {
    if (Math.abs(v - value) < 1e-9) return;
    const t = setTimeout(() => void setTms(id, v), 350);
    return () => clearTimeout(t);
  }, [v, value, id, setTms]);
  return (
    <label className="flex flex-col gap-0.5 text-[11px] text-text-muted flex-1 min-w-[10rem]">
      <span className="flex justify-between">
        {label}
        <span className="font-mono text-text-primary">TMS {v.toFixed(2)}</span>
      </span>
      <input type="range" min={0.05} max={0.5} step={0.01} value={v} onChange={(e) => setV(Number(e.target.value))} className="accent-accent" />
    </label>
  );
}

export default function TCCCurvePlot() {
  const study = useProtectionStore((s) => s.study);
  const c = useChartPalette();
  const tcc = study?.tcc_data;
  if (!study || !tcc?.curves.length) return null;

  const colors: Record<string, string> = { "PTOC-01": c.blue, "PTOC-02": c.orange };
  const label: Record<string, string> = { "PTOC-01": "String feeder PTOC-01", "PTOC-02": "66 kV incomer PTOC-02" };
  const oc = study.grading_results.find((g) => g.pair_id === "GP-001");

  return (
    <ChartWrapper
      title="Overcurrent grading — time–current curves (IEC 60255-151)"
      headerRight={<EducationButton content={protectionEducation} />}
      footer={
        oc
          ? `${oc.selective ? "✓" : "✗"} Worst-case margin ${oc.actual_margin_ms.toFixed(0)} ms (feeder ${oc.downstream_delay_s.toFixed(3)} s, incomer ${oc.upstream_delay_s.toFixed(3)} s) — required ${oc.required_margin_ms.toFixed(0)} ms`
          : undefined
      }
    >
      <Plot
        data={tcc.curves.map((cv) => ({
          type: "scatter" as const,
          mode: "lines" as const,
          name: `${label[cv.relay_id] ?? cv.relay_id} · ${cv.curve_type} TMS ${cv.tms.toFixed(2)}`,
          x: cv.points.map((p) => p.current_ka),
          y: cv.points.map((p) => p.operating_time_s),
          line: { color: colors[cv.relay_id] ?? c.aqua, width: 2 },
          hovertemplate: `${cv.relay_id}: %{y:.3f} s at %{x:.1f} kA<extra></extra>`,
        }))}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          transition: CHART_TRANSITION,
          legend: { orientation: "h", y: 1.02, yanchor: "bottom", x: 0, font: { size: 11 } },
          xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, type: "log", title: { text: "Fault current at 66 kV [kA]", font: { size: 12 } }, range: [Math.log10(1), Math.log10(40)], tickvals: [1, 2, 5, 10, 20, 40] },
          yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, type: "log", title: { text: "Operating time [s]", font: { size: 12 } }, range: [Math.log10(0.05), Math.log10(30)], tickvals: [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20] },
          shapes: tcc.fault_markers.map(
            (m) => ({ type: "line", xref: "x", yref: "paper", x0: m.current_ka, x1: m.current_ka, y0: 0, y1: 1, line: { color: c.ref, width: 1.5, dash: "dash" } }) as const,
          ),
          annotations: tcc.fault_markers.map(
            (m, i) => ({ x: Math.log10(m.current_ka), y: i ? 0.92 : 1, xref: "x", yref: "paper", xanchor: "right", yanchor: "top", text: `${m.label} ${m.current_ka.toFixed(1)} kA`, showarrow: false, font: { size: 10 } }) as const,
          ),
          margin: { t: 40, r: 16, b: 48, l: 60 },
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: 340 }}
      />
      <div className="flex flex-wrap gap-4 mt-2">
        {tcc.curves.map((cv) => (
          <TmsSlider key={cv.relay_id} id={cv.relay_id} label={label[cv.relay_id] ?? cv.relay_id} value={cv.tms} />
        ))}
      </div>
    </ChartWrapper>
  );
}
