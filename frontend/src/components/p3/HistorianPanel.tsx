/**
 * SCADA historian — trends of IEC 61400-25 tags (TimescaleDB-style tiers).
 *
 * One panel per selected tag on a shared time axis (small multiples): each
 * tag keeps its own unit and scale instead of MW, Hz and MVAr sharing one
 * y axis. The nominal value is a dotted reference line. All tags come from
 * one physical plant state on the backend, so wind, turbine power, farm
 * output, currents and STATCOM move together.
 */

import { useCallback, useEffect, useState } from "react";
import Plot from "react-plotly.js";
import { RefreshCw } from "lucide-react";

import * as api from "../../services/scadaApi";
import type { HistorianTagMeta, TagTimeSeries } from "../../types/scada";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { cn } from "../../lib/utils";

const RANGES = [
  { label: "1 h", hours: 1, resolution: "1min" },
  { label: "4 h", hours: 4, resolution: "5min" },
  { label: "24 h", hours: 24, resolution: "15min" },
  { label: "7 d", hours: 168, resolution: "1hr" },
] as const;

const DEFAULT_TAGS = ["SB5.WTG_01.WMET1.WdSpd", "SB5.OSS.MMXU1.TotW", "SB5.OSS.STATCOM1.TotVAr", "SB5.OSS.MMXU1.Hz"];
const MAX_TAGS = 6;
const PANEL_PX = 130;

const btnCls = "h-7 px-2.5 rounded border text-xs transition-colors";

