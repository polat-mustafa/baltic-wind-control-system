/**
 * Electrolyser on the energy above a grid connection limit: the farm's
 * output duration curve split into exported / electrolysed / still lost,
 * and the levelised cost of hydrogen against full-load hours.
 */

import Plot from "react-plotly.js";

import { p2xEducation } from "../../constants/education/p2";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { usePlanningStore } from "../../store/planningStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { EducationButton } from "../ui/EducationButton";
import { KPICard } from "../ui/KPICard";
import { Slider } from "../ui/Slider";

export default function P2XSection() {
  const { connection_mw, electrolyser_mw, capex_eur_per_kw, p2x: r, setParams } = usePlanningStore();
  const c = useChartPalette();
  const hours = r ? r.duration_mw.map((_, i) => i * r.duration_step_h) : [];
  const cap = r?.connection_mw ?? connection_mw;
  const top = cap + (r?.electrolyser_mw ?? electrolyser_mw);
  const legend = { orientation: "h" as const, y: 1.02, yanchor: "bottom" as const, x: 0, font: { size: 11 } };
  const priceColors = [c.aqua, c.blue, c.orange];

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-border-primary bg-bg-secondary p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-text-secondary">Power-to-X · PEM electrolyser on energy above the grid limit</p>
            <p className="text-[11px] text-text-secondary">What if PSE grants less than 510 MW of connection capacity?</p>
          </div>
          <Slider
            label="Grid connection"
            value={connection_mw}
            display={`${connection_mw.toFixed(0)} MW`}
            min={250}
            max={510}
            step={10}
            onChange={(v) => setParams({ connection_mw: v })}
          />
          <Slider
            label="Electrolyser"
            value={electrolyser_mw}
            display={`${electrolyser_mw.toFixed(0)} MW`}
            min={5}
            max={250}
            step={5}
            onChange={(v) => setParams({ electrolyser_mw: v })}
          />
          <Slider
            label="Installed cost (assumption)"
            value={capex_eur_per_kw}
            display={`${capex_eur_per_kw.toFixed(0)} €/kW`}
            min={500}
            max={4000}
            step={100}
            onChange={(v) => setParams({ capex_eur_per_kw: v })}
          />
          <span className="ml-auto">
            <EducationButton content={p2xEducation} />
          </span>
        </div>
      </div>

      {r && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPICard
              label="Energy above the limit"
              value={r.surplus_gwh.toFixed(0)}
              unit="GWh/yr"
              trendValue={`${r.surplus_hours} h/yr · ${((100 * r.surplus_gwh) / r.farm_energy_gwh).toFixed(1)} % of output`}
            />
            <KPICard
              label="Hydrogen"
              value={r.h2_tonnes.toFixed(0)}
              unit="t/yr"
              trendValue={`${r.absorbed_gwh.toFixed(0)} GWh absorbed · ${r.still_lost_gwh.toFixed(0)} GWh still lost`}
            />
            <KPICard label="Full-load hours" value={r.full_load_hours.toFixed(0)} unit="h/yr" trendValue={`of ${r.electrolyser_mw.toFixed(0)} MW`} />
            <KPICard
              label="Cost of hydrogen"
              value={r.lcoh_eur_kg?.toFixed(2) ?? "—"}
              unit="€/kg"
              trendValue={`free surplus energy · LHV efficiency ${(100 * r.efficiency_lhv).toFixed(0)} %`}
            />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <ChartWrapper
              title="Farm output duration curve"
              footer="The 8760 hours of the site's wind year sorted by output (Weibull 9.3 m/s, k = 2.2 as in P1; multi-turbine power curve, 97 % availability; wakes not deducted). Output above the grid limit is lost unless the electrolyser absorbs it; below 10 % load it cannot run."
            >
              <Plot
                data={[
                  {
                    type: "scatter",
                    mode: "lines",
                    name: "Exported",
                    x: hours,
                    y: r.duration_mw.map((p) => Math.min(p, cap)),
                    fill: "tozeroy",
                    fillcolor: `${c.blue}40`,
                    line: { color: c.blue, width: 1.5 },
                    hovertemplate: "%{y:.0f} MW exported at hour %{x}<extra></extra>",
                  },
                  {
                    type: "scatter",
                    mode: "lines",
                    name: "To electrolyser",
                    x: hours,
                    y: r.duration_mw.map((p) => Math.min(p, top)),
                    fill: "tonexty",
                    fillcolor: `${c.aqua}70`,
                    line: { color: c.aqua, width: 1 },
                    hoverinfo: "skip",
                  },
                  {
                    type: "scatter",
                    mode: "lines",
                    name: "Still lost",
                    x: hours,
                    y: r.duration_mw,
                    fill: "tonexty",
                    fillcolor: `${c.red}50`,
                    line: { color: c.red, width: 1 },
                    hovertemplate: "farm %{y:.0f} MW<extra></extra>",
                  },
                ]}
                layout={{
                  ...DARK_PLOTLY_LAYOUT,
                  transition: CHART_TRANSITION,
                  legend: { ...legend, traceorder: "normal" as const },
                  margin: { t: 48, r: 16, b: 44, l: 60 },
                  xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Hours per year", font: { size: 12 } }, range: [0, 8760] },
                  yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "Farm output [MW]", font: { size: 12 } }, range: [0, 530] },
                  shapes: [
                    { type: "line", xref: "paper", yref: "y", x0: 0, x1: 1, y0: cap, y1: cap, line: { color: c.ref, width: 1, dash: "dash" } },
                  ],
                  annotations: [
                    { xref: "paper", yref: "y", x: 1, y: cap, xanchor: "right", yanchor: "top", text: `grid limit ${cap.toFixed(0)} MW`, showarrow: false, font: { size: 10, color: c.ref } },
                  ],
                }}
                config={PLOTLY_CONFIG}
                useResizeHandler
                className="w-full"
                style={{ height: 300 }}
              />
            </ChartWrapper>
            <ChartWrapper
              title="Levelised cost of hydrogen vs full-load hours"
              footer={`LCOH = capital·(CRF + 3 % O&M)/(FLH/SEC) + price·SEC, with SEC = 53 kWh/kg, 7 % WACC, 20 years (assumptions). Few running hours make H₂ expensive however cheap the power. Back to power via H₂ returns only ≈${(100 * r.power_to_power).toFixed(0)} % of the electricity.`}
            >
              <Plot
                data={[
                  ...r.lcoh_curves.map((curve, i) => ({
                    type: "scatter" as const,
                    mode: "lines" as const,
                    name: `power at ${curve.price_eur_mwh} €/MWh`,
                    x: r.lcoh_flh,
                    y: curve.lcoh_eur_kg,
                    line: { color: priceColors[i], width: 2 },
                    hovertemplate: `%{y:.2f} €/kg at %{x} h · ${curve.price_eur_mwh} €/MWh<extra></extra>`,
                  })),
                  ...(r.lcoh_eur_kg === null
                    ? []
                    : [
                        {
                          type: "scatter" as const,
                          mode: "markers" as const,
                          name: "This electrolyser",
                          x: [r.full_load_hours],
                          y: [r.lcoh_eur_kg],
                          marker: { color: c.ink, size: 10, symbol: "diamond" as const },
                          hovertemplate: "%{y:.2f} €/kg at %{x} h<extra></extra>",
                        },
                      ]),
                ]}
                layout={{
                  ...DARK_PLOTLY_LAYOUT,
                  transition: CHART_TRANSITION,
                  legend,
                  margin: { t: 48, r: 16, b: 44, l: 60 },
                  xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Full-load hours [h/yr]", font: { size: 12 } } },
                  yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "LCOH [€/kg]", font: { size: 12 } }, range: [0, 20] },
                }}
                config={PLOTLY_CONFIG}
                useResizeHandler
                className="w-full"
                style={{ height: 300 }}
              />
            </ChartWrapper>
          </div>
        </>
      )}
    </section>
  );
}
