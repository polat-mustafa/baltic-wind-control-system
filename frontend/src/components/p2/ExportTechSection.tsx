/**
 * HVAC 220 kV vs VSC-HVDC ±320 kV export over 10–200 km: AC cable capacity
 * (charging current eats the ampacity) and annual losses.
 */

import Plot from "react-plotly.js";

import { exportTechEducation } from "../../constants/education/p2";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { usePlanningStore } from "../../store/planningStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { EducationButton } from "../ui/EducationButton";
import { KPICard } from "../ui/KPICard";
import { Slider } from "../ui/Slider";

const FARM_MW = 510;

export default function ExportTechSection() {
  const { design_length_km: L, exportStudy: r, setParams } = usePlanningStore();
  const c = useChartPalette();
  const s = r?.sweep ?? [];
  const x = s.map((p) => p.length_km);
  const marker = {
    type: "line" as const,
    xref: "x" as const,
    yref: "paper" as const,
    x0: L,
    x1: L,
    y0: 0,
    y1: 1,
    line: { color: c.ref, width: 1, dash: "dot" as const },
  };
  const layout = (yTitle: string) => ({
    ...DARK_PLOTLY_LAYOUT,
    transition: CHART_TRANSITION,
    legend: { orientation: "h" as const, y: 1.02, yanchor: "bottom" as const, x: 0, font: { size: 11 } },
    margin: { t: 48, r: 16, b: 44, l: 60 },
    xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Export route length [km]", font: { size: 12 } } },
    yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: yTitle, font: { size: 12 } }, rangemode: "tozero" as const },
  });
  const pct = (gwh: number) => (r ? `${((100 * gwh) / r.annual_energy_gwh).toFixed(1)} % of the energy` : "");

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-border-primary bg-bg-secondary p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-text-secondary">Export technology · HVAC 220 kV vs VSC-HVDC ±320 kV</p>
            <p className="text-[11px] text-text-secondary">This farm: 2 × 1000 mm² 220 kV circuits, 45 km.</p>
          </div>
          <Slider
            label="Export route length"
            value={L}
            display={`${L.toFixed(0)} km`}
            min={10}
            max={200}
            step={5}
            onChange={(v) => setParams({ design_length_km: v })}
          />
          <span className="ml-auto">
            <EducationButton content={exportTechEducation} />
          </span>
        </div>
      </div>

      {r && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPICard
              label="HVAC capacity"
              value={r.hvac.capacity_mw.toFixed(0)}
              unit="MW"
              trendValue={r.hvac.capacity_mw >= FARM_MW ? "carries 510 MW" : "below 510 MW — a third circuit or HVDC"}
            />
            <KPICard label="Cable charging" value={r.hvac.charging_mvar.toFixed(0)} unit="Mvar" trendValue="to be absorbed by reactors" />
            <KPICard label="HVAC losses" value={r.hvac.loss_gwh.toFixed(1)} unit="GWh/yr" trendValue={pct(r.hvac.loss_gwh)} />
            <KPICard label="HVDC losses" value={r.hvdc.loss_gwh.toFixed(1)} unit="GWh/yr" trendValue={pct(r.hvdc.loss_gwh)} />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <ChartWrapper
              title="What a 220 kV AC export can carry"
              footer={`Charging current Ic = ωC·L·U/√3 flows even at zero power. Compensated at both ends, each cable end carries √(Ip² + (Ic/2)²) ≤ 950 A, so the active power left falls with length — below 510 MW beyond ${r.hvac_capacity_limit_km ?? ">200"} km. DC cables have no charging current.`}
            >
              <Plot
                data={[
                  {
                    type: "scatter",
                    mode: "lines",
                    name: "2 × 220 kV AC circuits",
                    x,
                    y: s.map((p) => p.hvac_capacity_mw),
                    line: { color: c.blue, width: 2 },
                    hovertemplate: "%{y:.0f} MW at %{x} km<extra></extra>",
                  },
                  {
                    type: "scatter",
                    mode: "lines",
                    name: "Farm 510 MW",
                    x: [x[0], x[x.length - 1]],
                    y: [FARM_MW, FARM_MW],
                    line: { color: c.red, width: 1.5, dash: "dash" },
                    hoverinfo: "skip",
                  },
                ]}
                layout={{ ...layout("Active power capacity [MW]"), shapes: [marker] }}
                config={PLOTLY_CONFIG}
                useResizeHandler
                className="w-full"
                style={{ height: 300 }}
              />
            </ChartWrapper>
            <ChartWrapper
              title="Annual export losses"
              footer={`Over the site's wind year (${r.annual_energy_gwh.toFixed(0)} GWh before wakes). HVAC: conductor I²R incl. charging current, dielectric Q·tan δ. HVDC: cable I²R + 2 converters at ≈1 % each (assumption). Reactor, STATCOM and transformer losses left out. HVDC loses less only beyond ${r.loss_crossover_km ?? ">200"} km.`}
            >
              <Plot
                data={[
                  {
                    type: "scatter",
                    mode: "lines",
                    name: "HVAC 220 kV",
                    x,
                    y: s.map((p) => p.hvac_loss_gwh),
                    line: { color: c.blue, width: 2 },
                    hovertemplate: "HVAC %{y:.1f} GWh at %{x} km<extra></extra>",
                  },
                  {
                    type: "scatter",
                    mode: "lines",
                    name: "VSC-HVDC ±320 kV",
                    x,
                    y: s.map((p) => p.hvdc_loss_gwh),
                    line: { color: c.orange, width: 2 },
                    hovertemplate: "HVDC %{y:.1f} GWh at %{x} km<extra></extra>",
                  },
                ]}
                layout={{ ...layout("Losses [GWh/yr]"), shapes: [marker] }}
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
