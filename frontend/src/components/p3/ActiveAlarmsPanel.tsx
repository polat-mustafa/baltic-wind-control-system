/**
 * Active Alarms Detail Panel — triggered by clicking the CRIT/HIGH badge area.
 *
 * Shows all ACTIVE alarms sorted by priority (CRITICAL first), each card
 * displaying equipment, fault type, value vs setpoint, probable cause,
 * and recommended action. Updates live from Zustand store.
 */

import * as Dialog from "@radix-ui/react-dialog";
import { type ReactNode } from "react";
import { AlertTriangle, Check, X } from "lucide-react";

import { useScadaStore } from "../../store/scadaStore";
import type { SCADAAlarm } from "../../types/scada";
import { cn } from "../../lib/utils";

const PRIORITY_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  CRITICAL: { label: "CRIT", color: "#f87171", bg: "bg-red-900/20", border: "border-red-700/40" },
  HIGH: { label: "HIGH", color: "#fb923c", bg: "bg-orange-900/20", border: "border-orange-700/40" },
  MEDIUM: { label: "MED", color: "#fbbf24", bg: "bg-yellow-900/15", border: "border-yellow-700/30" },
  LOW: { label: "LOW", color: "#94a3b8", bg: "bg-slate-800/30", border: "border-slate-700/30" },
};

const PRIORITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-GB", { hour12: false });
}

interface ActiveAlarmsPanelProps {
  children: ReactNode;
}

export function ActiveAlarmsPanel({ children }: ActiveAlarmsPanelProps) {
  const alarms = useScadaStore((s) => s.alarms);
  const acknowledgeAlarm = useScadaStore((s) => s.acknowledgeAlarm);
  const acknowledgeAll = useScadaStore((s) => s.acknowledgeAll);

  const activeAlarms = alarms
    .filter((a) => a.state === "ACTIVE")
    .sort(
      (a, b) =>
        PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority) ||
        b.timestamp - a.timestamp,
    );

  const criticalActive = activeAlarms.filter((a) => a.priority === "CRITICAL");

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[2100] w-full max-w-2xl max-h-[80vh]",
            "-translate-x-1/2 -translate-y-1/2 flex flex-col",
            "rounded-lg border border-border-secondary bg-bg-secondary shadow-2xl shadow-black/40",
            "focus:outline-none",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-primary shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-400" />
              <Dialog.Title className="text-base font-semibold text-text-primary">
                Active Alarms
              </Dialog.Title>
              {activeAlarms.length > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-red-900/40 text-red-400 text-xs font-bold font-mono">
                  {activeAlarms.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {criticalActive.length > 0 && (
                <button
                  onClick={() => acknowledgeAll("OPERATOR")}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-amber-700/50 bg-amber-900/20 text-amber-400 hover:bg-amber-900/40 transition-colors"
                >
                  <Check size={10} />
                  Ack All Critical
                </button>
              )}
              <Dialog.Close asChild>
                <button
                  className="rounded-md p-1 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Alarm list */}
          <div className="overflow-y-auto flex-1 p-4 space-y-3">
            {activeAlarms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-text-muted">
                <Check size={32} className="text-green-500 mb-3" />
                <p className="text-sm font-medium text-text-secondary">No active alarms</p>
                <p className="text-xs mt-1">System operating normally</p>
              </div>
            ) : (
              activeAlarms.map((alarm) => (
                <AlarmDetailCard
                  key={alarm.id}
                  alarm={alarm}
                  onAck={() => acknowledgeAlarm(alarm.id, "OPERATOR")}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-5 py-3 border-t border-border-primary flex items-center justify-between">
            <span className="text-[10px] text-text-muted font-mono">
              ISA-18.2 · IEC 62682 — Alarm Management
            </span>
            <Dialog.Close asChild>
              <button className="text-xs px-3 py-1 rounded border border-border-primary text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">
                Close
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Alarm Detail Card ────────────────────────────────────────────

function AlarmDetailCard({ alarm, onAck }: { alarm: SCADAAlarm; onAck: () => void }) {
  const pri = PRIORITY_STYLE[alarm.priority] ?? PRIORITY_STYLE.LOW;

  return (
    <div className={cn("rounded-lg border p-4 space-y-3", pri.bg, pri.border)}>
      {/* Top row: priority + equipment + time + ack */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span
            className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono"
            style={{ color: pri.color, backgroundColor: `${pri.color}22` }}
          >
            {pri.label}
          </span>
          <span className="font-mono text-xs text-text-primary truncate font-semibold">
            {alarm.equipment}
          </span>
          <span className="shrink-0 text-[10px] text-text-muted font-mono">
            {formatTime(alarm.timestamp)}
          </span>
        </div>
        <button
          onClick={onAck}
          className="shrink-0 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-amber-700/50 bg-amber-900/20 text-amber-400 hover:bg-amber-900/40 transition-colors"
          title="Acknowledge alarm"
        >
          <Check size={9} />
          ACK
        </button>
      </div>

      {/* Description + tag */}
      <div>
        <p className="text-xs text-text-primary leading-snug">{alarm.description}</p>
        <p className="text-[10px] text-text-muted font-mono mt-0.5">{alarm.tag}</p>
      </div>

      {/* Value vs setpoint */}
      <div className="flex items-center gap-4 text-[10px] font-mono">
        <div>
          <span className="text-text-muted">Value: </span>
          <span style={{ color: pri.color }} className="font-bold">{alarm.value}</span>
        </div>
        <div>
          <span className="text-text-muted">Setpoint: </span>
          <span className="text-text-secondary">{alarm.setpoint}</span>
        </div>
        <div>
          <span className="text-text-muted">Duration: </span>
          <span className="text-text-secondary">
            {alarm.durationSec < 60
              ? `${alarm.durationSec}s`
              : `${Math.floor(alarm.durationSec / 60)}m ${alarm.durationSec % 60}s`}
          </span>
        </div>
      </div>

      {/* Root cause + recommended action */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded bg-bg-tertiary border border-border-primary px-3 py-2">
          <span className="text-[9px] font-medium text-text-muted uppercase tracking-wider block mb-1">
            Root Cause
          </span>
          <p className="text-text-secondary leading-snug">{alarm.probableCause}</p>
        </div>
        <div className="rounded bg-bg-tertiary border border-border-primary px-3 py-2">
          <span className="text-[9px] font-medium text-status-info uppercase tracking-wider block mb-1">
            Recommended Action
          </span>
          <p className="text-text-secondary leading-snug">{alarm.recommendedAction}</p>
        </div>
      </div>
    </div>
  );
}
