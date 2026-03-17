/**
 * SCADA Historian panel — time-series charts for OWF measurements.
 *
 * Architecture follows section 4.10 of the Project Roadmap:
 *   - TimescaleDB historian (simulated via deterministic service)
 *   - Tiered storage: 1-min (1hr), 5-min (4hr), 15-min (24hr), 1-hr (7d)
 *   - Tags: farm power, reactive power, voltage, frequency, STATCOM, wind
 *
 * Layout:
 * ┌─────────────────────────────────────────────────────────────┐
 * │  [Tag checkboxes]   [Time range selector]  [Refresh]        │
 * ├─────────────────────────────────────────────────────────────┤
 * │  Multi-series Plotly time-series chart                      │
 * │  (y-axis auto-scales per tag; overlaid on time axis)        │
 * ├─────────────────────────────────────────────────────────────┤
 * │  Tag metadata table: nominal, range, unit, description      │
 * └─────────────────────────────────────────────────────────────┘
 *
 * IEC 61400-25 tag naming: BWA.OSS.MMXU1.TotW, etc.
 * ISA-101 dark SCADA theme throughout.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Plot from "react-plotly.js";
import { Database, RefreshCw } from "lucide-react";

import * as api from "../../services/scadaApi";
import type {
  HistorianTagMeta,
  TagTimeSeries,
} from "../../types/scada";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { cn } from "../../lib/utils";

// ── Constants ─────────────────────────────────────────────────────

const RANGE_OPTIONS: { label: string; hours: number; resolution: string }[] = [
  { label: "1 hr", hours: 1, resolution: "1min" },
  { label: "4 hr", hours: 4, resolution: "5min" },
  { label: "24 hr", hours: 24, resolution: "15min" },
  { label: "7 d", hours: 168, resolution: "1hr" },
];

// Plotly colour cycle for multiple series (ISA-101 muted palette)
const SERIES_COLORS = [
  "#3ecf6e", // green
  "#3b82f6", // blue
  "#f97316", // orange
  "#22d3ee", // cyan
  "#eab308", // yellow
  "#a855f7", // purple
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // teal
  "#6366f1", // indigo
];

// ── Helpers ───────────────────────────────────────────────────────

/** Epoch minutes: advances every render to give a "live clock" appearance */
function liveEpochMinutes(): number {
  // Use wall-clock minutes mod (365 * 24 * 60) relative to a fixed offset
  // so the chart appears to scroll in real time.
  const now = Math.floor(Date.now() / 60_000); // current UTC minute
  return now % (365 * 24 * 60);
}

// ── Main Component ────────────────────────────────────────────────

