/**
 * Operator event log — the session's chronological record: protection
 * sequence (GOOSE), breaker operations, interlock blocks, turbine faults.
 *
 * Time stamps carry milliseconds: a protection sequence lasts < 100 ms and
 * IEC 61850 time-stamps events to 1 ms, so seconds would merge the whole
 * sequence into one line. The persistent, database-backed record of the same
 * kind of events is the SOE Recorder (Diagnostics).
 */

import { useMemo, useState } from "react";
import { Download, Trash2 } from "lucide-react";

import { useScadaStore, type SOEEvent } from "../../store/scadaStore";
import { PriorityChip } from "./AlarmListPanel";

/** HH:MM:SS.mmm in plant time (CET/CEST). */
function formatTimeMs(ts: number): string {
  const t = new Date(ts).toLocaleTimeString("sv-SE", { timeZone: "Europe/Warsaw", hour12: false });
  return `${t}.${String(new Date(ts).getMilliseconds()).padStart(3, "0")}`;
}

const CATEGORY: { id: string; label: string; match: (e: SOEEvent) => boolean }[] = [
  { id: "all", label: "All events", match: () => true },
  { id: "protection", label: "Protection / GOOSE", match: (e) => /relay|goose|fault_occurs|protection|breaker_open|breaker_trip|arc|fault_cleared|scada_alarm/i.test(e.type) },
  { id: "switching", label: "Switching / interlocks", match: (e) => /breaker_operation|interlock/.test(e.type) },
  { id: "turbine", label: "Turbine faults", match: (e) => /^[A-Z_]+$/.test(e.type) },
];

function exportCsv(rows: SOEEvent[]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [
    "time_utc,source,type,priority,description",
    ...rows.map((e) => [new Date(e.timestamp).toISOString(), esc(e.source), e.type, e.priority, esc(e.description)].join(",")),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `event_log_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function EventLogPanel() {
  const eventLog = useScadaStore((s) => s.eventLog);
  const clearEventLog = useScadaStore((s) => s.clearEventLog);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");

  // Newest first; ties (same ms) keep insertion order
  const rows = useMemo(() => {
    const cat = CATEGORY.find((c) => c.id === category) ?? CATEGORY[0];
    const q = query.toLowerCase();
    return [...eventLog]
      .sort((a, b) => b.timestamp - a.timestamp)
      .filter((e) => cat.match(e) && (!q || `${e.source} ${e.description}`.toLowerCase().includes(q)));
  }, [eventLog, category, query]);

  const ctrl = "h-6 text-[11px] bg-bg-secondary border border-border-primary rounded px-1.5 text-text-secondary";

  return (
    <div className="flex flex-col h-full min-h-[420px] bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 border-b border-border-primary shrink-0">
        <h3 className="text-xs font-semibold text-text-primary">Event Log / SOE</h3>
        <span className="text-[10px] font-mono text-text-muted">{eventLog.length} entries · 1 ms resolution</span>
        <span className="flex-1" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={ctrl} aria-label="Event category">
          {CATEGORY.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Source / text" className={`${ctrl} w-32`} aria-label="Search events" />
        <button type="button" onClick={() => exportCsv(rows)} disabled={!rows.length} className={`${ctrl} flex items-center gap-1 hover:bg-bg-hover disabled:opacity-40`}>
          <Download size={11} /> CSV
        </button>
        <button type="button" onClick={clearEventLog} disabled={!eventLog.length} className={`${ctrl} flex items-center gap-1 hover:bg-bg-hover disabled:opacity-40`}>
          <Trash2 size={11} /> Clear
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {rows.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-muted">
            {eventLog.length === 0 ? "No events yet. Inject a fault, operate a breaker or start the auto-simulation." : "No events match the filter."}
          </div>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-bg-tertiary text-text-muted">
              <tr className="text-left">
                <th className="px-2 py-1 font-medium w-9">Pri</th>
                <th className="px-2 py-1 font-medium w-28">Time</th>
                <th className="px-2 py-1 font-medium w-36">Source</th>
                <th className="px-2 py-1 font-medium w-44">Type</th>
                <th className="px-2 py-1 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-border-primary/60 hover:bg-bg-hover">
                  <td className="px-2 py-0.5">{e.priority === "INFO" ? <span className="text-[10px] font-mono text-text-muted">info</span> : <PriorityChip priority={e.priority} />}</td>
                  <td className="px-2 py-0.5 font-mono tabular-nums text-text-secondary whitespace-nowrap">{formatTimeMs(e.timestamp)}</td>
                  <td className="px-2 py-0.5 font-mono text-text-primary whitespace-nowrap">{e.source}</td>
                  <td className="px-2 py-0.5 font-mono text-text-muted whitespace-nowrap">{e.type.toLowerCase()}</td>
                  <td className="px-2 py-0.5 text-text-secondary">{e.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
