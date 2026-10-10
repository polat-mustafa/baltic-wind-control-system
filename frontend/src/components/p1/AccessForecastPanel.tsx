/**
 * The next 7 days at the site for the O&M fleet: forecast significant wave
 * height and 10 m wind (Open-Meteo forecast + marine APIs, CC BY 4.0) against
 * the vessel limits (CTV Hs ≤ 1.5 m and U10 ≤ 10 m/s, SOV 2.5 m / 15 m/s —
 * the same limits as the ERA5 access statistics), as accessible hours per
 * day. The statistics say how often; this says which days.
 */

import { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useChartPalette } from "../../hooks/useChartPalette";
import { cn } from "../../lib/utils";
import { SITE_LATLON } from "../../services/openMeteoApi";
import { HS_LIMIT, VW_LIMIT } from "../landing/maritime";
import { SourceBadge } from "../ui/SourceBadge";

interface Hourly {
  time: string[];
  hs: (number | null)[];
  u10: (number | null)[];
}

async function fetchForecast(signal: AbortSignal): Promise<Hourly> {
  const q = `latitude=${SITE_LATLON.lat}&longitude=${SITE_LATLON.lon}&timezone=Europe%2FWarsaw&forecast_days=7`;
  const [wind, sea] = await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?${q}&hourly=wind_speed_10m&wind_speed_unit=ms`, { signal }).then((r) => {
      if (!r.ok) throw new Error(`Open-Meteo forecast HTTP ${r.status}`);
      return r.json() as Promise<{ hourly: { time: string[]; wind_speed_10m: (number | null)[] } }>;
    }),
    fetch(`https://marine-api.open-meteo.com/v1/marine?${q}&hourly=wave_height`, { signal }).then((r) => {
      if (!r.ok) throw new Error(`Open-Meteo marine HTTP ${r.status}`);
      return r.json() as Promise<{ hourly: { time: string[]; wave_height: (number | null)[] } }>;
    }),
  ]);
  const hsAt = new Map(sea.hourly.time.map((t, i) => [t, sea.hourly.wave_height[i]]));
  return { time: wind.hourly.time, u10: wind.hourly.wind_speed_10m, hs: wind.hourly.time.map((t) => hsAt.get(t) ?? null) };
}

type Kind = keyof typeof HS_LIMIT;
const open = (h: Hourly, i: number, k: Kind) => h.hs[i] != null && h.u10[i] != null && h.hs[i]! <= HS_LIMIT[k] && h.u10[i]! <= VW_LIMIT[k];

export default function AccessForecastPanel() {
  const [data, setData] = useState<Hourly | null>(null);
  const [error, setError] = useState<string | null>(null);
  const c = useChartPalette();

  useEffect(() => {
    const ctl = new AbortController();
    fetchForecast(ctl.signal)
      .then(setData)
      .catch((e: Error) => e.name !== "AbortError" && setError(e.message));
    return () => ctl.abort();
  }, []);

  // accessible hours per day (local time) for each vessel
  const days = useMemo(() => {
    if (!data) return [];
    const by = new Map<string, { CTV: number; SOV: number; n: number }>();
    data.time.forEach((t, i) => {
      const d = by.get(t.slice(0, 10)) ?? { CTV: 0, SOV: 0, n: 0 };
      d.n += 1;
      if (open(data, i, "CTV")) d.CTV += 1;
      if (open(data, i, "SOV")) d.SOV += 1;
      by.set(t.slice(0, 10), d);
    });
    return [...by.entries()].map(([day, d]) => ({ day, ...d }));
  }, [data]);

  if (error) return <p className="text-sm text-status-warning">Access forecast unavailable: {error}</p>;
  if (!data) return <div className="h-72 rounded-lg border border-border-primary bg-bg-secondary" aria-busy="true" />;

  const cell = (h: number, n: number) =>
    h >= 0.75 * n ? "bg-status-normal/20 text-status-normal" : h >= 4 ? "bg-status-warning/15 text-status-warning" : "bg-status-alarm/10 text-status-alarm";
  return (
    <section className="space-y-3 rounded-lg border border-border-primary bg-bg-secondary p-4" aria-labelledby="access-fc-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="access-fc-title" className="text-base font-semibold text-text-primary">
            Next 7 days at the site: who can go out
          </h3>
          <p className="text-xs text-text-muted">
            Forecast wave height and 10 m wind against the vessel limits (CTV Hs ≤ {HS_LIMIT.CTV} m, U10 ≤ {VW_LIMIT.CTV} m/s; SOV {HS_LIMIT.SOV} m, {VW_LIMIT.SOV} m/s).
          </p>
        </div>
        <SourceBadge p={{ source: "Open-Meteo forecast + marine API (ECMWF / DWD ICON, wave models)", license: "CC BY 4.0", quality: "official", note: "forecast, not a measurement" }} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-xs">
          <thead>
            <tr className="text-text-muted">
              <th className="py-1 pr-2 text-left font-medium">Accessible hours</th>
              {days.map((d) => (
                <th key={d.day} className="px-1 py-1 text-center font-medium">
                  {new Date(`${d.day}T12:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(["CTV", "SOV"] as const).map((k) => (
              <tr key={k}>
                <th scope="row" className="py-1 pr-2 text-left font-medium text-text-secondary">
                  {k}
                </th>
                {days.map((d) => (
                  <td key={d.day} className="px-1 py-1">
                    <span className={cn("block rounded px-1 py-0.5 text-center font-mono", cell(d[k], d.n))}>
                      {d[k]} / {d.n} h
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Plot
        data={[
          { type: "scatter", mode: "lines", name: "Hs", x: data.time, y: data.hs, line: { color: c.blue, width: 2 }, hovertemplate: "Hs %{y:.1f} m<extra></extra>" },
          { type: "scatter", mode: "lines", name: "U10", x: data.time, y: data.u10, yaxis: "y2", line: { color: c.orange, width: 1.5 }, hovertemplate: "U10 %{y:.1f} m/s<extra></extra>" },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: 240,
          margin: { l: 48, r: 48, t: 10, b: 36 },
          xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, type: "date" },
          yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "Hs [m]" }, rangemode: "tozero" },
          yaxis2: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "U10 [m/s]" }, overlaying: "y", side: "right", showgrid: false, rangemode: "tozero" },
          shapes: (["CTV", "SOV"] as const).map((k) => ({
            type: "line" as const,
            xref: "paper" as const,
            x0: 0,
            x1: 1,
            y0: HS_LIMIT[k],
            y1: HS_LIMIT[k],
            line: { color: c.ref, dash: "dash" as const, width: 1 },
          })),
          legend: { orientation: "h", y: 1.12 },
          hovermode: "x unified",
        }}
        config={PLOTLY_CONFIG}
        style={{ width: "100%" }}
        useResizeHandler
      />
    </section>
  );
}