export default function HistorianPanel() {
  const [availableTags, setAvailableTags] = useState<HistorianTagMeta[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [rangeIdx, setRangeIdx] = useState(1); // default: 4 hr
  const [series, setSeries] = useState<TagTimeSeries[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagsLoaded, setTagsLoaded] = useState(false);
  const epochRef = useRef(liveEpochMinutes());

  // Load available tags on mount
  useEffect(() => {
    api
      .listHistorianTags()
      .then((tags) => {
        setAvailableTags(tags);
        // Pre-select the three most informative tags
        const preselect = tags
          .filter((t) =>
            [
              "BWA.OSS.MMXU1.TotW",
              "BWA.OSS.MMXU1.Hz",
              "BWA.OSS.STATCOM1.TotVAr",
            ].includes(t.tag),
          )
          .map((t) => t.tag);
        setSelectedTags(preselect.length ? preselect : tags.slice(0, 3).map((t) => t.tag));
        setTagsLoaded(true);
      })
      .catch((err) => setError(String(err)));
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedTags.length) return;
    setLoading(true);
    setError(null);
    epochRef.current = liveEpochMinutes();
    const range = RANGE_OPTIONS[rangeIdx];
    try {
      const result = await api.queryHistorian({
        tags: selectedTags,
        range_hours: range.hours,
        resolution: range.resolution,
        now_epoch_minutes: epochRef.current,
      });
      setSeries(result.series);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedTags, rangeIdx]);

  // Auto-fetch when selection or range changes
  useEffect(() => {
    if (tagsLoaded && selectedTags.length) {
      fetchData();
    }
  }, [fetchData, tagsLoaded]);

  // ── Event handlers ─────────────────────────────────────────────

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag].slice(0, 10), // max 10 per query
    );
  }

  // ── Plotly traces ──────────────────────────────────────────────

  const traces = series.map((s, idx) => ({
    x: s.points.map((p) => p.timestamp_iso),
    y: s.points.map((p) => p.value),
    name: `${s.display_name} (${s.unit})`,
    type: "scatter" as const,
    mode: "lines" as const,
    line: {
      color: SERIES_COLORS[idx % SERIES_COLORS.length],
      width: 1.5,
    },
    hovertemplate: `<b>${s.display_name}</b><br>%{x}<br>%{y:.3f} ${s.unit}<extra></extra>`,
  }));

  const chartLayout = {
    ...DARK_PLOTLY_LAYOUT,
    height: 320,
    showlegend: true,
    legend: {
      orientation: "h" as const,
      y: -0.25,
      font: { size: 11, color: "#9ba3b8" },
    },
    xaxis: {
      ...DARK_PLOTLY_LAYOUT.xaxis,
      title: { text: "Time (UTC)", font: { size: 12 } },
      type: "category" as const,
      tickangle: -30,
      nticks: 10,
    },
    yaxis: {
      ...DARK_PLOTLY_LAYOUT.yaxis,
      title: { text: "Value", font: { size: 12 } },
    },
    margin: { t: 16, r: 16, b: 80, l: 64 },
  };

  // ── Metadata table rows ────────────────────────────────────────

  const selectedMeta = availableTags.filter((t) =>
    selectedTags.includes(t.tag),
  );

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 p-4 bg-bg-secondary rounded-lg border border-border-primary">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Database size={16} className="text-accent" />
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
          SCADA Historian
        </h3>
        <span className="ml-auto text-xs text-text-muted">
          TimescaleDB · IEC 61400-25 · ISA-101
        </span>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-start gap-6">
        {/* Time range selector */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-text-muted uppercase tracking-wider">
            Time Range
          </span>
          <div className="flex gap-1">
            {RANGE_OPTIONS.map((opt, idx) => (
              <button
                key={opt.label}
                onClick={() => setRangeIdx(idx)}
                className={cn(
                  "px-3 py-1 text-xs rounded border transition-colors",
                  rangeIdx === idx
                    ? "bg-accent text-bg-primary border-accent"
                    : "bg-bg-tertiary text-text-secondary border-border-primary hover:border-accent",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-text-muted">
            Resolution: {RANGE_OPTIONS[rangeIdx].resolution}
          </span>
        </div>

        {/* Tag selector */}
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <span className="text-xs text-text-muted uppercase tracking-wider">
            Tags (max 10)
          </span>
          <div className="flex flex-wrap gap-2">
            {availableTags.map((t) => {
              const active = selectedTags.includes(t.tag);
              const colorIdx = selectedTags.indexOf(t.tag);
              return (
                <button
                  key={t.tag}
                  onClick={() => toggleTag(t.tag)}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded border text-xs transition-colors",
                    active
                      ? "border-transparent text-bg-primary"
                      : "bg-bg-tertiary text-text-secondary border-border-primary hover:border-border-secondary",
                  )}
                  style={
                    active
                      ? {
                          backgroundColor:
                            SERIES_COLORS[colorIdx % SERIES_COLORS.length],
                          borderColor:
                            SERIES_COLORS[colorIdx % SERIES_COLORS.length],
                        }
                      : undefined
                  }
                  title={t.description}
                >
                  {t.display_name}
                  <span className="opacity-70">[{t.unit}]</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Refresh button */}
        <button
          onClick={fetchData}
          disabled={loading || !selectedTags.length}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-border-primary text-text-secondary hover:text-text-primary hover:border-accent transition-colors disabled:opacity-40 self-end"
        >
          <RefreshCw
            size={12}
            className={loading ? "animate-spin" : undefined}
          />
          Refresh
        </button>
      </div>

      {/* Chart */}
      <div className="rounded border border-border-primary overflow-hidden bg-bg-primary">
        {error && (
          <div className="p-4 text-sm text-red-400">
            Error loading historian data: {error}
          </div>
        )}
        {!error && !series.length && !loading && (
          <div className="flex items-center justify-center h-48 text-text-muted text-sm">
            Select at least one tag to view time-series data
          </div>
        )}
        {(series.length > 0 || loading) && (
          <Plot
            data={traces}
            layout={chartLayout}
            config={PLOTLY_CONFIG}
            style={{ width: "100%" }}
            useResizeHandler
          />
        )}
      </div>

      {/* Metadata table */}
      {selectedMeta.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-text-muted uppercase tracking-wider border-b border-border-primary">
                <th className="text-left py-1.5 pr-3">Tag</th>
                <th className="text-left py-1.5 pr-3">Display Name</th>
                <th className="text-left py-1.5 pr-3">Unit</th>
                <th className="text-right py-1.5 pr-3">Nominal</th>
                <th className="text-right py-1.5 pr-3">Min</th>
                <th className="text-right py-1.5">Max</th>
              </tr>
            </thead>
            <tbody>
              {selectedMeta.map((t, _idx) => (
                <tr
                  key={t.tag}
                  className="border-b border-border-primary last:border-0"
                >
                  <td
                    className="py-1.5 pr-3 font-mono"
                    style={{
                      color: SERIES_COLORS[
                        selectedTags.indexOf(t.tag) % SERIES_COLORS.length
                      ],
                    }}
                  >
                    {t.tag}
                  </td>
                  <td className="py-1.5 pr-3 text-text-secondary">
                    {t.display_name}
                  </td>
                  <td className="py-1.5 pr-3 text-text-muted font-mono">
                    {t.unit}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-text-secondary font-mono">
                    {t.nominal}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-text-muted font-mono">
                    {t.range_min}
                  </td>
                  <td className="py-1.5 text-right text-text-muted font-mono">
                    {t.range_max}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Retention note */}
      <p className="text-xs text-text-muted border-t border-border-primary pt-2">
        Historian retention: raw 90 days · 1-min avg 2 years · 1-hr avg lifetime
        (TimescaleDB continuous aggregates per section 4.10)
      </p>
    </div>
  );
}
