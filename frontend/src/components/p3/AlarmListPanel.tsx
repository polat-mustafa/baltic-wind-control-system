/**
 * ISA-18.2 alarm list.
 *
 * Lifecycle: ACTIVE (unacknowledged) → ACKNOWLEDGED → RETURN_TO_NORMAL. An
 * alarm returns to normal when its condition clears (turbine reset, tripped
 * breakers re-closed) — never by an operator click; "Remove RTN" only tidies
 * alarms that are back to normal. Shelving (ISA-18.2 §16) hides a nuisance
 * alarm without acknowledging it.
 *
 * Unacknowledged alarms are bold with a priority bar; colour is reserved for
 * priority (ISA-101). Selecting a row shows the alarm response: cause,
 * consequence-driven action and the value against its limit.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { BellOff, Bell, CheckCheck, Download, Trash2, Volume2, VolumeX, X } from "lucide-react";

import { useScadaStore } from "../../store/scadaStore";
import { SCADA_COLORS } from "../../constants/scadaColors";
import type { AlarmPriority, AlarmState, SCADAAlarm } from "../../types/scada";
import { cn } from "../../lib/utils";

/** Priority chip: saturated background + legible text (WCAG ≥ 4.5:1). */
const PRIORITY_CHIP: Record<AlarmPriority, { label: string; bg: string; fg: string }> = {
  CRITICAL: { label: "P1", bg: SCADA_COLORS.ALARM_CRITICAL, fg: "#0a1520" },
  HIGH: { label: "P2", bg: SCADA_COLORS.ALARM_HIGH, fg: "#0a1520" },
  MEDIUM: { label: "P3", bg: SCADA_COLORS.ALARM_MEDIUM, fg: "#0a1520" },
  LOW: { label: "P4", bg: SCADA_COLORS.ALARM_LOW, fg: "#e4ecf3" },
};

const STATE_LABEL: Record<AlarmState, string> = {
  ACTIVE: "UNACK",
  ACKNOWLEDGED: "ACK",
  CLEARED: "CLEARED",
  RETURN_TO_NORMAL: "RTN",
};

const OPERATOR = "OPR-1";

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

/** Local plant time (CET/CEST) — operators work in site time, logs keep UTC. */
function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("sv-SE", { timeZone: "Europe/Warsaw", hour12: false });
}

