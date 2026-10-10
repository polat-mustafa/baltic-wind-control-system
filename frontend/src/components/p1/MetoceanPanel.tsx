/**
 * Sea conditions at SB-510 from the Copernicus Marine Baltic reanalyses
 * (GET /api/v1/wind/metocean): wave climate since 1980 with the 50-year Hs,
 * monthly vessel access, the seabed temperature along the export route since
 * 1993 and what it does to the cable rating, sea ice from two sources.
 */

import { useEffect, useState } from "react";
import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useChartPalette } from "../../hooks/useChartPalette";
import { request } from "../../services/apiClient";
import { ChartWrapper } from "../ui/ChartWrapper";
import { KPICard } from "../ui/KPICard";
import { SourceBadge } from "../ui/SourceBadge";

interface SeabedPoint {
  label: string;
  monthly_mean_c: number[];
  monthly_p99_c: number[];
  max_c: number;
  max_date: string;
}
interface Metocean {
  attribution: string;
  licence: string;
  waves: {
    source: string;
    period: [string, string];
    hs_p50_m: number;
    hs_p99_m: number;
    hs_max_m: number;
    hs_max_time: string;
    hs_50yr_m: number;
    annual_max_years: [number, number];
    hs_monthly_mean_m: number[];
    access_hs_le_1_5_pct: number[];
    access_hs_le_2_5_pct: number[];
  };
  sea: { source: string; seabed: SeabedPoint[]; current_p99_ms: number; sst_monthly_mean_c: number[] };
  cable: {
    static_rating_a: number;
    design_ambient_c: number;
    full_load_a: number;
    sections: { section: string; seabed_point: string; monthly_rating_a: number[] }[];
  };
  ice: { oisst: { days: Record<string, number> }; cmems: { ice_days_by_winter: Record<string, number>; max_thickness_m: number } };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

export default function MetoceanPanel() {
  const [d, setD] = useState<Metocean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const c = useChartPalette();

  useEffect(() => {
    request<Metocean>("/api/v1/wind/metocean")
      .then(setD)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-status-warning">Sea conditions unavailable: {error}</p>;
  if (!d) return <div className="h-96 rounded-lg border border-border-primary bg-bg-secondary" aria-busy="true" />;

  const w = d.waves;
  const lines = [c.blue, c.orange, c.aqua];
  const layout = (h: number) => ({ ...DARK_PLOTLY_LAYOUT, height: h, margin: { l: 52, r: 60, t: 64, b: 36 }, legend: { orientation: "h" as const, y: 1.02, yanchor: "bottom" as const } });
  const ratings = d.cable.sections.flatMap((s) => s.monthly_rating_a);
  return (
    <section className="space-y-3" aria-labelledby="metocean-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="metocean-title" className="text-base font-semibold text-text-primary">
            Sea conditions at the site: Copernicus Marine reanalyses
          </h3>
          <p className="text-xs text-text-muted">
            Baltic wave model hourly {w.period[0].slice(0, 4)}–{w.period[1].slice(0, 4)}, ocean model daily since 1993. The wave record also drives the weather windows and campaign runs.
          </p>
        </div>
        <SourceBadge p={{ source: `${w.source}; ${d.sea.source}`, license: d.licence, quality: "measured", note: "reanalysis: model with assimilated observations" }} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KPICard label="Hs median / P99" value={`${w.hs_p50_m.toFixed(1)} / ${w.hs_p99_m.toFixed(1)}`} unit="m" trendValue="significant wave height, all hours" />
        <KPICard label="Highest Hs on record" value={w.hs_max_m.toFixed(1)} unit="m" trendValue={`${w.hs_max_time.slice(0, 10)}`} />
        <KPICard label="50-year Hs (Gumbel)" value={w.hs_50yr_m.toFixed(1)} unit="m" trendValue={`annual maxima ${w.annual_max_years[0]}–${w.annual_max_years[1]}`} />
        <KPICard label="Surface current P99" value={d.sea.current_p99_ms.toFixed(2)} unit="m/s" trendValue="daily means, scour and vessel ops" />
        <KPICard
          label="Ice days per winter"
          value={`${(sum(d.ice.cmems.ice_days_by_winter) / Object.keys(d.ice.cmems.ice_days_by_winter).length).toFixed(1)}`}
          unit="days"
          trendValue={`ice model; NOAA OISST ${(sum(d.ice.oisst.days) / Object.keys(d.ice.oisst.days).length).toFixed(1)} (used, conservative)`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartWrapper
          title="Waves by month and who can work"
          footer="Mean Hs per month (bars) and the share of hours under the vessel limits: CTV Hs ≤ 1.5 m, SOV Hs ≤ 2.5 m (wave limit only; wind limits apply too)."
        >
          <Plot
            data={[
              { type: "bar", name: "Mean Hs", x: MONTHS, y: w.hs_monthly_mean_m, marker: { color: c.blue }, hovertemplate: "%{x}: Hs %{y:.2f} m<extra></extra>" },
              { type: "scatter", mode: "lines+markers", name: "CTV access", x: MONTHS, y: w.access_hs_le_1_5_pct, yaxis: "y2", line: { color: c.orange, width: 2 }, hovertemplate: "CTV %{y:.0f} %<extra></extra>" },
              { type: "scatter", mode: "lines+markers", name: "SOV access", x: MONTHS, y: w.access_hs_le_2_5_pct, yaxis: "y2", line: { color: c.aqua, width: 2 }, hovertemplate: "SOV %{y:.0f} %<extra></extra>" },
            ]}
            layout={{
              ...layout(300),
              yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "Hs [m]" }, rangemode: "tozero" },
              yaxis2: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "hours [%]" }, overlaying: "y", side: "right", range: [0, 100], dtick: 25, tickmode: "linear", showgrid: false },
            }}
            config={PLOTLY_CONFIG}
            style={{ width: "100%" }}
            useResizeHandler
          />
        </ChartWrapper>
        <ChartWrapper
          title="Seabed temperature along the export cable and its rating"
          footer={`Monthly 99th percentile of the bottom-water temperature (the cable's ambient; the datasheet rating of ${d.cable.static_rating_a.toFixed(0)} A assumes ${d.cable.design_ambient_c} °C) and the rating it gives each buried section — against ${d.cable.full_load_a.toFixed(0)} A per circuit at 510 MW. Bottom water over the burial depth is conservative: the sediment damps the summer peak.`}
        >
          <Plot
            data={[
              ...d.sea.seabed.map((p, k) => ({
                type: "scatter" as const,
                mode: "lines" as const,
                name: p.label,
                x: MONTHS,
                y: p.monthly_p99_c,
                line: { color: lines[k % lines.length], width: 2 },
                hovertemplate: `${p.label}: %{y:.1f} °C<extra></extra>`,
              })),
              ...d.cable.sections.map((s, k) => ({
                type: "scatter" as const,
                mode: "lines" as const,
                name: `${s.section} rating`,
                x: MONTHS,
                y: s.monthly_rating_a,
                yaxis: "y2",
                line: { color: lines[(k + 1) % lines.length], width: 2, dash: "dot" as const },
                hovertemplate: `${s.section}: %{y:.0f} A<extra></extra>`,
              })),
            ]}
            layout={{
              ...layout(320),
              yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "seabed [°C]" } },
              yaxis2: {
                ...DARK_PLOTLY_LAYOUT.yaxis,
                title: { text: "rating [A]" },
                overlaying: "y",
                side: "right",
                tickmode: "auto",
                showgrid: false,
                range: [Math.min(d.cable.full_load_a, ...ratings) - 30, Math.max(...ratings) + 30],
              },
              shapes: [
                { type: "line", xref: "paper", x0: 0, x1: 1, yref: "y2", y0: d.cable.full_load_a, y1: d.cable.full_load_a, line: { color: c.red, dash: "dash", width: 1 } },
                { type: "line", xref: "paper", x0: 0, x1: 1, yref: "y", y0: d.cable.design_ambient_c, y1: d.cable.design_ambient_c, line: { color: c.ref, dash: "dash", width: 1 } },
              ],
            }}
            config={PLOTLY_CONFIG}
            style={{ width: "100%" }}
            useResizeHandler
          />
        </ChartWrapper>
      </div>
      <p className="text-xs text-text-muted">
        {d.attribution} · {w.source} · {d.sea.source}. Ice: the ice model shows far fewer ice days than NOAA OISST (a 25 km microwave cell this near the coast also sees coastal ice); campaign planning keeps OISST, the conservative count.
      </p>
    </section>
  );
}
