/**
 * Interlock Status Panel — M01.
 *
 * Shows ILK-001..ILK-007 status for the selected bay.
 * Active interlocks block commands. Dry-run validation available.
 * Each interlock shows: ID, description, active/clear badge, blocking equipment.
 */

import { useBayStore } from "../../store/bayStore";
import { Button } from "../ui/Button";

export default function InterlockStatusPanel() {
  const {
    selectedBayState,
    interlockStatus,
    lastCommandResult,
    commandLoading,
    clearCommandResult,
  } = useBayStore();

  if (!interlockStatus || !selectedBayState) return null;

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">
          Interlocks — {selectedBayState.name}
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded ${interlockStatus.all_clear ? "bg-status-success/20 text-status-success" : "bg-status-alarm/20 text-status-alarm"}`}>
          {interlockStatus.all_clear ? "All clear" : "Blocked"}
        </span>
      </div>

      <div className="space-y-1.5">
        {interlockStatus.rules.map((rule) => (
          <div key={rule.interlock_id} className={`flex items-start gap-3 rounded p-2 ${rule.currently_active ? "bg-status-alarm/10 border border-status-alarm/20" : "bg-bg-tertiary"}`}>
            <span className="font-mono text-xs text-text-muted w-16 shrink-0">{rule.interlock_id}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-secondary">{rule.description}</p>
              {rule.blocking_equipment && (
                <p className="text-xs text-text-muted mt-0.5 font-mono">
                  {rule.blocking_equipment}: {rule.blocking_state}
                </p>
              )}
            </div>
            <span className={`text-xs font-mono shrink-0 ${rule.currently_active ? "text-status-alarm" : "text-status-success"}`}>
              {rule.currently_active ? "ACTIVE" : "CLEAR"}
            </span>
          </div>
        ))}
      </div>

      {/* Last command result */}
      {lastCommandResult && (
        <div className={`mt-3 p-2 rounded text-xs ${lastCommandResult.success ? "bg-status-success/10 text-status-success" : "bg-status-alarm/10 text-status-alarm"}`}>
          <div className="flex items-center justify-between">
            <span>{lastCommandResult.success ? "✓" : "✗"} {lastCommandResult.equipment_id} → {lastCommandResult.action}</span>
            <Button variant="ghost" size="sm" onClick={clearCommandResult}>×</Button>
          </div>
          <p className="text-text-muted mt-0.5">{lastCommandResult.message}</p>
        </div>
      )}

      {/* Command buttons */}
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={commandLoading || !interlockStatus.all_clear}
          onClick={() => {
            // Execute a CLOSE on the CB — in a real app this would open a form
          }}
        >
          {commandLoading ? "Executing…" : "CB Close"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={commandLoading}
          onClick={() => {
            // Execute an OPEN on the CB
          }}
        >
          CB Open
        </Button>
        <span className="text-xs text-text-muted self-center ml-auto">
          Operator: SYS
        </span>
      </div>
    </div>
  );
}
