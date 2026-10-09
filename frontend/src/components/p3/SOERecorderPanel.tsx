/**
 * Sequence-of-events recorder (M02) — the persistent, database-backed event
 * record: protection trips and breaker operations from the GOOSE sequence,
 * bay-controller commands and interlock refusals.
 *
 * Time stamps are UTC with milliseconds (IEC 61850 time quality: 1 ms class
 * with PTP/IRIG-B sync); Δt to the previous event is what a protection
 * engineer reads first after a trip.
 */

import { useEffect, useMemo } from "react";
import { RefreshCw } from "lucide-react";

import { useSOEStore } from "../../store/soeStore";
import { PriorityChip } from "./AlarmListPanel";
import type { SOEEventType, SOESeverity } from "../../types/soe";
import { cn } from "../../lib/utils";

const EVENT_TYPES: SOEEventType[] = ["PROTECTION_TRIP", "CB_OPERATION", "OPERATOR_COMMAND", "INTERLOCK_BLOCK", "ALARM_RAISED", "STATE_CHANGE"];
const SEVERITIES: SOESeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

/** 2026-10-05 06:23:25.831 (UTC) */
const utcMs = (iso: string) => {
  const d = new Date(iso);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 23)}`;
};

const ctrl = "h-7 text-xs bg-bg-secondary border border-border-primary rounded px-2 text-text-secondary";

export default function SOERecorderPanel() {
  const queryResult = useSOEStore((s) => s.queryResult);
  const stats = useSOEStore((s) => s.stats);
  const filterDevice = useSOEStore((s) => s.filterDevice);
  const filterEventType = useSOEStore((s) => s.filterEventType);
  const filterSeverity = useSOEStore((s) => s.filterSeverity);
  const unackOnly = useSOEStore((s) => s.filterUnacknowledgedOnly);
  const loading = useSOEStore((s) => s.loading);
  const error = useSOEStore((s) => s.error);
  const applyFilters = useSOEStore((s) => s.applyFilters);
  const acknowledgeEvent = useSOEStore((s) => s.acknowledgeEvent);
  const setFilterDevice = useSOEStore((s) => s.setFilterDevice);
  const setFilterEventType = useSOEStore((s) => s.setFilterEventType);
  const setFilterSeverity = useSOEStore((s) => s.setFilterSeverity);
  const setUnackOnly = useSOEStore((s) => s.setFilterUnacknowledgedOnly);

  // Server-side filters re-query; the device text filter is applied locally
  useEffect(() => {
    void applyFilters();
  }, [applyFilters, filterEventType, filterSeverity, unackOnly]);

  const rows = useMemo(() => {
    const q = filterDevice.toLowerCase();
    return (queryResult?.events ?? []).filter((e) => !q || e.source_device.toLowerCase().includes(q));
  }, [queryResult, filterDevice]);

  return (
    <section className="flex flex-col h-full min-h-[420px] bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border-primary">
        <h3 className="text-xs font-semibold text-text-primary">SOE recorder</h3>
        {stats && (
          <span className="text-xs font-mono text-text-muted">
            {stats.total_events} events / {stats.window_hours} h · {stats.unacknowledged_count} unacknowledged
            {stats.most_active_device ? ` · most active ${stats.most_active_device}` : ""}
          </span>
        )}
        <span className="flex-1" />
        <input type="search" placeholder="Device contains…" value={filterDevice} onChange={(e) => setFilterDevice(e.target.value)} className={cn(ctrl, "w-36")} aria-label="Device filter" />
        <select value={filterEventType} onChange={(e) => setFilterEventType(e.target.value as SOEEventType | "")} className={ctrl} aria-label="Event type">
          <option value="">All event types</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ").toLowerCase()}
            </option>
          ))}
        </select>
        <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value as SOESeverity | "")} className={ctrl} aria-label="Severity">
          <option value="">All severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s.toLowerCase()}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-text-secondary">
          <input type="checkbox" checked={unackOnly} onChange={(e) => setUnackOnly(e.target.checked)} className="accent-accent" /> unacked
        </label>
        <button type="button" onClick={() => void applyFilters()} className={cn(ctrl, "flex items-center gap-1 hover:bg-bg-hover")}>
          <RefreshCw size={11} className={loading ? "animate-spin" : undefined} /> Refresh
        </button>
      </div>

      {error && <p className="px-3 py-1 text-xs text-status-warning">{error}</p>}

      <div className="flex-1 min-h-0 overflow-auto">
        {rows.length === 0 ? (
          <p className="p-6 text-center text-xs text-text-muted">
            No recorded events. Operate a 66 kV bay or inject a protection fault — both are written here.
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-tertiary text-text-muted text-left">
              <tr>
                <th className="px-2 py-1 font-medium w-9">Sev</th>
                <th className="px-2 py-1 font-medium w-48">Time (UTC)</th>
                <th className="px-2 py-1 font-medium w-20 text-right">Δt</th>
                <th className="px-2 py-1 font-medium">Device</th>
                <th className="px-2 py-1 font-medium">Event</th>
                <th className="px-2 py-1 font-medium">Description</th>
                <th className="px-2 py-1 font-medium">Change</th>
                <th className="px-2 py-1 w-12" />
              </tr>
            </thead>
            <tbody>
              {rows.map((e, i) => {
                const prev = rows[i + 1];
                const dt = prev ? new Date(e.timestamp_utc).getTime() - new Date(prev.timestamp_utc).getTime() : null;
                return (
                  <tr key={e.id} className={cn("border-b border-border-primary/60 hover:bg-bg-hover", !e.acknowledged && "font-semibold")}>
                    <td className="px-2 py-0.5">
                      {e.severity === "INFO" ? <span className="text-xs font-mono font-normal text-text-muted">info</span> : <PriorityChip priority={e.severity} />}
                    </td>
                    <td className="px-2 py-0.5 font-mono tabular-nums text-text-secondary whitespace-nowrap">{utcMs(e.timestamp_utc)}</td>
                    <td className="px-2 py-0.5 font-mono tabular-nums text-right text-text-muted whitespace-nowrap">
                      {dt === null ? "" : dt < 1000 ? `+${dt} ms` : dt < 60_000 ? `+${(dt / 1000).toFixed(1)} s` : `+${Math.round(dt / 60_000)} min`}
                    </td>
                    <td className="px-2 py-0.5 font-mono text-text-primary whitespace-nowrap">{e.source_device}</td>
                    <td className="px-2 py-0.5 text-text-secondary whitespace-nowrap">{e.event_type.replace(/_/g, " ").toLowerCase()}</td>
                    <td className="px-2 py-0.5 text-text-secondary">{e.description}</td>
                    <td className="px-2 py-0.5 font-mono text-text-muted whitespace-nowrap">
                      {e.value_before || e.value_after ? `${e.value_before ?? "—"} → ${e.value_after ?? "—"}` : ""}
                    </td>
                    <td className="px-2 py-0.5 text-right">
                      {!e.acknowledged && (
                        <button
                          type="button"
                          onClick={() => void acknowledgeEvent(e.id, "OPR-1")}
                          className="px-1.5 rounded border border-border-primary text-xs font-semibold text-text-primary hover:bg-bg-hover"
                        >
                          ACK
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
