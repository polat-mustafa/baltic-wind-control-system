/**
 * ISA-18.2 compliant alarm table — full lifecycle management.
 *
 * Features:
 * - Alarm states: ACTIVE → ACKNOWLEDGED → CLEARED → RETURN-TO-NORMAL
 * - Columns: Time, Priority, Tag, Equipment, Description, Value, State, Duration, Actions
 * - Filtering by priority, state, equipment
 * - ACK button (single row) + ACK All + Clear (batch removes ACKNOWLEDGED/CLEARED/RTN)
 * - Per-row Clear button on ACKNOWLEDGED rows (moves → CLEARED)
 * - Alarm shelving (temporarily suppress known alarms)
 * - Unacknowledged alarm counter + flash indicator
 * - GOOSE alarm row click → detail side panel (protection timeline, compliance, timings)
 * - Full-screen mode via createPortal (Maximize button or press nothing; Esc to exit)
 * - CRITICAL sound alert toggle (Web AudioContext)
 * - Alarm rate indicator (+N / 5m)
 * - Export visible alarms as CSV (full-screen only)
 *
 * Standards: ISA-18.2 / EEMUA 191 alarm management.
 */

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Download,
  Filter,
  Maximize2,
  Minimize2,
  SkipBack,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { useScadaStore } from "../../store/scadaStore";
import { SCADA_COLORS } from "../../constants/scadaColors";
import type { AlarmPriority, AlarmState, ComplianceCheck, ProtectionEvent, SCADAAlarm } from "../../types/scada";
import { cn } from "../../lib/utils";

// ── Priority styling ─────────────────────────────────────────────

const PRIORITY_STYLE: Record<AlarmPriority, { label: string; color: string; bg: string }> = {
  CRITICAL: { label: "CRIT", color: SCADA_COLORS.ALARM_CRITICAL, bg: "bg-red-900/25" },
  HIGH: { label: "HIGH", color: SCADA_COLORS.ALARM_HIGH, bg: "bg-orange-900/25" },
  MEDIUM: { label: "MED", color: SCADA_COLORS.ALARM_MEDIUM, bg: "bg-yellow-900/25" },
  LOW: { label: "LOW", color: SCADA_COLORS.ALARM_LOW, bg: "bg-cyan-900/20" },
};

const STATE_STYLE: Record<AlarmState, { label: string; color: string }> = {
  ACTIVE: { label: "ACTIVE", color: SCADA_COLORS.ALARM_CRITICAL },
  ACKNOWLEDGED: { label: "ACK", color: SCADA_COLORS.WARNING },
  CLEARED: { label: "CLR", color: SCADA_COLORS.DE_ENERGIZED },
  RETURN_TO_NORMAL: { label: "RTN", color: SCADA_COLORS.ENERGIZED },
};

// ── Event color map (matches GOOSESimPanel) ──────────────────────

const EVENT_COLORS: Record<string, string> = {
  fault_inception: SCADA_COLORS.FAULT,
  relay_pickup:    SCADA_COLORS.WARNING,
  relay_trip:      SCADA_COLORS.FAULT,
  goose_publish:   SCADA_COLORS.EARTHED,
  breaker_open:    SCADA_COLORS.VOLTAGE_220KV,
  scada_alarm:     SCADA_COLORS.ALARM_HIGH,
};

// ── Helpers ──────────────────────────────────────────────────────

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("sv-SE", { timeZone: "Europe/Warsaw", hour12: false });
}

