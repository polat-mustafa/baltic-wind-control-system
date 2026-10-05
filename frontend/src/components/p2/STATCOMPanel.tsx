/**
 * Reactive power — where the cable's MVAR go, and the range PSE asks for.
 *
 * Left: no-load balance as a waterfall (cable charging → reactors → what is
 * left for the STATCOM, whose ±range is drawn around it).
 * Right: the reactive range deliverable at the PSE 400 kV POC at P_max vs the
 * PSE requirement (Art. 21(3)(c)), as two animated range bars on one axis.
 */

import { motion } from "framer-motion";
import type { PlotData } from "plotly.js";
import Plot from "react-plotly.js";

import { reactiveCompensationEducation } from "../../constants/education/p2";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { useGridStore } from "../../store/gridStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { EducationButton } from "../ui/EducationButton";

function RangeBar({
  label,
  min,
  max,
  lo,
  hi,
  color,
  outline,
}: {
  label: string;
  min: number;
  max: number;
  lo: number;
  hi: number;
  color: string;
  outline?: boolean;
}) {
  const pos = (v: number) => ((v - lo) / (hi - lo)) * 100;
  return (
    <div>
      <div className="flex justify-between text-[11px] text-text-secondary">
        <span>{label}</span>
        <span className="font-mono">
          {min.toFixed(0)} … +{max.toFixed(0)} MVAR
        </span>
      </div>
      <div className="relative mt-1 h-4 rounded bg-bg-tertiary">
        <motion.div
          className="absolute top-0 h-4 rounded"
          style={{
            background: outline ? "transparent" : color,
            border: outline ? `2px dashed ${color}` : undefined,
          }}
          initial={{ left: `${pos(0)}%`, width: 0 }}
          animate={{ left: `${pos(min)}%`, width: `${pos(max) - pos(min)}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="absolute top-[-3px] h-[22px] w-px bg-text-muted" style={{ left: `${pos(0)}%` }} />
      </div>
    </div>
  );
}

export default function STATCOMPanel() {
  const { statcomSizing: s } = useGridStore();
  const c = useChartPalette();
  if (!s) return null;

  const net = s.cable_q_mvar - s.reactor_q_mvar;
  const lo = Math.min(s.poc_q_min_mvar, s.pse_q_min_mvar) * 1.1;
  const hi = Math.max(s.poc_q_max_mvar, s.pse_q_max_mvar) * 1.1;

  // Built outside the JSX: plotly's typings lack `measure`/`totals` for waterfall traces
  const waterfall = {
    type: "waterfall" as const,
    orientation: "v",
    x: ["Cable charging", "3 × 80 MVAR reactors", "Left for STATCOM"],
    measure: ["relative", "relative", "total"],
    y: [s.cable_q_mvar, -s.reactor_q_mvar, net],
    text: [`+${s.cable_q_mvar.toFixed(0)}`, `−${s.reactor_q_mvar.toFixed(0)}`, `${net >= 0 ? "+" : ""}${net.toFixed(0)}`],
    textposition: "outside",
    textfont: { color: c.ink, size: 11 },
    cliponaxis: false,
    increasing: { marker: { color: c.orange } },
    decreasing: { marker: { color: c.blue } },
    totals: { marker: { color: c.seq[1] } },
    connector: { line: { color: c.ref, width: 1, dash: "dot" } },
    hovertemplate: "%{x}: %{y:+.0f} MVAR<extra></extra>",
    error_y: {
      type: "data",
      symmetric: true,
      array: [0, 0, s.statcom_rating_mvar],
      color: c.ink,
      thickness: 1.5,
      width: 10,
    },
  } as Partial<PlotData>;

  return (
    <ChartWrapper
      title="Reactive power — compensation and the PSE range"
      headerRight={<EducationButton content={reactiveCompensationEducation} />}
      footer={`Ferranti rise along 45 km: ${(s.ferranti_rise_pu * 100).toFixed(1)} % · uncompensated rise via transformers + grid: ${(s.uncompensated_rise_pu * 100).toFixed(1)} % · reactor N-1: STATCOM ${s.reactor_n1_statcom_q_mvar.toFixed(0)} MVAR ${s.reactor_n1_secure ? "✓" : "✗"}`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-text-muted mb-1">No-load balance at OSS 220 kV [MVAR], generating positive</p>
          <Plot
            data={[waterfall]}
            layout={{
              ...DARK_PLOTLY_LAYOUT,
              transition: CHART_TRANSITION,
              showlegend: false,
              yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "Q [MVAR]", font: { size: 12 } }, zeroline: true },
              xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, tickfont: { size: 11 } },
              annotations: [
                {
                  x: "Left for STATCOM",
                  y: net + s.statcom_rating_mvar,
                  text: `±${s.statcom_rating_mvar} STATCOM`,
                  showarrow: false,
                  yanchor: "bottom",
                  font: { size: 11 },
                } as const,
              ],
              margin: { t: 24, r: 8, b: 40, l: 56 },
            }}
            config={PLOTLY_CONFIG}
            useResizeHandler
            className="w-full"
            style={{ height: 300 }}
          />
        </div>
        <div className="flex flex-col justify-center gap-4 px-1">
          <p className="text-xs text-text-muted">
            Reactive range at the PSE 400 kV connection point at P = 510 MW (PSE Art. 21(3)(c): −0.35 … +0.40 P<sub>max</sub>)
          </p>
          <RangeBar label="PSE requirement" min={s.pse_q_min_mvar} max={s.pse_q_max_mvar} lo={lo} hi={hi} color={c.ink} outline />
          <RangeBar label="Farm capability" min={s.poc_q_min_mvar} max={s.poc_q_max_mvar} lo={lo} hi={hi} color={c.blue} />
          <div className="relative h-3 text-[10px] text-text-muted font-mono">
            <span className="absolute left-0">← absorbing</span>
            <span className="absolute -translate-x-1/2" style={{ left: `${(-lo / (hi - lo)) * 100}%` }}>
              0
            </span>
            <span className="absolute right-0">producing →</span>
          </div>
          <p className="text-xs text-text-secondary">
            {s.pse_q_range_met ? "✓ Requirement met" : "✗ Requirement not met"} — WTGs ±{s.wtg_q_capability_mvar} MVAR each
            (assumed), STATCOM ±{s.statcom_rating_mvar} MVAR, reactors switched, OLTCs regulating, farm buses kept in
            0.90–1.10 pu.
          </p>
        </div>
      </div>
    </ChartWrapper>
  );
}
