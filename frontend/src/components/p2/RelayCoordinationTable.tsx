/**
 * Relay Coordination (Selectivity Grading) Table — M05.
 *
 * Shows upstream/downstream relay pairs with actual vs required
 * Coordination Time Interval (CTI). Highlights violations in red.
 * IEC 60255-151: minimum CTI = 80 ms (electromechanical) or 50 ms (numerical).
 */

import { useProtectionStore } from "../../store/protectionStore";

export default function RelayCoordinationTable() {
  const { coordinationResult } = useProtectionStore();

  if (!coordinationResult) return null;

  const { grading_results, relay_sequence, first_relay, first_relay_time_ms, fully_graded } = coordinationResult;

  return (
    <div className="space-y-3">
      {/* Trip sequence summary */}
      <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-text-secondary">First trip</span>
          <span className={`text-xs font-mono px-2 py-0.5 rounded ${fully_graded ? "bg-status-success/20 text-status-success" : "bg-status-alarm/20 text-status-alarm"}`}>
            {fully_graded ? "Selective" : "Grading violation"}
          </span>
        </div>
        <p className="text-sm font-mono text-text-primary">
          {first_relay} — {first_relay_time_ms.toFixed(0)} ms
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {relay_sequence.map((event) => (
            <span key={event.relay_id} className={`text-xs px-2 py-0.5 rounded font-mono ${event.operated ? "bg-status-warning/20 text-status-warning" : "bg-bg-tertiary text-text-muted"}`}>
              {event.relay_location}: {event.trip_time_ms.toFixed(0)} ms
            </span>
          ))}
        </div>
      </div>

      {/* Grading pairs table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-text-secondary border-collapse">
          <thead>
            <tr className="border-b border-border-primary text-text-muted">
              <th className="text-left py-2 pr-3 font-medium">Upstream</th>
              <th className="text-left py-2 pr-3 font-medium">Downstream</th>
              <th className="text-right py-2 pr-3 font-medium">Margin (ms)</th>
              <th className="text-right py-2 pr-3 font-medium">Required (ms)</th>
              <th className="text-center py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {grading_results.map((pair) => (
              <tr key={pair.pair_id} className="border-b border-border-primary/50 hover:bg-bg-elevated/30">
                <td className="py-1.5 pr-3 font-mono">{pair.upstream_id}</td>
                <td className="py-1.5 pr-3 font-mono">{pair.downstream_id}</td>
                <td className={`py-1.5 pr-3 text-right font-mono ${pair.selective ? "text-status-success" : "text-status-alarm"}`}>
                  {(pair.actual_margin_ms).toFixed(0)}
                </td>
                <td className="py-1.5 pr-3 text-right font-mono text-text-muted">
                  {pair.required_margin_ms.toFixed(0)}
                </td>
                <td className="py-1.5 text-center">
                  {pair.selective ? (
                    <span className="text-status-success">✓</span>
                  ) : (
                    <span className="text-status-alarm font-bold">✗</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
