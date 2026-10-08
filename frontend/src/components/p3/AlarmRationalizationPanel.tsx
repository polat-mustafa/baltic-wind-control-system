/**
 * Alarm management performance — EEMUA 191 / ISA-18.2 (M09).
 *
 * KPIs come from the alarm journal the HMI writes for every raise,
 * acknowledgement, return-to-normal and shelve; the master alarm database
 * documents each alarm class (cause, consequence, operator action,
 * priority) — the output of ISA-18.2 rationalisation.
 *
 * EEMUA 191 benchmarks: average ≤ 1 alarm / 10 min, peak < 10 / 10 min,
 * no chattering alarms, no floods.
 */

import { useEffect } from "react";
import Plot from "react-plotly.js";
import { RefreshCw } from "lucide-react";

import { useFleet } from "../../lib/fleet";
import { useAlarmStore } from "../../store/alarmStore";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { PriorityChip } from "./AlarmListPanel";
import { cn } from "../../lib/utils";

export default function AlarmRationalizationPanel() {
  const fleet = useFleet();
  const kpi = useAlarmStore((s) => s.kpi);
  const mad = useAlarmStore((s) => s.rationalization);
  const live = useAlarmStore((s) => s.alarms);
  const chattering = useAlarmStore((s) => s.chattering);
  const loading = useAlarmStore((s) => s.loading);
  const error = useAlarmStore((s) => s.error);
  const fetchAll = useAlarmStore((s) => s.fetchAll);
  const c = useChartPalette();

  useEffect(() => {
    void fetchAll();
    const id = setInterval(() => void fetchAll(), 15_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const state = new Map(live.map((a) => [a.tag, a]));
  const tiles: [string, string, string, boolean][] = kpi
    ? [
        ["Average rate", `${kpi.average_rate_per_10_min.toFixed(2)} / 10 min`, "≤ 1 (EEMUA 191)", kpi.rate_benchmark_met],
        ["Peak rate", `${kpi.peak_rate_per_10_min.toFixed(0)} / 10 min`, "< 10 manageable", kpi.peak_benchmark_met],
        ["Standing", String(kpi.standing_alarms), "active classes now", kpi.standing_alarms < 10],
        ["Acknowledged ≤ 10 min", `${kpi.pct_acknowledged_within_10min.toFixed(0)} %`, "≥ 80 %", kpi.ack_benchmark_met],
        ["Chattering", String(kpi.chattering_alarm_count), "> 3 activations / 10 min", kpi.chattering_alarm_count === 0],
        ["Floods", String(kpi.flood_events_in_window), "> 10 alarms / 10 min", kpi.flood_events_in_window === 0],
      ]
    : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold text-text-primary">Alarm management performance · EEMUA 191 / ISA-18.2</h3>
        {kpi && (
          <span className="text-[11px] font-mono text-text-secondary">
            last {kpi.window_hours} h · {kpi.total_alarms_in_window} activations · grade <b className="text-text-primary">{kpi.overall_grade}</b>
          </span>
        )}
        <span className="flex-1" />
        <button type="button" onClick={() => void fetchAll()} className="flex items-center gap-1 h-6 px-2 rounded border border-border-primary text-[11px] text-text-secondary hover:bg-bg-hover">
          <RefreshCw size={11} className={loading ? "animate-spin" : undefined} /> Refresh
        </button>
      </div>
      {error && <p className="text-xs text-status-warning">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        {tiles.map(([label, value, target, ok]) => (
          <div key={label} className="rounded-lg border border-border-primary bg-bg-secondary p-2">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
            <div className="text-base font-mono font-semibold text-text-primary">{value}</div>
            <div className={cn("text-[11px]", ok ? "text-text-muted" : "text-text-primary font-semibold")}>{ok ? target : `✗ target ${target}`}</div>
          </div>
        ))}
      </div>

      {kpi && kpi.alarm_rate_history.length > 0 && (
        <section className="rounded-lg border border-border-primary bg-bg-secondary p-3">
          <h4 className="text-xs font-semibold text-text-primary">Alarm activations per 10 minutes</h4>
          <Plot
            data={[
              {
                type: "bar",
                x: kpi.alarm_rate_history.map((p) => p.interval_start_utc),
                y: kpi.alarm_rate_history.map((p) => p.alarm_count),
                marker: { color: kpi.alarm_rate_history.map((p) => (p.above_benchmark ? c.red : c.blue)) },
                hovertemplate: "%{x|%H:%M} UTC · %{y} alarms<extra></extra>",
              },
            ]}
            layout={{
              ...DARK_PLOTLY_LAYOUT,
              height: 200,
              showlegend: false,
              bargap: 0.15,
              transition: CHART_TRANSITION,
              margin: { t: 12, r: 70, b: 36, l: 44 },
              xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, type: "date", tickformat: "%H:%M" },
              yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "Alarms", font: { size: 11 } }, rangemode: "tozero" },
              shapes: [1, 10].map((y) => ({ type: "line", xref: "paper", x0: 0, x1: 1, y0: y, y1: y, line: { color: c.ref, dash: "dot", width: 1 } })),
              annotations: [
                { xref: "paper", x: 1, y: 1, text: "1 · target", showarrow: false, xanchor: "left", font: { size: 10, color: c.ink } },
                { xref: "paper", x: 1, y: 10, text: "10 · flood", showarrow: false, xanchor: "left", font: { size: 10, color: c.ink } },
              ],
            }}
            config={PLOTLY_CONFIG}
            className="w-full"
            useResizeHandler
            style={{ width: "100%", height: 200 }}
          />
        </section>
      )}

      {chattering && chattering.chattering_alarms.length > 0 && (
        <section className="rounded-lg border border-status-warning/50 bg-bg-secondary p-3">
          <h4 className="text-xs font-semibold text-text-primary mb-1">Chattering alarms</h4>
          {chattering.chattering_alarms.map((a) => (
            <p key={a.tag} className="text-[11px] text-text-secondary">
              <span className="font-mono text-text-primary">{a.tag}</span> — {a.transition_count}× in {a.window_minutes} min. {a.recommendation}
            </p>
          ))}
        </section>
      )}

      <section className="rounded-lg border border-border-primary bg-bg-secondary p-3">
        <h4 className="text-xs font-semibold text-text-primary mb-1">
          Master alarm database <span className="font-normal text-text-muted">({mad.length} rationalised classes · WTG.* covers WTG-01…{String(fleet.turbines.length).padStart(2, "0")})</span>
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="text-left text-text-muted">
              <tr>
                <th className="py-1 pr-2 font-medium w-9">Pri</th>
                <th className="py-1 pr-2 font-medium">Tag / alarm</th>
                <th className="py-1 pr-2 font-medium">Cause</th>
                <th className="py-1 pr-2 font-medium">Consequence</th>
                <th className="py-1 pr-2 font-medium">Operator action</th>
                <th className="py-1 font-medium">State</th>
              </tr>
            </thead>
            <tbody>
              {[...mad]
                .sort((a, b) => ["CRITICAL", "HIGH", "MEDIUM", "LOW"].indexOf(a.priority) - ["CRITICAL", "HIGH", "MEDIUM", "LOW"].indexOf(b.priority))
                .map((a) => {
                  const st = state.get(a.tag);
                  return (
                    <tr key={a.id} className="border-t border-border-primary/60 align-top">
                      <td className="py-1 pr-2">
                        <PriorityChip priority={a.priority} />
                      </td>
                      <td className="py-1 pr-2">
                        <div className="font-mono text-text-primary">{a.tag}</div>
                        <div className="text-text-muted">{a.display_name}</div>
                      </td>
                      <td className="py-1 pr-2 text-text-secondary">{a.cause}</td>
                      <td className="py-1 pr-2 text-text-secondary">{a.consequence}</td>
                      <td className="py-1 pr-2 text-text-primary">{a.operator_action}</td>
                      <td className="py-1 font-mono whitespace-nowrap text-text-muted">
                        {st ? `${st.state.toLowerCase()}${st.shelved ? " · shelved" : ""}` : "—"}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
