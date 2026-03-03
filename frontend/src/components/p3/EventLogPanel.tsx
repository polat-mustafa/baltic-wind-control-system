/**
 * Event log / SOE panel — persistent chronological sequence of events.
 *
 * Features:
 * - Persistent event history (last 200 events from store)
 * - Event type color coding
 * - Time-range display
 * - Copy to clipboard as CSV
 * - Priority icons
 *
 * Combines GOOSE simulation events + auto-simulation events + breaker ops.
 */

import { useMemo, useCallback } from "react";

import { useScadaStore, type SOEEvent } from "../../store/scadaStore";
import { SCADA_COLORS } from "../../constants/scadaColors";
import { Copy, Trash2, AlertTriangle, AlertCircle, Info, Zap } from "lucide-react";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("sv-SE", { timeZone: "Europe/Warsaw", hour12: false });
}

const PRIORITY_ICON: Record<string, React.ReactNode> = {
  CRITICAL: <AlertTriangle size={10} className="text-red-400" />,
  HIGH: <AlertCircle size={10} className="text-orange-400" />,
  MEDIUM: <AlertCircle size={10} className="text-yellow-400" />,
  LOW: <Info size={10} className="text-cyan-400" />,
  INFO: <Info size={10} className="text-text-muted" />,
};

function typeColor(type: string): string {
  if (type.includes("FAULT") || type.includes("trip") || type === "relay_trip") return SCADA_COLORS.FAULT;
  if (type.includes("goose") || type.includes("GOOSE")) return SCADA_COLORS.EARTHED;
  if (type.includes("breaker")) return SCADA_COLORS.WARNING;
  return SCADA_COLORS.DE_ENERGIZED;
}

export default function EventLogPanel() {
  const eventLog = useScadaStore((s) => s.eventLog);
  const simulationResult = useScadaStore((s) => s.simulationResult);
  const clearEventLog = useScadaStore((s) => s.clearEventLog);

  // Merge legacy simulation events if no persistent events yet
  const entries = useMemo<SOEEvent[]>(() => {
    if (eventLog.length > 0) return eventLog;

    // Fallback: convert old simulation result to SOE format
    if (!simulationResult) return [];
    return simulationResult.events.map((e, i) => ({
      id: `legacy-${i}`,
      timestamp: Date.now() + e.timestamp_ms,
      source: e.ied_name || "System",
      type: e.event_type,
      description: e.description,
      priority: e.event_type === "relay_trip" ? "CRITICAL" as const : "INFO" as const,
    }));
  }, [eventLog, simulationResult]);

  const handleCopyCSV = useCallback(() => {
    const header = "Timestamp,Source,Type,Priority,Description";
    const rows = entries.map((e) =>
      `${formatTime(e.timestamp)},${e.source},${e.type},${e.priority},"${e.description}"`,
    );
    const csv = [header, ...rows].join("\n");
    navigator.clipboard.writeText(csv);
  }, [entries]);

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
      <div className="px-3 py-1.5 border-b border-border-primary flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-text-primary">
            Event Log / SOE
          </h3>
          <span className="text-[9px] text-text-muted font-mono">
            {entries.length} entries
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopyCSV}
            className="text-[9px] px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors flex items-center gap-1"
            title="Copy as CSV"
          >
            <Copy size={9} /> CSV
          </button>
          <button
            onClick={clearEventLog}
            className="text-[9px] px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors flex items-center gap-1"
            title="Clear event log"
          >
            <Trash2 size={9} /> Clear
          </button>
        </div>
      </div>
      <div className="max-h-[300px] overflow-y-auto">
        {entries.length === 0 ? (
          <div className="p-4 text-center text-text-muted text-sm">
            No events — start auto-simulation or run a fault scenario
          </div>
        ) : (
          <table className="w-full text-[10px]">
            <thead className="bg-bg-tertiary sticky top-0">
              <tr>
                <th className="text-left px-2 py-1 text-text-muted font-medium w-6"></th>
                <th className="text-left px-2 py-1 text-text-muted font-medium w-16">Time</th>
                <th className="text-left px-2 py-1 text-text-muted font-medium w-28">Source</th>
                <th className="text-left px-2 py-1 text-text-muted font-medium w-24">Type</th>
                <th className="text-left px-2 py-1 text-text-muted font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-border-primary/50 hover:bg-bg-hover/50 transition-colors"
                >
                  <td className="px-2 py-1">
                    {PRIORITY_ICON[entry.priority] ?? <Zap size={10} className="text-text-muted" />}
                  </td>
                  <td className="px-2 py-1 font-mono text-text-secondary">
                    {formatTime(entry.timestamp)}
                  </td>
                  <td className="px-2 py-1 font-mono text-text-secondary">
                    {entry.source}
                  </td>
                  <td className="px-2 py-1">
                    <span className="font-mono" style={{ color: typeColor(entry.type) }}>
                      {entry.type}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-text-primary truncate max-w-[300px]" title={entry.description}>
                    {entry.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
