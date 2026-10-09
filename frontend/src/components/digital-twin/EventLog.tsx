/**
 * Event log — every confirmed control-chart excursion, newest first.
 *
 * Onset = first sample beyond the limit; confirmed = after 1 h of
 * persistence (what an operator would see raised); end = last sample beyond.
 */

import { useState } from "react";

import { useDigitalTwinStore } from "../../store/digitalTwinStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { StatusChip } from "./StatusChip";
import { CHANNEL_META, FAULT_SHORT, formatHours, formatTime } from "./twinFormat";

type Filter = "all" | "active" | "alarm";

export default function EventLog() {
  const analysis = useDigitalTwinStore((s) => s.analysis);
  const selectTurbine = useDigitalTwinStore((s) => s.selectTurbine);
  const [filter, setFilter] = useState<Filter>("all");
  if (!analysis) return null;

  const last = analysis.start + (analysis.num_samples - 1) * analysis.sample_period_s;
  const events = [...analysis.events]
    .filter((e) => (filter === "active" ? e.end == null : filter === "alarm" ? e.level === "alarm" : true))
    .sort((a, b) => b.confirmed - a.confirmed);

  return (
    <ChartWrapper
      title="Event log"
      headerRight={
        <div className="flex rounded-md border border-border-secondary overflow-hidden text-xs">
          {(["all", "active", "alarm"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`px-2 py-0.5 capitalize ${
                filter === f ? "bg-accent text-accent-ink" : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      }
      footer="Peak u = |EWMA| / control limit (alarm ≥ 2). Times UTC."
    >
      <div className="max-h-[360px] overflow-auto" tabIndex={0} role="region" aria-label="Event log">
        <table className="w-full min-w-[720px] text-xs">
          <thead className="sticky top-0 bg-bg-secondary">
            <tr className="border-b border-border-primary text-left text-xs uppercase tracking-wider text-text-muted">
              <th className="py-1.5 pr-3 font-medium">Confirmed</th>
              <th className="py-1.5 pr-3 font-medium">Turbine</th>
              <th className="py-1.5 pr-3 font-medium">Channel</th>
              <th className="py-1.5 pr-3 font-medium">Level</th>
              <th className="py-1.5 pr-3 font-medium text-right">Duration</th>
              <th className="py-1.5 pr-3 font-medium text-right">Peak u</th>
              <th className="py-1.5 font-medium">Diagnosis</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-text-muted">
                  No events.
                </td>
              </tr>
            )}
            {events.map((e, i) => {
              const duration = ((e.end ?? last) - e.onset) / 3600;
              return (
                <tr
                  key={`${e.turbine_id}-${e.channel}-${e.onset}-${i}`}
                  onClick={() => selectTurbine(e.turbine_id)}
                  className="cursor-pointer border-b border-border-primary/40 hover:bg-bg-tertiary/60"
                >
                  <td className="py-1.5 pr-3 font-mono text-text-secondary">{formatTime(e.confirmed)}</td>
                  <td className="py-1.5 pr-3 font-mono font-semibold text-text-primary">{e.turbine_name}</td>
                  <td className="py-1.5 pr-3 text-text-secondary">
                    {CHANNEL_META[e.channel].label}{" "}
                    <span className="text-text-muted">{e.direction === "high" ? "↑" : "↓"}</span>
                  </td>
                  <td className="py-1.5 pr-3">
                    <StatusChip status={e.level} compact />
                    {e.end == null && <span className="ml-1.5 text-xs text-text-muted">active</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{formatHours(duration)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{e.peak_u.toFixed(2)}</td>
                  <td className="py-1.5 text-text-secondary">{e.diagnosis ? FAULT_SHORT[e.diagnosis] : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ChartWrapper>
  );
}
