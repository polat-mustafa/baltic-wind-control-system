/**
 * Condition Monitoring System Dashboard — M12.
 *
 * Layout:
 *   Top: Fleet health heatmap (34 turbines, click to select)
 *   Bottom: Selected turbine component detail (vibration FFT + oil analysis)
 *
 * CMS components: main bearing, gearbox, generator, pitch/yaw, transformer, converter.
 * RUL (Remaining Useful Life) tracked per component.
 */

import { useEffect } from "react";
import { Activity, AlertTriangle } from "lucide-react";

import { useCMSStore } from "../../store/cmsStore";
import { Button } from "../ui/Button";
import FleetHealthPanel from "./FleetHealthPanel";
import VibrationPanel from "./VibrationPanel";

export default function CMSDashboard() {
  const {
    turbineHealth,
    oilAnalysis,
    alerts,
    loading,
    error,
    fetchFleetHealth,
    clearError,
  } = useCMSStore();

  useEffect(() => {
    fetchFleetHealth();
  }, [fetchFleetHealth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin mr-2" />
        Loading CMS fleet data…
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
          <Activity size={16} className="text-accent" />
          <span className="text-sm font-semibold text-text-primary">Condition Monitoring — 34 × V236-15.0 MW</span>
        </div>
        <div className="flex gap-2">
          {alerts.length > 0 && (
            <span className="text-xs text-status-alarm px-2 py-1 bg-status-alarm/10 rounded">
              {alerts.length} active alerts
            </span>
          )}
          <Button size="sm" onClick={fetchFleetHealth} disabled={loading}>Refresh</Button>
        </div>
      </div>

      {/* Fleet health heatmap */}
      <FleetHealthPanel />

      {/* Selected turbine detail */}
      {turbineHealth && (
        <div className="space-y-3">
          <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text-primary">
                {turbineHealth.turbine_id} — Component Detail
              </h3>
              <span className={`text-xs px-2 py-0.5 rounded ${turbineHealth.overall_alert_level === "NORMAL" ? "bg-status-success/20 text-status-success" : turbineHealth.overall_alert_level === "WARNING" ? "bg-status-warning/20 text-status-warning" : "bg-status-alarm/20 text-status-alarm"}`}>
                HI {turbineHealth.overall_health_index.toFixed(0)} — {turbineHealth.overall_alert_level}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              {turbineHealth.components.map((c) => (
                <div key={c.component} className={`rounded p-2 ${c.alert_level === "CRITICAL" ? "bg-status-alarm/10 border border-status-alarm/20" : c.alert_level === "ALARM" ? "bg-status-alarm/5" : c.alert_level === "WARNING" ? "bg-status-warning/5" : "bg-bg-tertiary"}`}>
                  <p className="text-text-muted truncate">{c.component.replace(/_/g, " ")}</p>
                  <p className={`font-mono font-bold ${c.alert_level === "NORMAL" ? "text-status-success" : c.alert_level === "WARNING" ? "text-status-warning" : "text-status-alarm"}`}>
                    HI {c.health_index.toFixed(0)}
                  </p>
                  <p className="text-text-muted">RUL: {c.rul_days}d</p>
                  <p className="text-text-muted">{c.vib_rms_mm_s.toFixed(2)} mm/s</p>
                </div>
              ))}
            </div>
          </div>

          {/* Vibration FFT */}
          <VibrationPanel />

          {/* Oil analysis */}
          {oilAnalysis && (
            <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-text-primary">Gearbox Oil Analysis</h3>
                <div className="flex gap-3 text-xs">
                  <span className="text-text-muted">ISO: <span className="font-mono text-text-primary">{oilAnalysis.current_iso_code}</span></span>
                  <span className="text-text-muted">Target: <span className="font-mono text-text-primary">{oilAnalysis.target_iso_code}</span></span>
                  {oilAnalysis.water_ingress_alert && <span className="text-status-alarm">⚠ Water ingress</span>}
                </div>
              </div>
              <p className="text-xs text-text-muted">{oilAnalysis.next_oil_change_recommendation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
