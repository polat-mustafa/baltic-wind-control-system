/**
 * ISA-18.2 compliant alarm table — full lifecycle management.
 *
 * Features:
 * - Alarm states: ACTIVE → ACKNOWLEDGED → CLEARED → RETURN-TO-NORMAL
 * - Columns: Time, Priority, Tag, Equipment, Description, Value, Setpoint, State, Duration, ACK
 * - Filtering by priority, state, equipment
 * - Acknowledge button (single + batch)
 * - Alarm shelving (temporarily suppress known alarms)
 * - Unacknowledged alarm counter + flash indicator
 *
 * Standards: ISA-18.2 / EEMUA 191 alarm management.
 */

import { useMemo, useState } from "react";

import { useScadaStore } from "../../store/scadaStore";
import { SCADA_COLORS } from "../../constants/scadaColors";
import type { AlarmPriority, AlarmState, SCADAAlarm } from "../../types/scada";
import { cn } from "../../lib/utils";
import { Bell, BellOff, Check, CheckCheck, Filter, Trash2 } from "lucide-react";

// ── Priority styling ─────────────────────────────────────────────

const PRIORITY_STYLE: Record<AlarmPriority, { label: string; color: string; bg: string }> = {
  CRITICAL: { label: "CRIT", color: SCADA_COLORS.ALARM_CRITICAL, bg: "bg-red-900/25" },
  HIGH: { label: "HIGH", color: SCADA_COLORS.ALARM_HIGH, bg: "bg-orange-900/25" },
  MEDIUM: { label: "MED", color: SCADA_COLORS.ALARM_MEDIUM, bg: "bg-yellow-900/25" },
  LOW: { label: "LOW", color: SCADA_COLORS.ALARM_LOW, bg: "bg-cyan-900/20" },
};

const STATE_STYLE: Record<AlarmState, { label: string; color: string }> = {
  ACTIVE: { label: "ACTIVE", color: "#ef4444" },
  ACKNOWLEDGED: { label: "ACK", color: "#f5a623" },
  CLEARED: { label: "CLR", color: "#6b7280" },
  RETURN_TO_NORMAL: { label: "RTN", color: "#3ecf6e" },
};

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("sv-SE", { timeZone: "Europe/Warsaw", hour12: false });
}

// ── Simulated operator name ──────────────────────────────────────
const OPERATOR = "OPR-Kowalski";

interface AlarmListPanelProps {
  compact?: boolean;
}

