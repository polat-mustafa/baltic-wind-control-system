/**
 * Alarm list panel — priority-sorted protection alarms.
 *
 * Derives alarms from GOOSE simulation events. Priority mapping:
 * - Critical (red): relay_trip, breaker_open
 * - Warning (amber): relay_pickup, fault_inception
 * - Info (blue): goose_publish, scada_alarm
 *
 * Follows ISA-18.2 / EEMUA 191 alarm management principles.
 */

import { useMemo } from "react";

import { useScadaStore } from "../../store/scadaStore";
import { SCADA_COLORS } from "../../constants/scadaColors";
import type { ProtectionEvent } from "../../types/scada";

type AlarmPriority = "critical" | "warning" | "info";

interface Alarm {
  event: ProtectionEvent;
  priority: AlarmPriority;
}

const PRIORITY_CONFIG: Record<
  AlarmPriority,
  { label: string; color: string; bg: string }
> = {
  critical: {
    label: "CRIT",
    color: SCADA_COLORS.ALARM_CRITICAL,
    bg: "bg-red-900/30",
  },
  warning: {
    label: "WARN",
    color: SCADA_COLORS.WARNING,
    bg: "bg-amber-900/30",
  },
  info: {
    label: "INFO",
    color: SCADA_COLORS.ALARM_LOW,
    bg: "bg-cyan-900/30",
  },
};

function getAlarmPriority(eventType: string): AlarmPriority {
  switch (eventType) {
    case "relay_trip":
    case "breaker_open":
      return "critical";
    case "relay_pickup":
    case "fault_inception":
      return "warning";
    default:
      return "info";
  }
}

const PRIORITY_ORDER: Record<AlarmPriority, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export default function AlarmListPanel() {
  const { simulationResult } = useScadaStore();

  const alarms = useMemo<Alarm[]>(() => {
    if (!simulationResult) return [];

    return simulationResult.events
      .map((event) => ({
        event,
        priority: getAlarmPriority(event.event_type),
      }))
      .sort(
        (a, b) =>
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
          a.event.timestamp_ms - b.event.timestamp_ms,
      );
  }, [simulationResult]);

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">
          Alarm List (ISA-18.2)
        </h3>
        <span className="text-[10px] text-slate-500 font-mono">
          {alarms.length} alarms
        </span>
      </div>
      <div className="max-h-[320px] overflow-y-auto">
        {alarms.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-sm">
            No alarms — run a fault simulation
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-slate-900/50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-1.5 text-slate-500 font-medium">
                  Pri
                </th>
                <th className="text-left px-3 py-1.5 text-slate-500 font-medium">
                  Time [ms]
                </th>
                <th className="text-left px-3 py-1.5 text-slate-500 font-medium">
                  IED
                </th>
                <th className="text-left px-3 py-1.5 text-slate-500 font-medium">
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {alarms.map((alarm, i) => {
                const cfg = PRIORITY_CONFIG[alarm.priority];
                return (
                  <tr
                    key={i}
                    className={`${cfg.bg} border-b border-slate-700/50 hover:bg-slate-700/30`}
                  >
                    <td className="px-3 py-1.5">
                      <span
                        className="font-bold font-mono text-[10px]"
                        style={{ color: cfg.color }}
                      >
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-slate-300">
                      {alarm.event.timestamp_ms.toFixed(1)}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-slate-400">
                      {alarm.event.ied_name || "—"}
                    </td>
                    <td className="px-3 py-1.5 text-slate-300">
                      {alarm.event.description}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
