/**
 * Protection Relay Coordination Dashboard — M05.
 *
 * Three-panel layout:
 *   Left: Relay configuration table
 *   Right: TCC log-log overlay (Plotly)
 *   Bottom: Selectivity grading table + fault clearance results
 *
 * Standards: IEC 60255 (relay), IEC 60909 (short-circuit), PSE coordination rules.
 */

import { useEffect } from "react";
import { ShieldAlert, Play, AlertTriangle } from "lucide-react";

import { useProtectionStore } from "../../store/protectionStore";
import { Button } from "../ui/Button";
import TCCCurvePlot from "./TCCCurvePlot";
import RelayCoordinationTable from "./RelayCoordinationTable";
import { InfoButton } from "../ui/InfoButton";
import { protectionDashboardInfo, tccCurveInfo, relayCoordinationInfo } from "../../constants/panelInfo";

const FAULT_LOCATIONS = [
  { value: "WTG_ARRAY", label: "WTG Array (66 kV)" },
  { value: "OSS_BUSBAR", label: "OSS Busbar (66 kV)" },
  { value: "EXPORT_CABLE", label: "Export Cable (220 kV)" },
  { value: "ONSHORE_SUB", label: "Onshore Substation (220 kV)" },
];

export default function ProtectionDashboard() {
  const {
    relays,
    coordinationResult,
    faultLocation,
    faultCurrentKA,
    loading,
    studyLoading,
    error,
    fetchRelays,
    runCoordinationStudy,
    setFaultLocation,
    setFaultCurrentKA,
    clearError,
  } = useProtectionStore();

  useEffect(() => {
    fetchRelays();
  }, [fetchRelays]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin mr-2" />
        Loading relay configuration…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-status-alarm/10 border border-status-alarm/30 rounded-lg text-sm flex justify-between items-center">
          <span className="text-status-alarm flex items-center gap-2">
            <AlertTriangle size={14} /> {error}
          </span>
          <Button variant="ghost" size="sm" onClick={clearError}>Dismiss</Button>
        </div>
      )}

      {/* Controls row */}
      <div className="flex items-center gap-3 flex-wrap bg-bg-secondary rounded-lg border border-border-primary p-3">
        <ShieldAlert size={16} className="text-accent shrink-0" />
        <InfoButton info={protectionDashboardInfo} />
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-muted">Fault location:</label>
          <select
            className="text-xs bg-bg-tertiary border border-border-primary rounded px-2 py-1 text-text-secondary"
            value={faultLocation}
            onChange={(e) => setFaultLocation(e.target.value)}
          >
            {FAULT_LOCATIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-muted">Fault current (kA):</label>
          <input
            type="number"
            min={1}
            max={40}
            step={0.5}
            value={faultCurrentKA}
            onChange={(e) => setFaultCurrentKA(parseFloat(e.target.value))}
            className="w-20 text-xs bg-bg-tertiary border border-border-primary rounded px-2 py-1 text-text-secondary font-mono"
          />
        </div>
        <Button size="sm" onClick={runCoordinationStudy} disabled={studyLoading}>
          {studyLoading ? (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Running…
            </span>
          ) : (
            <span className="flex items-center gap-1.5"><Play size={12} /> Run Study</span>
          )}
        </Button>
      </div>

      {/* Main content: relay table (left) + TCC plot (right) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Relay list */}
        <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">Relay Configuration</h3>
            <InfoButton info={relayCoordinationInfo} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-text-secondary border-collapse">
              <thead>
                <tr className="border-b border-border-primary text-text-muted">
                  <th className="text-left py-2 pr-2 font-medium">Location</th>
                  <th className="text-left py-2 pr-2 font-medium">Type</th>
                  <th className="text-right py-2 pr-2 font-medium">Pickup</th>
                  <th className="text-right py-2 pr-2 font-medium">TMS</th>
                  <th className="text-right py-2 font-medium">Delay (s)</th>
                </tr>
              </thead>
              <tbody>
                {relays.map((r) => (
                  <tr key={r.id} className="border-b border-border-primary/50 hover:bg-bg-elevated/30">
                    <td className="py-1.5 pr-2 font-mono text-text-primary">{r.location}</td>
                    <td className="py-1.5 pr-2">{r.relay_type}</td>
                    <td className="py-1.5 pr-2 text-right font-mono">
                      {r.pickup_value} {r.pickup_unit}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono">{r.tms?.toFixed(2) ?? "—"}</td>
                    <td className="py-1.5 text-right font-mono">{r.time_delay_s.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* TCC log-log plot */}
        <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-text-primary">TCC Overlay (IEC 60255)</h3>
            <InfoButton info={tccCurveInfo} />
          </div>
          <TCCCurvePlot />
        </div>
      </div>

      {/* Selectivity grading table */}
      {coordinationResult && (
        <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">
              Selectivity Grading — {coordinationResult.fault_location} @ {coordinationResult.fault_current_ka.toFixed(1)} kA
            </h3>
            <InfoButton info={relayCoordinationInfo} />
          </div>
          <RelayCoordinationTable />
          {coordinationResult.assessment && (
            <p className="mt-3 text-xs text-text-muted bg-bg-tertiary rounded p-2">
              {coordinationResult.assessment}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