export default function AlarmListPanel({ compact = false }: AlarmListPanelProps) {
  const alarms = useScadaStore((s) => s.alarms);
  const alarmFilter = useScadaStore((s) => s.alarmFilter);
  const setAlarmFilter = useScadaStore((s) => s.setAlarmFilter);
  const acknowledgeAlarm = useScadaStore((s) => s.acknowledgeAlarm);
  const acknowledgeAll = useScadaStore((s) => s.acknowledgeAll);
  const clearAllResolved = useScadaStore((s) => s.clearAllResolved);
  const shelveAlarm = useScadaStore((s) => s.shelveAlarm);
  const unshelveAlarm = useScadaStore((s) => s.unshelveAlarm);
  const [showShelved, setShowShelved] = useState(false);

  // Filter alarms
  const filtered = useMemo(() => {
    return alarms.filter((a) => {
      if (!showShelved && a.shelved) return false;
      if (alarmFilter.priority !== "ALL" && a.priority !== alarmFilter.priority) return false;
      if (alarmFilter.state !== "ALL" && a.state !== alarmFilter.state) return false;
      if (alarmFilter.equipment && !a.equipment.toLowerCase().includes(alarmFilter.equipment.toLowerCase())) return false;
      return true;
    });
  }, [alarms, alarmFilter, showShelved]);

  // Counts
  const unackCount = alarms.filter((a) => a.state === "ACTIVE" && !a.shelved).length;
  const critCount = alarms.filter((a) => a.priority === "CRITICAL" && a.state === "ACTIVE").length;
  const highCount = alarms.filter((a) => a.priority === "HIGH" && a.state === "ACTIVE").length;

  const maxHeight = compact ? "" : "max-h-[400px]";

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border-primary flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">
            Alarm List
          </h3>
          <span className="text-[9px] text-text-muted font-mono">ISA-18.2</span>
          {/* Unack badge - flashing for critical */}
          {unackCount > 0 && (
            <span className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold",
              critCount > 0 ? "bg-red-900/50 text-red-400 animate-pulse" : "bg-amber-900/40 text-amber-400",
            )}>
              <Bell size={10} />
              {unackCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Priority counter badges */}
          {critCount > 0 && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-900/30 text-red-400">
              {critCount} CRIT
            </span>
          )}
          {highCount > 0 && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-orange-900/30 text-orange-400">
              {highCount} HIGH
            </span>
          )}
          <span className="text-[9px] text-text-muted font-mono">
            {filtered.length}/{alarms.length}
          </span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-3 py-1.5 border-b border-border-primary flex items-center gap-2 shrink-0 bg-bg-tertiary">
        <Filter size={10} className="text-text-muted" />
        <select
          value={alarmFilter.priority}
          onChange={(e) => setAlarmFilter({ priority: e.target.value as AlarmPriority | "ALL" })}
          className="text-[10px] bg-bg-secondary border border-border-primary rounded px-1.5 py-0.5 text-text-secondary"
        >
          <option value="ALL">All Pri</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <select
          value={alarmFilter.state}
          onChange={(e) => setAlarmFilter({ state: e.target.value as AlarmState | "ALL" })}
          className="text-[10px] bg-bg-secondary border border-border-primary rounded px-1.5 py-0.5 text-text-secondary"
        >
          <option value="ALL">All State</option>
          <option value="ACTIVE">Active</option>
          <option value="ACKNOWLEDGED">Acknowledged</option>
          <option value="CLEARED">Cleared</option>
          <option value="RETURN_TO_NORMAL">RTN</option>
        </select>
        {!compact && (
          <input
            type="text"
            placeholder="Equipment..."
            value={alarmFilter.equipment}
            onChange={(e) => setAlarmFilter({ equipment: e.target.value })}
            className="text-[10px] bg-bg-secondary border border-border-primary rounded px-1.5 py-0.5 text-text-secondary w-20"
          />
        )}
        <div className="flex-1" />
        <button
          onClick={() => acknowledgeAll(OPERATOR)}
          className="text-[9px] px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400 hover:bg-amber-900/50 transition-colors flex items-center gap-1"
          title="Acknowledge all active alarms"
        >
          <CheckCheck size={9} /> ACK All
        </button>
        <button
          onClick={clearAllResolved}
          className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700/50 text-text-muted hover:bg-slate-700/80 transition-colors flex items-center gap-1"
          title="Clear all resolved alarms"
        >
          <Trash2 size={9} /> Clear
        </button>
        <button
          onClick={() => setShowShelved(!showShelved)}
          className={cn(
            "text-[9px] px-1.5 py-0.5 rounded transition-colors flex items-center gap-1",
            showShelved ? "bg-cyan-900/30 text-cyan-400" : "bg-slate-700/50 text-text-muted hover:bg-slate-700/80",
          )}
          title={showShelved ? "Hide shelved alarms" : "Show shelved alarms"}
        >
          {showShelved ? <Bell size={9} /> : <BellOff size={9} />}
        </button>
      </div>

      {/* Alarm table */}
      <div className={cn("overflow-y-auto flex-1", maxHeight)}>
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-text-muted text-sm">
            {alarms.length === 0
              ? "No alarms — start auto-simulation or run a fault scenario"
              : "No alarms match current filters"}
          </div>
        ) : (
          <table className="w-full text-[10px]">
            <thead className="bg-bg-tertiary sticky top-0">
              <tr>
                <th className="text-left px-2 py-1 text-text-muted font-medium w-14">Pri</th>
                <th className="text-left px-2 py-1 text-text-muted font-medium w-16">Time</th>
                <th className="text-left px-2 py-1 text-text-muted font-medium w-14">State</th>
                <th className="text-left px-2 py-1 text-text-muted font-medium">Equipment</th>
                {!compact && <th className="text-left px-2 py-1 text-text-muted font-medium">Description</th>}
                {!compact && <th className="text-left px-2 py-1 text-text-muted font-medium w-16">Value</th>}
                <th className="text-left px-2 py-1 text-text-muted font-medium w-14">Dur</th>
                <th className="text-left px-2 py-1 text-text-muted font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((alarm) => (
                <AlarmRow
                  key={alarm.id}
                  alarm={alarm}
                  compact={compact}
                  onAck={() => acknowledgeAlarm(alarm.id, OPERATOR)}
                  onShelve={() => alarm.shelved ? unshelveAlarm(alarm.id) : shelveAlarm(alarm.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Alarm Row Component ──────────────────────────────────────────

function AlarmRow({
  alarm,
  compact,
  onAck,
  onShelve,
}: {
  alarm: SCADAAlarm;
  compact: boolean;
  onAck: () => void;
  onShelve: () => void;
}) {
  const pri = PRIORITY_STYLE[alarm.priority];
  const state = STATE_STYLE[alarm.state];

  return (
    <tr
      className={cn(
        pri.bg,
        "border-b border-border-primary/50 hover:bg-bg-hover/50 transition-colors",
        alarm.state === "ACTIVE" && alarm.priority === "CRITICAL" && "animate-pulse",
        alarm.shelved && "opacity-50",
      )}
    >
      <td className="px-2 py-1">
        <span className="font-bold font-mono" style={{ color: pri.color }}>
          {pri.label}
        </span>
      </td>
      <td className="px-2 py-1 font-mono text-text-secondary">
        {formatTime(alarm.timestamp)}
      </td>
      <td className="px-2 py-1">
        <span className="font-mono font-medium" style={{ color: state.color }}>
          {state.label}
        </span>
      </td>
      <td className="px-2 py-1 font-mono text-text-secondary">
        {alarm.equipment}
      </td>
      {!compact && (
        <td className="px-2 py-1 text-text-primary truncate max-w-[200px]" title={alarm.description}>
          {alarm.description}
        </td>
      )}
      {!compact && (
        <td className="px-2 py-1 font-mono text-text-secondary">
          {alarm.value}
        </td>
      )}
      <td className="px-2 py-1 font-mono text-text-muted">
        {formatDuration(alarm.durationSec)}
      </td>
      <td className="px-2 py-1">
        <div className="flex items-center gap-0.5">
          {alarm.state === "ACTIVE" && (
            <button
              onClick={onAck}
              className="p-0.5 rounded hover:bg-amber-900/40 text-amber-400 transition-colors"
              title="Acknowledge alarm"
            >
              <Check size={10} />
            </button>
          )}
          <button
            onClick={onShelve}
            className={cn(
              "p-0.5 rounded transition-colors",
              alarm.shelved ? "text-cyan-400 hover:bg-cyan-900/40" : "text-text-muted hover:bg-slate-700/50",
            )}
            title={alarm.shelved ? "Unshelve" : "Shelve"}
          >
            {alarm.shelved ? <Bell size={10} /> : <BellOff size={10} />}
          </button>
        </div>
      </td>
    </tr>
  );
}
