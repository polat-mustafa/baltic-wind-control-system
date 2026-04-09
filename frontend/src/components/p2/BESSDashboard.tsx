/**
 * BESS Integration Dashboard — M08.
 *
 * Three sections:
 *   1. Status (SOC gauge + KPIs) + Ramp smoothing button
 *   2. FCR/FFR frequency response simulation
 *   3. 20-year degradation projection
 *
 * Spec: 50 MW / 200 MWh LFP, C-rate 0.25, SOC 10-90%.
 */

import { useEffect } from "react";
import { Battery, AlertTriangle } from "lucide-react";

import { useBESSStore } from "../../store/bessStore";
import { Button } from "../ui/Button";
import BESSStatusPanel from "./BESSStatusPanel";
import BESSFrequencyPanel from "./BESSFrequencyPanel";
import BESSDegradationPanel from "./BESSDegradationPanel";
import { InfoButton } from "../ui/InfoButton";
import { bessDashboardInfo } from "../../constants/panelInfo";

export default function BESSDashboard() {
  const { rampResult, loading, simLoading, error, fetchStatus, simRampSmoothing, clearError } = useBESSStore();

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin mr-2" />
        Loading BESS status…
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
          <Battery size={16} className="text-accent" />
          <span className="text-sm font-semibold text-text-primary">BESS — 50 MW / 200 MWh LFP</span>
          <InfoButton info={bessDashboardInfo} />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={simRampSmoothing} disabled={simLoading}>
            {simLoading ? "Running…" : "Ramp smoothing"}
          </Button>
          <Button size="sm" onClick={fetchStatus} disabled={loading}>Refresh</Button>
        </div>
      </div>

      {/* Top row: status */}
      <BESSStatusPanel />

      {/* Ramp smoothing result (if run) */}
      {rampResult && (
        <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
          <h3 className="text-sm font-semibold text-text-primary mb-2">Ramp Smoothing Result</h3>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="bg-bg-tertiary rounded p-2">
              <p className="text-text-muted">Violations before</p>
              <p className="font-mono font-bold text-status-alarm">{rampResult.ramp_violations_before}</p>
            </div>
            <div className="bg-bg-tertiary rounded p-2">
              <p className="text-text-muted">Violations after</p>
              <p className="font-mono font-bold text-status-success">{rampResult.ramp_violations_after}</p>
            </div>
            <div className="bg-bg-tertiary rounded p-2">
              <p className="text-text-muted">Peak charge</p>
              <p className="font-mono font-bold text-text-primary">{rampResult.peak_bess_charge_mw.toFixed(1)} MW</p>
            </div>
            <div className="bg-bg-tertiary rounded p-2">
              <p className="text-text-muted">Peak discharge</p>
              <p className="font-mono font-bold text-text-primary">{rampResult.peak_bess_discharge_mw.toFixed(1)} MW</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-text-muted">{rampResult.assessment}</p>
        </div>
      )}

      {/* Frequency response + degradation */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <BESSFrequencyPanel />
        <BESSDegradationPanel />
      </div>
    </div>
  );
}