function exportAlarmsCsv(alarms: SCADAAlarm[]): void {
  const header = "ID,Time,Priority,State,Tag,Equipment,Description,Value,Dur(s),AcknowledgedBy";
  const rows = alarms.map((a) =>
    [
      a.id,
      new Date(a.timestamp).toISOString(),
      a.priority,
      a.state,
      `"${a.tag}"`,
      `"${a.equipment}"`,
      `"${a.description.replace(/"/g, '""')}"`,
      `"${a.value}"`,
      a.durationSec,
      a.acknowledgedBy ?? "",
    ].join(","),
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `alarms_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

// ── Simulated operator name ──────────────────────────────────────
const OPERATOR = "OPR-Kowalski";

// ── Props ─────────────────────────────────────────────────────────

interface AlarmListPanelProps {
  compact?: boolean;
}

// ── Main Component ───────────────────────────────────────────────

export default function AlarmListPanel({ compact = false }: AlarmListPanelProps) {
  const alarms          = useScadaStore((s) => s.alarms);
  const alarmFilter     = useScadaStore((s) => s.alarmFilter);
  const setAlarmFilter  = useScadaStore((s) => s.setAlarmFilter);
  const acknowledgeAlarm = useScadaStore((s) => s.acknowledgeAlarm);
  const acknowledgeAll  = useScadaStore((s) => s.acknowledgeAll);
  const clearAlarm      = useScadaStore((s) => s.clearAlarm);
  const clearAllResolved = useScadaStore((s) => s.clearAllResolved);
  const shelveAlarm     = useScadaStore((s) => s.shelveAlarm);
  const unshelveAlarm   = useScadaStore((s) => s.unshelveAlarm);
  const simulationResult = useScadaStore((s) => s.simulationResult);
  const selectedAlarmId  = useScadaStore((s) => s.selectedAlarmId);
  const setSelectedAlarm = useScadaStore((s) => s.setSelectedAlarm);

  const [showShelved, setShowShelved]       = useState(false);
  const [isFullscreen, setIsFullscreen]     = useState(false);
  const [soundEnabled, setSoundEnabled]     = useState(false);
  const [recentAlarmCount, setRecentAlarmCount] = useState(0);

  const prevCritCountRef = useRef(0);
  const audioCtxRef      = useRef<AudioContext | null>(null);

  // ── Escape key handler ─────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (selectedAlarmId) {
        setSelectedAlarm(null);
      } else if (isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isFullscreen, selectedAlarmId, setSelectedAlarm]);

  // ── Alarm rate indicator (5-min sliding window) ────────────────
  useEffect(() => {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    setRecentAlarmCount(
      alarms.filter(
        (a) =>
          a.timestamp > fiveMinAgo &&
          a.state !== "CLEARED" &&
          a.state !== "RETURN_TO_NORMAL",
      ).length,
    );
  }, [alarms]);

  // ── CRITICAL sound alert ───────────────────────────────────────
  const critCount = alarms.filter((a) => a.priority === "CRITICAL" && a.state === "ACTIVE").length;
  useEffect(() => {
    if (soundEnabled && critCount > prevCritCountRef.current) {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContext();
        }
        const ctx = audioCtxRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      } catch {
        // Browser AudioContext may require a prior user gesture; silently ignore
      }
    }
    prevCritCountRef.current = critCount;
  }, [critCount, soundEnabled]);

  // ── Filtered alarm list ────────────────────────────────────────
  const filtered = useMemo(() => {
    return alarms.filter((a) => {
      if (!showShelved && a.shelved) return false;
      if (alarmFilter.priority !== "ALL" && a.priority !== alarmFilter.priority) return false;
      if (alarmFilter.state !== "ALL" && a.state !== alarmFilter.state) return false;
      if (
        alarmFilter.equipment &&
        !a.equipment.toLowerCase().includes(alarmFilter.equipment.toLowerCase())
      )
        return false;
      return true;
    });
  }, [alarms, alarmFilter, showShelved]);

  // ── Counts ────────────────────────────────────────────────────
  const unackCount = alarms.filter((a) => a.state === "ACTIVE" && !a.shelved).length;
  const highCount  = alarms.filter((a) => a.priority === "HIGH" && a.state === "ACTIVE").length;

  // ── Selected alarm + its GOOSE events ─────────────────────────
  const selectedAlarm = useMemo(
    () => (selectedAlarmId ? alarms.find((a) => a.id === selectedAlarmId) ?? null : null),
    [alarms, selectedAlarmId],
  );
  const selectedAlarmEvents = useMemo(() => {
    if (!selectedAlarm || !simulationResult) return null;
    if (!selectedAlarm.tag.startsWith("GOOSE.")) return null;
    return simulationResult.events;
  }, [selectedAlarm, simulationResult]);

  const maxHeight = compact ? "" : "max-h-[400px]";

  // ── Row action helpers ─────────────────────────────────────────
  const rowHandlers = (alarm: SCADAAlarm) => ({
    onAck:    () => acknowledgeAlarm(alarm.id, OPERATOR),
    onClear:  () => clearAlarm(alarm.id),
    onShelve: () => (alarm.shelved ? unshelveAlarm(alarm.id) : shelveAlarm(alarm.id)),
    onSelect: () => {
      if (alarm.tag.startsWith("GOOSE.")) {
        setSelectedAlarm(selectedAlarmId === alarm.id ? null : alarm.id);
      }
    },
    isSelected: selectedAlarmId === alarm.id,
  });

  // ── Shared sub-components ──────────────────────────────────────

  const FilterBar = ({ alwaysShowEquipment = false }: { alwaysShowEquipment?: boolean }) => (
    <div className="px-3 py-1.5 border-b border-border-primary flex items-center gap-2 shrink-0 bg-bg-tertiary flex-wrap">
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
      {(alwaysShowEquipment || !compact) && (
        <input
          type="text"
          placeholder="Equipment..."
          value={alarmFilter.equipment}
          onChange={(e) => setAlarmFilter({ equipment: e.target.value })}
          className="text-[10px] bg-bg-secondary border border-border-primary rounded px-1.5 py-0.5 text-text-secondary w-24"
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
        title="Clear all acknowledged / resolved alarms"
      >
        <Trash2 size={9} /> Clear
      </button>
      <button
        onClick={() => setShowShelved(!showShelved)}
        className={cn(
          "text-[9px] px-1.5 py-0.5 rounded transition-colors flex items-center gap-1",
          showShelved
            ? "bg-cyan-900/30 text-cyan-400"
            : "bg-slate-700/50 text-text-muted hover:bg-slate-700/80",
        )}
        title={showShelved ? "Hide shelved alarms" : "Show shelved alarms"}
      >
        {showShelved ? <Bell size={9} /> : <BellOff size={9} />}
      </button>
    </div>
  );

  const AlarmTable = ({
    alarmList,
    forceFullColumns,
  }: {
    alarmList: SCADAAlarm[];
    forceFullColumns?: boolean;
  }) => (
    <table className="w-full text-[10px]">
      <thead className="bg-bg-tertiary sticky top-0">
        <tr>
          <th className="text-left px-2 py-1 text-text-muted font-medium w-14">Pri</th>
          <th className="text-left px-2 py-1 text-text-muted font-medium w-16">Time</th>
          <th className="text-left px-2 py-1 text-text-muted font-medium w-14">State</th>
          <th className="text-left px-2 py-1 text-text-muted font-medium">Equipment</th>
          {(forceFullColumns || !compact) && (
            <th className="text-left px-2 py-1 text-text-muted font-medium">Description</th>
          )}
          {(forceFullColumns || !compact) && (
            <th className="text-left px-2 py-1 text-text-muted font-medium w-16">Value</th>
          )}
          <th className="text-left px-2 py-1 text-text-muted font-medium w-14">Dur</th>
          <th className="text-left px-2 py-1 text-text-muted font-medium w-14"></th>
        </tr>
      </thead>
      <tbody>
        {alarmList.map((alarm) => (
          <AlarmRow
            key={alarm.id}
            alarm={alarm}
            compact={forceFullColumns ? false : compact}
            {...rowHandlers(alarm)}
          />
        ))}
      </tbody>
    </table>
  );

  // ── Normal panel ───────────────────────────────────────────────

  const normalPanel = (
    <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border-primary flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-text-primary">Alarm List</h3>
          <span className="text-[9px] text-text-muted font-mono">ISA-18.2</span>
          {unackCount > 0 && (
            <span
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold",
                critCount > 0
                  ? "bg-red-900/50 text-red-400 animate-pulse"
                  : "bg-amber-900/40 text-amber-400",
              )}
            >
              <Bell size={10} />
              {unackCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
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
          {recentAlarmCount > 0 && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-900/20 text-amber-400">
              +{recentAlarmCount}/5m
            </span>
          )}
          <span className="text-[9px] text-text-muted font-mono">
            {filtered.length}/{alarms.length}
          </span>
          {/* Sound toggle */}
          <button
            onClick={() => {
              // Initialize AudioContext on first click (satisfies browser autoplay policy)
              if (!audioCtxRef.current && !soundEnabled) {
                try { audioCtxRef.current = new AudioContext(); } catch { /* ignore */ }
              }
              setSoundEnabled(!soundEnabled);
            }}
            className={cn(
              "p-0.5 rounded transition-colors",
              soundEnabled ? "text-cyan-400" : "text-text-muted hover:text-text-secondary",
            )}
            title={soundEnabled ? "Mute CRITICAL alarm sound" : "Enable CRITICAL alarm sound"}
          >
            {soundEnabled ? <Volume2 size={10} /> : <VolumeX size={10} />}
          </button>
          {/* Maximize */}
          <button
            onClick={() => setIsFullscreen(true)}
            className="p-0.5 rounded text-text-muted hover:text-text-secondary transition-colors"
            title="Full-screen alarm list"
          >
            <Maximize2 size={10} />
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar />

      {/* Body: alarm table + optional GOOSE detail panel */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        <div className={cn("overflow-y-auto flex-1", !selectedAlarm && maxHeight)}>
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-text-muted text-sm">
              {alarms.length === 0
                ? "No alarms — start auto-simulation or run a fault scenario"
                : "No alarms match current filters"}
            </div>
          ) : (
            <AlarmTable alarmList={filtered} />
          )}
        </div>
        {selectedAlarm && (
          <AlarmDetailSidePanel
            alarm={selectedAlarm}
            events={selectedAlarmEvents}
            compliance={simulationResult?.compliance ?? null}
            onClose={() => setSelectedAlarm(null)}
            wide={false}
          />
        )}
      </div>
    </div>
  );

  // ── Fullscreen portal ──────────────────────────────────────────

  const fullscreenPortal = isFullscreen
    ? createPortal(
        <div className="fixed inset-0 z-1000 bg-bg-primary flex flex-col">
          {/* Fullscreen header */}
          <div className="px-4 py-2 border-b border-border-primary flex items-center justify-between shrink-0 bg-bg-secondary">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-text-primary">Alarm List</h2>
              <span className="text-[9px] text-text-muted font-mono">ISA-18.2 · Full Screen</span>
              {unackCount > 0 && (
                <span
                  className={cn(
                    "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold",
                    critCount > 0
                      ? "bg-red-900/50 text-red-400 animate-pulse"
                      : "bg-amber-900/40 text-amber-400",
                  )}
                >
                  <Bell size={10} />
                  {unackCount} unacknowledged
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Export CSV */}
              <button
                onClick={() => exportAlarmsCsv(filtered)}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-bg-tertiary border border-border-primary text-text-muted hover:text-text-primary transition-colors"
                title="Export visible alarms as CSV"
              >
                <Download size={10} /> Export CSV
              </button>
              {/* Replay SLD animation */}
              {simulationResult && (
                <button
                  onClick={() => { void useScadaStore.getState().runGooseSimulation(); }}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-bg-tertiary border border-border-primary text-text-muted hover:text-text-primary transition-colors"
                  title="Re-run GOOSE simulation and replay SLD animation"
                >
                  <SkipBack size={10} /> Replay SLD
                </button>
              )}
              {/* Sound toggle */}
              <button
                onClick={() => {
                  if (!audioCtxRef.current && !soundEnabled) {
                    try { audioCtxRef.current = new AudioContext(); } catch { /* ignore */ }
                  }
                  setSoundEnabled(!soundEnabled);
                }}
                className={cn(
                  "p-1 rounded transition-colors",
                  soundEnabled ? "text-cyan-400" : "text-text-muted hover:text-text-secondary",
                )}
                title={soundEnabled ? "Mute CRITICAL alarm sound" : "Enable CRITICAL alarm sound"}
              >
                {soundEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
              </button>
              {/* Minimize */}
              <button
                onClick={() => setIsFullscreen(false)}
                className="p-1 rounded text-text-muted hover:text-text-primary transition-colors"
                title="Exit full screen (Esc)"
              >
                <Minimize2 size={14} />
              </button>
            </div>
          </div>

          {/* Filter bar — always shows equipment input */}
          <FilterBar alwaysShowEquipment />

          {/* Body */}
          <div className="flex flex-1 overflow-hidden min-h-0">
            <div className="overflow-y-auto flex-1">
              {filtered.length === 0 ? (
                <div className="p-10 text-center text-text-muted">
                  {alarms.length === 0
                    ? "No alarms — start auto-simulation or run a fault scenario"
                    : "No alarms match current filters"}
                </div>
              ) : (
                <AlarmTable alarmList={filtered} forceFullColumns />
              )}
            </div>
            {selectedAlarm && (
              <AlarmDetailSidePanel
                alarm={selectedAlarm}
                events={selectedAlarmEvents}
                compliance={simulationResult?.compliance ?? null}
                onClose={() => setSelectedAlarm(null)}
                wide
              />
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-4 py-1.5 bg-bg-secondary border-t border-border-primary flex items-center gap-4 text-[10px] font-mono text-text-muted">
            <span>
              {filtered.length} of {alarms.length} alarms visible
            </span>
            {recentAlarmCount > 0 && (
              <span className="text-amber-400">+{recentAlarmCount} new in last 5 minutes</span>
            )}
            <span className="ml-auto">ISA-18.2 · EEMUA 191 · IEC 62682</span>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      {normalPanel}
      {fullscreenPortal}
    </>
  );
}

// ── Alarm Row ────────────────────────────────────────────────────

function AlarmRow({
  alarm,
  compact,
  onAck,
  onClear,
  onShelve,
  onSelect,
  isSelected,
}: {
  alarm: SCADAAlarm;
  compact: boolean;
  onAck: () => void;
  onClear: () => void;
  onShelve: () => void;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const pri   = PRIORITY_STYLE[alarm.priority];
  const state = STATE_STYLE[alarm.state];
  const isGoose = alarm.tag.startsWith("GOOSE.");

  return (
    <tr
      onClick={isGoose ? onSelect : undefined}
      style={{ boxShadow: `inset 3px 0 0 ${pri.color}` }}
      className={cn(
        pri.bg,
        "border-b border-border-primary/50 hover:bg-bg-hover/50 transition-colors",
        isGoose && "cursor-pointer",
        alarm.state === "ACTIVE" && alarm.priority === "CRITICAL" && "animate-pulse",
        alarm.shelved && "opacity-50",
        isSelected && "ring-1 ring-inset ring-blue-500/60",
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
        <td
          className="px-2 py-1 text-text-primary truncate max-w-[200px]"
          title={alarm.description}
        >
          {alarm.description}
        </td>
      )}
      {!compact && (
        <td className="px-2 py-1 font-mono text-text-secondary">{alarm.value}</td>
      )}
      <td className="px-2 py-1 font-mono text-text-muted">
        {formatDuration(alarm.durationSec)}
      </td>
      <td className="px-2 py-1">
        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          {alarm.state === "ACTIVE" && (
            <button
              onClick={onAck}
              className="p-0.5 rounded hover:bg-amber-900/40 text-amber-400 transition-colors"
              title="Acknowledge alarm"
            >
              <Check size={10} />
            </button>
          )}
          {alarm.state === "ACKNOWLEDGED" && (
            <button
              onClick={onClear}
              className="p-0.5 rounded hover:bg-slate-700/60 text-text-muted hover:text-text-secondary transition-colors"
              title="Clear acknowledged alarm"
            >
              <Trash2 size={10} />
            </button>
          )}
          <button
            onClick={onShelve}
            className={cn(
              "p-0.5 rounded transition-colors",
              alarm.shelved
                ? "text-cyan-400 hover:bg-cyan-900/40"
                : "text-text-muted hover:bg-slate-700/50",
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

// ── GOOSE Detail Side Panel ──────────────────────────────────────

function AlarmDetailSidePanel({
  alarm,
  events,
  compliance,
  onClose,
  wide,
}: {
  alarm: SCADAAlarm;
  events: ProtectionEvent[] | null;
  compliance: ComplianceCheck | null;
  onClose: () => void;
  wide: boolean;
}) {
  const relayPickup = events?.find((e) => e.event_type === "relay_pickup");
  const relayTrip   = events?.find((e) => e.event_type === "relay_trip");
  const breakerOpen = events?.find((e) => e.event_type === "breaker_open");

  const allCompliant =
    compliance !== null
      ? compliance.goose_compliant && compliance.clearance_compliant
      : null;

  return (
    <div
      className={cn(
        "border-l border-border-primary bg-bg-primary flex flex-col shrink-0 overflow-y-auto",
        wide ? "w-96" : "w-64",
      )}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-border-primary flex items-center justify-between shrink-0 bg-bg-secondary">
        <span className="text-[10px] font-semibold text-text-primary font-mono truncate">
          {alarm.tag}
        </span>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text-primary transition-colors ml-2 shrink-0"
          title="Close detail panel (Esc)"
        >
          <X size={12} />
        </button>
      </div>

      {/* Compliance badge */}
      {allCompliant !== null && (
        <div className="px-3 py-2 border-b border-border-primary">
          <span
            className="text-[10px] px-2 py-0.5 rounded font-bold"
            style={{
              backgroundColor: allCompliant ? "#064e3b" : "#7f1d1d",
              color: allCompliant ? SCADA_COLORS.ENERGIZED : SCADA_COLORS.FAULT,
            }}
          >
            {allCompliant ? "IEC COMPLIANT" : "NON-COMPLIANT"}
          </span>
          {compliance && (
            <div className="mt-1 text-[9px] font-mono text-text-muted">
              GOOSE: {compliance.goose_latency_ms.toFixed(1)} ms /{" "}
              {compliance.goose_max_allowed_ms} ms max
            </div>
          )}
        </div>
      )}

      {/* Alarm metadata */}
      <div className="px-3 py-2 space-y-1 border-b border-border-primary text-[10px]">
        <div className="flex justify-between gap-2">
          <span className="text-text-muted shrink-0">Equipment</span>
          <span className="font-mono text-text-secondary text-right">{alarm.equipment}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-text-muted shrink-0">Fault Type</span>
          <span className="font-mono text-text-secondary text-right capitalize">
            {alarm.faultType.replace(/_/g, " ")}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-text-muted shrink-0">Duration</span>
          <span className="font-mono text-text-secondary">{formatDuration(alarm.durationSec)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-text-muted shrink-0">Value</span>
          <span className="font-mono text-text-secondary">{alarm.value}</span>
        </div>
      </div>

      {/* Protection timeline */}
      {events && events.length > 0 && (
        <div className="px-3 py-2 border-b border-border-primary">
          <div className="text-[9px] text-text-muted uppercase tracking-wider mb-2">
            Protection Timeline
          </div>
          <div className="space-y-1.5">
            {events.map((ev, i) => (
              <div key={i} className="flex items-start gap-2">
                <span
                  className="text-[9px] font-mono tabular-nums shrink-0 pt-0.5 min-w-[44px] text-right"
                  style={{ color: EVENT_COLORS[ev.event_type] ?? "#6b7280" }}
                >
                  {ev.timestamp_ms.toFixed(1)} ms
                </span>
                <span className="text-[9px] text-text-secondary leading-tight">
                  {ev.description}
                  {ev.ied_name && (
                    <span className="text-text-muted ml-1 font-mono">({ev.ied_name})</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key timings */}
      {(relayPickup || relayTrip || breakerOpen) && (
        <div className="px-3 py-2 border-b border-border-primary text-[10px] space-y-1">
          <div className="text-[9px] text-text-muted uppercase tracking-wider mb-1">
            Key Timings
          </div>
          {relayPickup && (
            <div className="flex justify-between">
              <span className="text-text-muted">Relay Pickup</span>
              <span className="font-mono" style={{ color: SCADA_COLORS.WARNING }}>
                {relayPickup.timestamp_ms.toFixed(1)} ms
              </span>
            </div>
          )}
          {relayTrip && (
            <div className="flex justify-between">
              <span className="text-text-muted">Relay Trip</span>
              <span className="font-mono" style={{ color: SCADA_COLORS.FAULT }}>
                {relayTrip.timestamp_ms.toFixed(1)} ms
              </span>
            </div>
          )}
          {breakerOpen && (
            <div className="flex justify-between">
              <span className="text-text-muted">Breaker Open</span>
              <span className="font-mono text-blue-400">
                {breakerOpen.timestamp_ms.toFixed(1)} ms
              </span>
            </div>
          )}
        </div>
      )}

      {/* Probable cause + recommended action */}
      <div className="px-3 py-2 space-y-3 text-[10px]">
        {alarm.probableCause && (
          <div>
            <div className="text-[9px] text-text-muted uppercase tracking-wider mb-1">
              Probable Cause
            </div>
            <p className="text-text-secondary leading-snug">{alarm.probableCause}</p>
          </div>
        )}
        {alarm.recommendedAction && (
          <div>
            <div className="text-[9px] text-blue-400 uppercase tracking-wider mb-1">
              Recommended Action
            </div>
            <p className="text-text-secondary leading-snug">{alarm.recommendedAction}</p>
          </div>
        )}
      </div>
    </div>
  );
}
