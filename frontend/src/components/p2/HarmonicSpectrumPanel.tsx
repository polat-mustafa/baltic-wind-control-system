/**
 * From current to voltage: the WTG emission spectrum next to the harmonic
 * voltage it causes at the assessed bus, as a share of the planning level.
 * Two single-axis charts, same order axis, so resonance amplification shows
 * as a bar that grows from left to right.
 */

import Plot from "react-plotly.js";

import { powerQualityEducation } from "../../constants/education/p2";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { usePowerQualityStore } from "../../store/powerQualityStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { EducationButton } from "../ui/EducationButton";
import { useNetwork } from "../../store/gridStore";

export default function HarmonicSpectrumPanel() {
  const n = useNetwork();
  const { harmonics } = usePowerQualityStore();
  const c = useChartPalette();
  if (!harmonics?.harmonics.length) return null;
  const rows = harmonics.harmonics;
  const x = rows.map((r) => `h${r.order}`);
  const base = {
    ...DARK_PLOTLY_LAYOUT,
    transition: CHART_TRANSITION,
    showlegend: false,
    bargap: 0.3,
    xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, type: "category" as const, title: { text: "Harmonic order", font: { size: 12 } } },
    margin: { t: 16, r: 12, b: 48, l: 60 },
  };
  return (
    <ChartWrapper
      title={`Harmonics — WTG emission and the voltage it causes at ${harmonics.bus}`}
      headerRight={<EducationButton content={powerQualityEducation} />}
      footer={`THD ${harmonics.thd_voltage_pct.toFixed(2)} % (planning level ${harmonics.thd_limit_pct} %) · ${harmonics.violations.length ? `✗ ${harmonics.violations.join(" · ")}` : "✓ all orders below the IEC TR 61000-3-6 planning levels"} · emission illustrative full-converter, summed over ${n.num_turbines} WTGs`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-text-muted mb-1">One WTG's current emission [% of rated current]</p>
          <Plot
            data={[
              {
                type: "bar",
                x,
                y: rows.map((r) => r.current_pct),
                marker: { color: c.seq[2] },
                hovertemplate: "%{x}: %{y:.2f} % of rated current<extra></extra>",
              },
            ]}
            layout={{ ...base, yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "I_h [%]", font: { size: 12 } } } }}
            config={PLOTLY_CONFIG}
            useResizeHandler
            className="w-full"
            style={{ height: 260 }}
          />
        </div>
        <div>
          <p className="text-xs text-text-muted mb-1">Harmonic voltage as a share of its planning level [%]</p>
          <Plot
            data={[
              {
                type: "bar",
                x,
                y: rows.map((r) => r.utilisation_pct),
                customdata: rows.map((r) => [r.magnitude_pct, r.limit_pct, r.impedance_ohm]),
                marker: { color: rows.map((r) => (r.exceeds_limit ? c.red : c.blue)) },
                text: rows.map((r) => (r.utilisation_pct >= 20 ? `${r.utilisation_pct.toFixed(0)} %` : "")),
                textposition: "outside",
                textfont: { color: c.ink, size: 10 },
                cliponaxis: false,
                hovertemplate:
                  "%{x}: %{customdata[0]:.3f} % of U1 vs %{customdata[1]:.2f} % limit<br>|Z| at 66 kV %{customdata[2]:.1f} Ω<extra></extra>",
              },
            ]}
            layout={{
              ...base,
              yaxis: {
                ...DARK_PLOTLY_LAYOUT.yaxis,
                title: { text: "U_h / planning level [%]", font: { size: 12 } },
                range: [0, Math.max(110, ...rows.map((r) => r.utilisation_pct)) * 1.12],
              },
              shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 100, y1: 100, line: { color: c.ref, width: 1.5, dash: "dash" } } as const],
            }}
            config={PLOTLY_CONFIG}
            useResizeHandler
            className="w-full"
            style={{ height: 260 }}
          />
        </div>
      </div>
    </ChartWrapper>
  );
}