function exportCsv(alarms: SCADAAlarm[]): void {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = alarms.map((a) =>
    [a.id, new Date(a.timestamp).toISOString(), a.priority, a.state, esc(a.tag), esc(a.equipment), esc(a.description), esc(a.value), esc(a.setpoint), a.durationSec, a.acknowledgedBy ?? ""].join(","),
  );
  const csv = ["id,time_utc,priority,state,tag,equipment,description,value,limit,duration_s,ack_by", ...rows].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `alarms_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function PriorityChip({ priority }: { priority: AlarmPriority }) {
  const c = PRIORITY_CHIP[priority];
  return (
    <span className="inline-block w-7 text-center rounded-sm text-xs font-mono font-bold leading-4" style={{ background: c.bg, color: c.fg }}>
      {c.label}
    </span>
  );
}

const selectCls = "h-6 text-xs bg-bg-secondary border border-border-primary rounded px-1.5 text-text-secondary";
const btnCls = "flex items-center gap-1 h-6 px-2 rounded border border-border-primary text-xs text-text-secondary hover:bg-bg-hover transition-colors";

export default function AlarmListPanel({ compact = false }: { compact?: boolean }) {
  const alarms = useScadaStore((s) => s.alarms);
  const filter = useScadaStore((s) => s.alarmFilter);
  const setFilter = useScadaStore((s) => s.setAlarmFilter);
  const acknowledgeAlarm = useScadaStore((s) => s.acknowledgeAlarm);
  const acknowledgeAll = useScadaStore((s) => s.acknowledgeAll);
  const clearAllResolved = useScadaStore((s) => s.clearAllResolved);
  const shelveAlarm = useScadaStore((s) => s.shelveAlarm);
  const unshelveAlarm = useScadaStore((s) => s.unshelveAlarm);
  const selectedId = useScadaStore((s) => s.selectedAlarmId);
  const setSelected = useScadaStore((s) => s.setSelectedAlarm);

  const [showShelved, setShowShelved] = useState(false);
  const [sound, setSound] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const prevP1 = useRef(0);

  // Audible annunciation of new P1 alarms (needs a prior click: autoplay policy)
  const p1Unack = alarms.filter((a) => a.priority === "CRITICAL" && a.state === "ACTIVE" && !a.shelved).length;
  useEffect(() => {
    if (sound && p1Unack > prevP1.current && audioRef.current) {
      const ctx = audioRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain).connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
    prevP1.current = p1Unack;
  }, [p1Unack, sound]);

  const filtered = useMemo(
    () =>
      alarms.filter(
        (a) =>
          a.shelved === showShelved &&
          (filter.priority === "ALL" || a.priority === filter.priority) &&
          (filter.state === "ALL" || a.state === filter.state) &&
          (!filter.equipment || `${a.equipment} ${a.tag}`.toLowerCase().includes(filter.equipment.toLowerCase())),
      ),
    [alarms, filter, showShelved],
  );

  const unack = alarms.filter((a) => a.state === "ACTIVE" && !a.shelved).length;
  const standing = alarms.filter((a) => (a.state === "ACTIVE" || a.state === "ACKNOWLEDGED") && !a.shelved).length;
  const shelved = alarms.filter((a) => a.shelved).length;
  const rate10 = alarms.filter((a) => a.timestamp > Date.now() - 600_000).length;
  const selected = selectedId ? alarms.find((a) => a.id === selectedId) ?? null : null;

  return (
    <div className="flex flex-col h-full bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 border-b border-border-primary shrink-0">
        <h3 className="text-xs font-semibold text-text-primary">Alarm List</h3>
        <span className="text-xs font-mono text-text-muted">ISA-18.2</span>
        <span className="text-xs font-mono text-text-secondary tabular-nums" title="Unacknowledged / standing (active) alarms">
          <b className={unack ? "text-text-primary" : undefined}>{unack}</b> unack · {standing} standing
        </span>
        {!compact && (
          <span
            className={cn("text-xs font-mono tabular-nums", rate10 > 10 ? "text-status-warning" : "text-text-muted")}
            title="EEMUA 191 / ISA-18.2: > 10 alarms in 10 min per operator is a flood"
          >
            {rate10}/10 min{rate10 > 10 ? " · FLOOD" : ""}
          </span>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => {
            if (!audioRef.current) {
              try {
                audioRef.current = new AudioContext();
              } catch {
                /* no audio device */
              }
            }
            setSound((v) => !v);
          }}
          className="p-1 rounded text-text-muted hover:text-text-primary"
          title={sound ? "Mute P1 horn" : "Sound horn on new P1 alarms"}
          aria-label={sound ? "Mute alarm horn" : "Enable alarm horn"}
        >
          {sound ? <Volume2 size={13} /> : <VolumeX size={13} />}
        </button>
        {!compact && (
          <button type="button" onClick={() => exportCsv(filtered)} className={btnCls} title="Export the visible alarms">
            <Download size={11} /> CSV
          </button>
        )}
      </div>

      {/* Filters + bulk actions */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 border-b border-border-primary bg-bg-tertiary shrink-0">
        <select value={filter.priority} onChange={(e) => setFilter({ priority: e.target.value as AlarmPriority | "ALL" })} className={selectCls} aria-label="Priority filter">
          <option value="ALL">All priorities</option>
          <option value="CRITICAL">P1 Critical</option>
          <option value="HIGH">P2 High</option>
          <option value="MEDIUM">P3 Medium</option>
          <option value="LOW">P4 Low</option>
        </select>
        <select value={filter.state} onChange={(e) => setFilter({ state: e.target.value as AlarmState | "ALL" })} className={selectCls} aria-label="State filter">
          <option value="ALL">All states</option>
          <option value="ACTIVE">Unacknowledged</option>
          <option value="ACKNOWLEDGED">Acknowledged</option>
          <option value="RETURN_TO_NORMAL">Returned to normal</option>
        </select>
        <input
          type="search"
          placeholder="Equipment / tag"
          value={filter.equipment}
          onChange={(e) => setFilter({ equipment: e.target.value })}
          className={cn(selectCls, "w-28")}
          aria-label="Equipment filter"
        />
        <span className="flex-1" />
        <button type="button" onClick={() => acknowledgeAll(OPERATOR)} disabled={!unack} className={cn(btnCls, "disabled:opacity-40")}>
          <CheckCheck size={11} /> ACK all
        </button>
        <button type="button" onClick={clearAllResolved} className={btnCls} title="Remove alarms that have returned to normal">
          <Trash2 size={11} /> Remove RTN
        </button>
        <button
          type="button"
          onClick={() => setShowShelved((v) => !v)}
          className={cn(btnCls, showShelved && "border-accent text-accent")}
          title={showShelved ? "Back to the live list" : "Show shelved alarms"}
        >
          <BellOff size={11} /> {shelved}
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-muted">
            {alarms.length === 0 ? "No alarms. Inject a fault or start the auto-simulation." : showShelved ? "No shelved alarms." : "No alarms match the filters."}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-tertiary text-text-muted">
              <tr className="text-left">
                <th className="px-2 py-1 font-medium w-9">Pri</th>
                <th className="px-2 py-1 font-medium w-16">Time</th>
                <th className="px-2 py-1 font-medium">Equipment</th>
                {!compact && <th className="px-2 py-1 font-medium">Description</th>}
                {!compact && <th className="px-2 py-1 font-medium text-right">Value</th>}
                <th className="px-2 py-1 font-medium w-14">State</th>
                {!compact && <th className="px-2 py-1 font-medium w-16 text-right">Dur</th>}
                <th className="px-2 py-1 w-14" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const isUnack = a.state === "ACTIVE";
                const inAlarm = isUnack || a.state === "ACKNOWLEDGED";
                return (
                  <tr
                    key={a.id}
                    onClick={() => setSelected(selectedId === a.id ? null : a.id)}
                    className={cn(
                      "border-b border-border-primary/60 cursor-pointer hover:bg-bg-hover",
                      selectedId === a.id && "bg-bg-hover",
                      !inAlarm && "opacity-60",
                    )}
                    style={{ boxShadow: isUnack ? `inset 3px 0 0 ${PRIORITY_CHIP[a.priority].bg}` : undefined }}
                  >
                    <td className="px-2 py-1">
                      <PriorityChip priority={a.priority} />
                    </td>
                    <td className="px-2 py-1 font-mono tabular-nums text-text-secondary">{formatTime(a.timestamp)}</td>
                    <td className={cn("px-2 py-1 font-mono", isUnack ? "font-semibold text-text-primary" : "text-text-secondary")}>
                      {a.equipment}
                      {compact && <div className="font-sans font-normal text-text-muted truncate max-w-[220px]">{a.description}</div>}
                    </td>
                    {!compact && (
                      <td className={cn("px-2 py-1", isUnack ? "font-semibold text-text-primary" : "text-text-secondary")}>{a.description}</td>
                    )}
                    {!compact && (
                      <td className="px-2 py-1 font-mono tabular-nums text-right text-text-secondary whitespace-nowrap" title={`Limit ${a.setpoint}`}>
                        {a.value}
                      </td>
                    )}
                    <td className={cn("px-2 py-1 font-mono", isUnack ? "font-bold text-text-primary animate-pulse" : "text-text-muted")}>{STATE_LABEL[a.state]}</td>
                    {!compact && <td className="px-2 py-1 font-mono tabular-nums text-right text-text-muted">{inAlarm ? formatDuration(a.durationSec) : "—"}</td>}
                    <td className="px-1 py-1 text-right whitespace-nowrap">
                      {isUnack && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            acknowledgeAlarm(a.id, OPERATOR);
                          }}
                          className="px-1.5 rounded border border-border-primary text-xs font-semibold text-text-primary hover:bg-bg-hover"
                        >
                          ACK
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (a.shelved) unshelveAlarm(a.id);
                          else shelveAlarm(a.id);
                        }}
                        className="ml-1 p-0.5 text-text-muted hover:text-text-primary align-middle"
                        title={a.shelved ? "Unshelve" : "Shelve (hide without acknowledging)"}
                        aria-label={a.shelved ? "Unshelve alarm" : "Shelve alarm"}
                      >
                        {a.shelved ? <Bell size={11} /> : <BellOff size={11} />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Alarm response (ISA-18.2 §11: cause, consequence, corrective action) */}
      {selected && (
        <div className="border-t border-border-primary bg-bg-tertiary px-3 py-2 text-xs shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <PriorityChip priority={selected.priority} />
            <span className="font-mono font-semibold text-text-primary">{selected.tag}</span>
            <span className="flex-1" />
            <button type="button" onClick={() => setSelected(null)} className="text-text-muted hover:text-text-primary" aria-label="Close alarm detail">
              <X size={13} />
            </button>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
            <dt className="text-text-muted">Value / limit</dt>
            <dd className="font-mono text-text-primary">
              {selected.value} <span className="text-text-muted">(limit {selected.setpoint})</span>
            </dd>
            <dt className="text-text-muted">Probable cause</dt>
            <dd className="text-text-secondary">{selected.probableCause}</dd>
            <dt className="text-text-muted">Operator action</dt>
            <dd className="text-text-primary">{selected.recommendedAction}</dd>
            {selected.acknowledgedBy && (
              <>
                <dt className="text-text-muted">Acknowledged</dt>
                <dd className="font-mono text-text-secondary">
                  {selected.acknowledgedBy} · {selected.acknowledgedAt ? formatTime(selected.acknowledgedAt) : ""}
                </dd>
              </>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
