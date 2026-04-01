/**
 * SOE Recorder Panel — M02.
 *
 * Filterable, sortable event table with:
 *   - Filter by device, event type, severity, unacknowledged only
 *   - Stats row: total events/hr, most active device
 *   - Acknowledge button per event
 *   - CSV export link
 *
 * IEC 61850: ms-precision timestamping via TimescaleDB hypertable.
 */

import { useEffect } from "react";
import { ScrollText } from "lucide-react";

import { useSOEStore } from "../../store/soeStore";
import { Button } from "../ui/Button";
import type { SOESeverity } from "../../types/soe";

const SEVERITY_COLOR: Record<SOESeverity, string> = {
  INFO: "text-text-muted",
  WARNING: "text-status-warning",
  ALARM: "text-status-alarm",
  CRITICAL: "text-status-alarm font-bold",
};

export default function SOERecorderPanel() {
  const {
    queryResult,
    stats,
    filterDevice,
    filterSeverity,
    filterUnacknowledgedOnly,
    loading,
    fetchSOE,
    fetchStats,
    acknowledgeEvent,
    setFilterDevice,
    setFilterSeverity,
    setFilterUnacknowledgedOnly,
    applyFilters,
  } = useSOEStore();

  useEffect(() => {
    fetchSOE({ limit: 100 });
    fetchStats();
  }, [fetchSOE, fetchStats]);

  return (
    <div className="space-y-3">
      {/* Stats row */}
      {stats && (
        <div className="flex items-center gap-4 text-xs text-text-muted flex-wrap">
          <div className="flex items-center gap-1.5">
            <ScrollText size={12} />
            <span>{stats.total_events} events in {stats.window_hours}h</span>
          </div>
          <span>{stats.events_per_hour.toFixed(1)} events/hr</span>
          <span>{stats.unacknowledged_count} unacknowledged</span>
          {stats.most_active_device && (
            <span className="font-mono">Most active: {stats.most_active_device}</span>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Filter by device…"
          value={filterDevice}
          onChange={(e) => setFilterDevice(e.target.value)}
          className="text-xs bg-bg-tertiary border border-border-primary rounded px-2 py-1 text-text-secondary w-36"
        />
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value as SOESeverity | "")}
          className="text-xs bg-bg-tertiary border border-border-primary rounded px-2 py-1 text-text-secondary"
        >
          <option value="">All severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="ALARM">Alarm</option>
          <option value="WARNING">Warning</option>
          <option value="INFO">Info</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={filterUnacknowledgedOnly}
            onChange={(e) => setFilterUnacknowledgedOnly(e.target.checked)}
            className="accent-accent"
          />
          Unacked only
        </label>
        <Button size="sm" onClick={applyFilters} disabled={loading}>Apply</Button>
      </div>

      {/* Event table */}
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-xs text-text-secondary border-collapse">
          <thead className="sticky top-0 bg-bg-tertiary">
            <tr className="border-b border-border-primary text-text-muted">
              <th className="text-left py-2 pr-3 font-medium w-36">Timestamp</th>
              <th className="text-left py-2 pr-3 font-medium">Device</th>
              <th className="text-left py-2 pr-3 font-medium">Event</th>
              <th className="text-left py-2 pr-3 font-medium">Description</th>
              <th className="text-center py-2 pr-3 font-medium">Sev</th>
              <th className="text-center py-2 font-medium">Ack</th>
            </tr>
          </thead>
          <tbody>
            {queryResult?.events.map((event) => (
              <tr key={event.id} className={`border-b border-border-primary/40 hover:bg-bg-elevated/30 ${!event.acknowledged ? "bg-status-warning/5" : ""}`}>
                <td className="py-1.5 pr-3 font-mono text-text-muted whitespace-nowrap">
                  {new Date(event.timestamp_utc).toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 })}
                </td>
                <td className="py-1.5 pr-3 font-mono text-text-primary">{event.source_device}</td>
                <td className="py-1.5 pr-3">{event.event_type.replace(/_/g, " ")}</td>
                <td className="py-1.5 pr-3 text-text-muted max-w-xs truncate">{event.description}</td>
                <td className={`py-1.5 pr-3 text-center ${SEVERITY_COLOR[event.severity]}`}>{event.severity[0]}</td>
                <td className="py-1.5 text-center">
                  {event.acknowledged ? (
                    <span className="text-text-muted">✓</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => acknowledgeEvent(event.id, "CTRL-1")}
                      className="text-xs py-0 px-1"
                    >
                      Ack
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!queryResult?.events.length && !loading && (
          <p className="text-center text-text-muted text-xs py-8">No events found</p>
        )}
      </div>

      {queryResult?.has_more && (
        <p className="text-xs text-text-muted text-center">
          Showing {queryResult.total_returned} events — {queryResult.has_more ? "more available" : "all shown"}
        </p>
      )}
    </div>
  );
}
