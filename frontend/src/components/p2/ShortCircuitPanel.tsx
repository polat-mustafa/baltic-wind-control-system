/**
 * Breaker duty — IEC 60909 maximum fault currents against switchgear ratings.
 *
 * Absolute kA at 400, 220 and 66 kV are not comparable on one axis, so each
 * busbar is shown as a share of its own breaker: breaking duty Ik''/I_b and
 * making duty ip/(2.5·I_b). Below 100 % = the switchgear can clear and close
 * onto the worst fault.
 */

import Plot from "react-plotly.js";

import { shortCircuitEducation } from "../../constants/education/p2";
import { CHART_HEIGHT, DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { useGridStore } from "../../store/gridStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { EducationButton } from "../ui/EducationButton";

const BUSES: [string, string][] = [
  ["WTG_01", "WTG 01 (66 kV)"],
  ["OSS_66kV", "OSS 66 kV"],
  ["OSS_220kV", "OSS 220 kV"],
  ["Onshore_220kV", "Onshore 220 kV"],
  ["PSE_400kV", "PSE 400 kV"],
];

export default function ShortCircuitPanel() {
  const { shortCircuit } = useGridStore();
  const c = useChartPalette();
  if (!shortCircuit) return null;

  const rows = BUSES.flatMap(([bus, label]) => {
    const r = shortCircuit.bus_results.find((b) => b.bus_name === bus);
    if (!r || !r.breaker_ka) return [];
    return [
      {
        label: `${label} · ${r.breaker_ka} kA CB`,
        breaking: (r.ikss_ka / r.breaker_ka) * 100,
        making: (r.ip_ka / r.making_ka) * 100,
        ik: r.ikss_ka,
        ip: r.ip_ka,
        sk: r.skss_mw,
        ib: r.breaker_ka,
        im: r.making_ka,
      },
    ];
  });
  if (!rows.length) return null;

  const y = rows.map((r) => r.label);
  const bar = (name: string, x: number[], color: string, hover: string) => ({
    type: "bar" as const,
    orientation: "h" as const,
    name,
    y,
    x,
    customdata: rows.map((r) => [r.ik, r.ip, r.ib, r.im, r.sk]),
    marker: { color },
    hovertemplate: hover,
  });

  return (
    <ChartWrapper
      title={`Breaker duty — IEC 60909, c = ${shortCircuit.voltage_factor_c.toFixed(2)}`}
      headerRight={<EducationButton content={shortCircuitEducation} />}
      footer={`${shortCircuit.breaker_adequate ? "✓ All breakers adequate" : "✗ Breaker duty exceeded"} · highest Ik'' ${shortCircuit.max_ikss_ka.toFixed(1)} kA at ${shortCircuit.max_ikss_bus.replace("_", " ")}`}
    >
      <Plot
        data={[
          bar(
            "Breaking duty Ik'' / I_b",
            rows.map((r) => r.breaking),
            c.blue,
            "%{y}<br>Ik'' %{customdata[0]:.1f} kA of %{customdata[2]} kA (%{x:.0f} %)<br>Sk'' %{customdata[4]:,.0f} MVA<extra></extra>",
          ),
          bar(
            "Making duty ip / (2.5·I_b)",
            rows.map((r) => r.making),
            c.orange,
            "%{y}<br>ip %{customdata[1]:.1f} kA of %{customdata[3]} kA (%{x:.0f} %)<extra></extra>",
          ),
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          transition: CHART_TRANSITION,
          barmode: "group",
          bargap: 0.3,
          bargroupgap: 0.08,
          legend: { orientation: "h", y: 1.12, x: 0, font: { size: 11 } },
          xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Share of switchgear rating [%]", font: { size: 12 } }, range: [0, 110] },
          yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, type: "category", automargin: true, tickfont: { size: 11 } },
          shapes: [
            { type: "line", xref: "x", yref: "paper", x0: 100, x1: 100, y0: 0, y1: 1, line: { color: c.ref, width: 1.5, dash: "dash" } } as const,
          ],
          margin: { t: 36, r: 16, b: 48, l: 8 },
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: CHART_HEIGHT }}
      />
    </ChartWrapper>
  );
}