export default function HistorianPanel() {
  const c = useChartPalette();
  const [tags, setTags] = useState<HistorianTagMeta[]>([]);
  const [selected, setSelected] = useState<string[]>(DEFAULT_TAGS);
  const [rangeIdx, setRangeIdx] = useState(1);
  const [series, setSeries] = useState<TagTimeSeries[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.listHistorianTags().then(setTags).catch((e: unknown) => setError(String(e)));
  }, []);

  const load = useCallback(async () => {
    if (!selected.length) return setSeries([]);
    setLoading(true);
    try {
      const r = RANGES[rangeIdx];
      const res = await api.queryHistorian({ tags: selected, range_hours: r.hours, resolution: r.resolution });
      // keep the user's selection order
      setSeries(selected.map((t) => res.series.find((s) => s.tag === t)).filter((s): s is TagTimeSeries => !!s));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selected, rangeIdx]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (tag: string) =>
    setSelected((s) => (s.includes(tag) ? s.filter((t) => t !== tag) : s.length >= MAX_TAGS ? s : [...s, tag]));

  // Small multiples: stacked y-axis domains, one shared x axis at the bottom
  const n = series.length;
  const gap = n > 1 ? 0.06 : 0;
  const h = (1 - gap * (n - 1)) / Math.max(n, 1);
  const axes: Record<string, unknown> = {};
  series.forEach((s, i) => {
    const top = 1 - i * (h + gap);
    axes[`yaxis${i === 0 ? "" : i + 1}`] = {
      ...DARK_PLOTLY_LAYOUT.yaxis,
      domain: [top - h, top],
      title: { text: `${s.display_name}<br>[${s.unit}]`, font: { size: 10 } },
      zeroline: false,
    };
  });

  return (
    <section className="bg-bg-secondary rounded-lg border border-border-primary p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold text-text-primary">SCADA historian</h3>
        <span className="text-[11px] text-text-muted" title="Deterministic synthetic history from one physical plant model; live values are in the overview bar">IEC 61400-25 tags · synthetic plant history · tiers raw 90 d / 1-min 2 y / 1-h lifetime</span>
        <span className="flex-1" />
        {RANGES.map((r, i) => (
          <button
            key={r.label}
            type="button"
            onClick={() => setRangeIdx(i)}
            className={cn(btnCls, i === rangeIdx ? "border-accent bg-accent text-white" : "border-border-primary text-text-secondary hover:bg-bg-hover")}
          >
            {r.label}
          </button>
        ))}
        <span className="text-[11px] font-mono text-text-muted">Δt {RANGES[rangeIdx].resolution}</span>
        <button type="button" onClick={() => void load()} className={cn(btnCls, "flex items-center gap-1 border-border-primary text-text-secondary hover:bg-bg-hover")}>
          <RefreshCw size={11} className={loading ? "animate-spin" : undefined} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tags">
        {tags.map((t) => {
          const on = selected.includes(t.tag);
          return (
            <button
              key={t.tag}
              type="button"
              onClick={() => toggle(t.tag)}
              title={`${t.tag} — ${t.description}`}
              aria-pressed={on}
              className={cn(
                "h-7 px-2 rounded border text-[11px]",
                on ? "border-accent text-text-primary bg-bg-hover" : "border-border-primary text-text-muted hover:text-text-secondary",
                !on && selected.length >= MAX_TAGS && "opacity-40 cursor-not-allowed",
              )}
            >
              {t.display_name} <span className="font-mono text-text-muted">[{t.unit}]</span>
            </button>
          );
        })}
      </div>

      {error && <p className="text-xs text-status-warning">{error}</p>}

      {n > 0 ? (
        <Plot
          data={series.map((s, i) => ({
            type: "scatter" as const,
            mode: "lines" as const,
            name: s.display_name,
            x: s.points.map((p) => p.timestamp_iso),
            y: s.points.map((p) => p.value),
            xaxis: "x",
            yaxis: i === 0 ? "y" : `y${i + 1}`,
            line: { color: c.blue, width: 1.6 },
            hovertemplate: `%{y:.3~f} ${s.unit}<extra>${s.display_name}</extra>`,
          }))}
          layout={{
            ...DARK_PLOTLY_LAYOUT,
            height: n * PANEL_PX + 60,
            showlegend: false,
            hovermode: "x unified",
            transition: CHART_TRANSITION,
            margin: { t: 8, r: 16, b: 40, l: 92 },
            xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, type: "date", anchor: `y${n === 1 ? "" : n}`, tickformat: rangeIdx === 3 ? "%d %b" : "%H:%M", title: { text: "UTC", font: { size: 10 } } },
            ...axes,
            shapes: series.map((s, i) => ({
              type: "line",
              xref: "paper",
              yref: (i === 0 ? "y" : `y${i + 1}`) as "y",
              x0: 0,
              x1: 1,
              y0: s.nominal,
              y1: s.nominal,
              line: { color: c.ref, width: 1, dash: "dot" },
            })),
          }}
          config={PLOTLY_CONFIG}
          className="w-full"
          useResizeHandler
          style={{ width: "100%" }}
        />
      ) : (
        <p className="text-xs text-text-muted">Select up to {MAX_TAGS} tags.</p>
      )}

      {n > 0 && (
        <table className="w-full text-[11px]">
          <thead className="text-text-muted text-left">
            <tr>
              <th className="py-1 font-medium">Tag</th>
              <th className="py-1 font-medium">Description</th>
              <th className="py-1 font-medium text-right">Latest</th>
              <th className="py-1 font-medium text-right">Min</th>
              <th className="py-1 font-medium text-right">Max</th>
            </tr>
          </thead>
          <tbody>
            {series.map((s) => {
              const v = s.points.map((p) => p.value);
              const f = (x: number) => x.toLocaleString("en-GB", { maximumFractionDigits: s.unit === "Hz" || s.unit === "pu" ? 3 : 1 });
              return (
                <tr key={s.tag} className="border-t border-border-primary/60">
                  <td className="py-1 font-mono text-text-primary whitespace-nowrap pr-3">{s.tag}</td>
                  <td className="py-1 text-text-secondary">{s.description}</td>
                  <td className="py-1 font-mono text-right text-text-primary whitespace-nowrap">
                    {f(v.at(-1)!)} {s.unit}
                  </td>
                  <td className="py-1 font-mono text-right text-text-muted">{f(Math.min(...v))}</td>
                  <td className="py-1 font-mono text-right text-text-muted">{f(Math.max(...v))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
