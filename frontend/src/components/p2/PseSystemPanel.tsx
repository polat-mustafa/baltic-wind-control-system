/**
 * The real Polish system on one day (PSE open data, GET /api/v1/grid/pse/day):
 * wind, solar and demand per 15 min, with the market price RCE, and what wind
 * earned — its capture price against the day average. Today's quarter-hours
 * fill in about an hour behind real time; RCE is known a day ahead.
 */

import { useEffect, useState } from "react";
import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useChartPalette } from "../../hooks/useChartPalette";
import { getPseDay } from "../../services/marketApi";
import type { PseDay } from "../../types/market";
import { ChartWrapper } from "../ui/ChartWrapper";
import { KPICard } from "../ui/KPICard";
import { SourceBadge } from "../ui/SourceBadge";

/** The day before an ISO date. */
const yesterday = (iso: string) => new Date(Date.parse(`${iso}T12:00:00Z`) - 864e5).toISOString().slice(0, 10);

const fmt = (v: number | null | undefined, d = 0) => (v == null ? "—" : v.toLocaleString("en", { maximumFractionDigits: d }));

export default function PseSystemPanel({ date }: { date?: string }) {
  const [day, setDay] = useState<PseDay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const c = useChartPalette();

  useEffect(() => {
    let live = true;
    setError(null);
    getPseDay(date)
      // today before ~1 am has no generation yet: show yesterday (an explicit date stays)
      .then((d) => (date || d.summary.quarters_filled >= 4 ? d : getPseDay(yesterday(d.date))))
      .then((d) => live && setDay(d))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [date]);

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-status-warning/40 bg-status-warning/10 p-3 text-sm text-text-primary">
        PSE open data unavailable: {error}
      </div>
    );
  }
  if (!day) return <div className="h-[420px] rounded-lg border border-border-primary bg-bg-secondary" aria-busy="true" />;

  const q = day.quarters;
  const x = q.map((r) => r.time);
  const s = day.summary;
  return (
    <section className="space-y-3" aria-label="The real Polish system on this day">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Wind share of demand" value={fmt(s.wind_share_pct, 1)} unit="%" trendValue={`${fmt(s.wind_mwh / 1000, 1)} GWh wind · ${fmt(s.demand_mwh / 1000, 1)} GWh demand`} />
        <KPICard label="Wind capture price" value={fmt(s.wind_capture_price_pln_mwh)} unit="PLN/MWh" trendValue={`${fmt(s.wind_capture_rate_pct)} % of the ${fmt(s.avg_price_pln_mwh)} PLN/MWh average`} />
        <KPICard label="Wind peak" value={fmt((s.wind_peak_mw ?? 0) / 1000, 1)} unit="GW" trendValue={`solar ${fmt(s.pv_share_pct, 1)} % of demand`} />
        <KPICard label="Negative-price quarters" value={String(s.negative_price_quarters)} unit="× 15 min" trendValue={s.last_filled ? `data to ${s.last_filled.slice(11, 16)} (Polish time)` : "no data yet"} />
      </div>
      <ChartWrapper
        title={`The Polish system on ${day.date} — wind, solar, demand and RCE`}
        footer={`${day.source}. Generation and demand per 15 min (MW, filled in about an hour behind real time); RCE is the market price per 15 min, published the day before. Wind sold at its capture price: windy hours tend to be the cheap ones.`}
      >
        <div className="mb-1">
          <SourceBadge p={{ source: day.source, quality: "official", note: "TSO operational data" }} />
        </div>
        <Plot
          data={[
            { type: "scatter", mode: "lines", name: "Wind", x, y: q.map((r) => r.wind_mw), stackgroup: "gen", line: { color: c.blue, width: 1 }, hovertemplate: "Wind %{y:,.0f} MW<extra></extra>" },
            { type: "scatter", mode: "lines", name: "Solar", x, y: q.map((r) => r.pv_mw), stackgroup: "gen", line: { color: c.yellow, width: 1 }, hovertemplate: "Solar %{y:,.0f} MW<extra></extra>" },
            { type: "scatter", mode: "lines", name: "Demand", x, y: q.map((r) => r.demand_mw), line: { color: c.ink, width: 2 }, hovertemplate: "Demand %{y:,.0f} MW<extra></extra>" },
            {
              type: "scatter",
              mode: "lines",
              name: "RCE price",
              x,
              y: q.map((r) => r.price_pln_mwh),
              yaxis: "y2",
              line: { color: c.red, width: 2, shape: "hv" },
              hovertemplate: "RCE %{y:.0f} PLN/MWh<extra></extra>",
            },
          ]}
          layout={{
            ...DARK_PLOTLY_LAYOUT,
            height: 360,
            margin: { l: 56, r: 56, t: 10, b: 40 },
            xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, type: "date", tickformat: "%H:%M" },
            yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "MW" }, rangemode: "tozero" },
            yaxis2: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "PLN/MWh" }, overlaying: "y", side: "right", showgrid: false },
            legend: { orientation: "h", y: 1.1 },
            hovermode: "x unified",
          }}
          config={PLOTLY_CONFIG}
          style={{ width: "100%" }}
          useResizeHandler
        />
      </ChartWrapper>
    </section>
  );
}
