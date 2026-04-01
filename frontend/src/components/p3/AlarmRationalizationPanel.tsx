/**
 * Alarm Rationalization Panel — M09 (EEMUA 191 / ISA-18.2).
 *
 * Three sections:
 *   1. EEMUA 191 KPI row (rate/10min, grade, unacked, chattering count)
 *   2. Chattering alarm list + flood events
 *   3. Alarm rationalization database (cause / consequence / operator action)
 *
 * EEMUA 191 benchmark: ≤1 alarm/10 min steady state, ≤10/10 min upset.
 */

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

import { useAlarmStore } from "../../store/alarmStore";
import { Button } from "../ui/Button";

const GRADE_COLOR: Record<string, string> = {
  GOOD: "text-status-success",
  ACCEPTABLE: "text-status-warning",
  POOR: "text-status-alarm",
  UNACCEPTABLE: "text-status-alarm font-bold",
};

export default function AlarmRationalizationPanel() {
  const { kpi, alarms, chattering, rationalization, loading, fetchAll, shelveAlarm } = useAlarmStore();
  const [activeTab, setActiveTab] = useState<"kpi" | "chatterers" | "rationalize">("kpi");

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading && !kpi) {
    return (
      <div className="flex items-center justify-center h-48 text-text-muted text-sm">
        <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin mr-2" />
        Loading alarm data…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-accent" />
          <span className="text-sm font-semibold text-text-primary">Alarm Rationalization (EEMUA 191)</span>
        </div>
        <Button size="sm" onClick={fetchAll} disabled={loading}>Refresh</Button>
      </div>

      {/* KPI strip */}
      {kpi && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="bg-bg-tertiary rounded p-2">
            <p className="text-text-muted">Rate / 10 min</p>
            <p className={`font-mono font-bold text-lg ${kpi.rate_benchmark_met ? "text-status-success" : "text-status-alarm"}`}>
              {kpi.average_rate_per_10_min.toFixed(1)}
            </p>
            <p className="text-text-muted">benchmark {kpi.rate_benchmark_met ? "met ✓" : "exceeded ✗"}</p>
          </div>
          <div className="bg-bg-tertiary rounded p-2">
            <p className="text-text-muted">Overall grade</p>
            <p className={`font-bold text-lg ${GRADE_COLOR[kpi.overall_grade]}`}>{kpi.overall_grade}</p>
          </div>
          <div className="bg-bg-tertiary rounded p-2">
            <p className="text-text-muted">Unacknowledged</p>
            <p className={`font-mono font-bold text-lg ${kpi.unacknowledged_alarms > 0 ? "text-status-warning" : "text-status-success"}`}>
              {kpi.unacknowledged_alarms}
            </p>
          </div>
          <div className="bg-bg-tertiary rounded p-2">
            <p className="text-text-muted">Chattering</p>
            <p className={`font-mono font-bold text-lg ${kpi.chattering_alarm_count > 0 ? "text-status-warning" : "text-status-success"}`}>
              {kpi.chattering_alarm_count}
            </p>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border-primary pb-0">
        {(["kpi", "chatterers", "rationalize"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs rounded-t transition-colors ${activeTab === tab ? "text-accent border-b-2 border-accent -mb-px" : "text-text-muted hover:text-text-secondary"}`}
          >
            {tab === "kpi" ? "Alarm List" : tab === "chatterers" ? "Chattering" : "Rationalization"}
          </button>
        ))}
      </div>

      {/* Alarm list */}
      {activeTab === "kpi" && (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-xs text-text-secondary border-collapse">
            <thead className="sticky top-0 bg-bg-tertiary">
              <tr className="border-b border-border-primary text-text-muted">
                <th className="text-left py-2 pr-2 font-medium">Tag</th>
                <th className="text-left py-2 pr-2 font-medium">Priority</th>
                <th className="text-left py-2 pr-2 font-medium">State</th>
                <th className="text-left py-2 pr-2 font-medium">Shelved</th>
                <th className="text-right py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {alarms.map((alarm) => (
                <tr key={alarm.id} className="border-b border-border-primary/40 hover:bg-bg-elevated/30">
                  <td className="py-1.5 pr-2 font-mono">{alarm.tag}</td>
                  <td className={`py-1.5 pr-2 ${alarm.priority === "CRITICAL" ? "text-status-alarm" : alarm.priority === "HIGH" ? "text-status-warning" : "text-text-muted"}`}>
                    {alarm.priority}
                  </td>
                  <td className="py-1.5 pr-2">{alarm.state}</td>
                  <td className="py-1.5 pr-2">{alarm.shelved ? `${alarm.shelve_reason.slice(0, 20)}…` : "—"}</td>
                  <td className="py-1.5 text-right">
                    {!alarm.shelved && alarm.state !== "CLEARED" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs py-0 px-1"
                        onClick={() => shelveAlarm(alarm.id, "CTRL-1", "Routine", 4)}
                      >
                        Shelve 4h
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Chattering */}
      {activeTab === "chatterers" && chattering && (
        <div className="space-y-2">
          {chattering.chattering_alarms.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-6">No chattering alarms detected</p>
          ) : chattering.chattering_alarms.map((alarm) => (
            <div key={alarm.tag} className="bg-bg-tertiary rounded p-2 text-xs">
              <div className="flex justify-between mb-1">
                <span className="font-mono text-text-primary">{alarm.tag}</span>
                <span className="text-status-warning">{alarm.transition_count}× in {alarm.window_minutes} min</span>
              </div>
              <p className="text-text-muted">{alarm.recommendation}</p>
            </div>
          ))}
        </div>
      )}

      {/* Rationalization DB */}
      {activeTab === "rationalize" && (
        <div className="max-h-72 overflow-y-auto space-y-2">
          {rationalization.map((alarm) => (
            <div key={alarm.id} className="bg-bg-tertiary rounded p-2.5 text-xs">
              <div className="flex justify-between mb-1.5">
                <span className="font-mono text-text-primary">{alarm.tag}</span>
                <span className={`px-1.5 rounded ${alarm.rationalization_status === "RATIONALIZED" ? "bg-status-success/20 text-status-success" : "bg-status-warning/20 text-status-warning"}`}>
                  {alarm.rationalization_status}
                </span>
              </div>
              <p className="text-text-muted">Cause: <span className="text-text-secondary">{alarm.cause}</span></p>
              <p className="text-text-muted">Action: <span className="text-text-secondary">{alarm.operator_action}</span></p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
