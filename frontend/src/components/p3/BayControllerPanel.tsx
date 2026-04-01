/**
 * Bay Controller Panel — M01 Interlock Engine.
 *
 * Grid of all 8 OSS bays, each showing:
 *   - Bay name + voltage kV
 *   - Circuit breaker state (OPEN/CLOSED)
 *   - Bay mode badge (NORMAL/ISOLATED/LOCAL/REMOTE)
 *   - Protection relay state
 *   - Click to expand → InterlockStatusPanel
 *
 * IEC 61850 bay control: 7 interlock rules (ILK-001..ILK-007).
 */

import { useEffect } from "react";
import { Zap, AlertTriangle } from "lucide-react";

import { useBayStore } from "../../store/bayStore";
import { Button } from "../ui/Button";
import InterlockStatusPanel from "./InterlockStatusPanel";
import type { BayStateResponse } from "../../types/bay";

const MODE_COLOR: Record<string, string> = {
  NORMAL: "bg-status-success/20 text-status-success",
  REMOTE: "bg-accent/20 text-accent",
  LOCAL: "bg-status-warning/20 text-status-warning",
  ISOLATED: "bg-status-alarm/20 text-status-alarm",
  TEST: "bg-purple-500/20 text-purple-400",
};

const CB_COLOR: Record<string, string> = {
  CLOSED: "text-status-success",
  OPEN: "text-text-muted",
  INTERMEDIATE: "text-status-warning",
  UNKNOWN: "text-text-muted",
};

function BayCard({ bay, selected, onSelect }: {
  bay: BayStateResponse;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(bay.bay_id)}
      className={`w-full text-left bg-bg-secondary rounded-lg border p-3 transition-colors hover:border-accent/50 ${selected ? "border-accent" : "border-border-primary"}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs font-mono font-semibold text-text-primary">{bay.name}</p>
          <p className="text-xs text-text-muted">{bay.display_name}</p>
        </div>
        <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${MODE_COLOR[bay.bay_mode] ?? "bg-bg-tertiary text-text-muted"}`}>
          {bay.bay_mode}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <div>
          <span className="text-text-muted">CB </span>
          <span className={`font-mono font-semibold ${CB_COLOR[bay.circuit_breaker]}`}>
            {bay.circuit_breaker}
          </span>
        </div>
        <div>
          <span className="text-text-muted">{bay.voltage_kv} kV</span>
        </div>
        {bay.protection_relay !== "NORMAL" && (
          <span className="text-status-alarm">⚠ {bay.protection_relay}</span>
        )}
      </div>
      {bay.manual_isolation_active && (
        <p className="mt-1 text-xs text-status-warning">Isolation active</p>
      )}
    </button>
  );
}

export default function BayControllerPanel() {
  const { allBays, selectedBayId, loading, error, fetchAllBays, selectBay, clearError } = useBayStore();

  useEffect(() => {
    fetchAllBays();
  }, [fetchAllBays]);

  if (loading && !allBays) {
    return (
      <div className="flex items-center justify-center h-48 text-text-muted text-sm">
        <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin mr-2" />
        Loading bay registry…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-status-alarm/10 border border-status-alarm/30 rounded-lg text-sm flex justify-between">
          <span className="text-status-alarm flex items-center gap-2"><AlertTriangle size={14} /> {error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>Dismiss</Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-accent" />
          <span className="text-sm font-semibold text-text-primary">Bay Controller — OSS ({allBays?.total ?? 0} bays)</span>
        </div>
        <div className="flex gap-2 text-xs text-text-muted">
          <span className="text-status-success">{allBays?.energised_count ?? 0} energised</span>
          <span>·</span>
          <span>{allBays?.earthed_count ?? 0} earthed</span>
          {(allBays?.alarm_count ?? 0) > 0 && (
            <>
              <span>·</span>
              <span className="text-status-alarm">{allBays?.alarm_count} alarms</span>
            </>
          )}
        </div>
      </div>

      {/* Bay grid */}
      {allBays && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {allBays.bays.map((bay) => (
            <BayCard
              key={bay.bay_id}
              bay={bay}
              selected={selectedBayId === bay.bay_id}
              onSelect={selectBay}
            />
          ))}
        </div>
      )}

      {/* Interlock detail for selected bay */}
      {selectedBayId && <InterlockStatusPanel />}
    </div>
  );
}
