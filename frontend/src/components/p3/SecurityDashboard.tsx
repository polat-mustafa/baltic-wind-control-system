/**
 * Cybersecurity Dashboard — M07 (IEC 62443).
 *
 * Two sections:
 *   Top: Purdue Model zones table + compliance score gauge + conduits summary.
 *   Bottom: Attack simulation panel.
 *
 * Target: IEC 62443-3-3 SL-2 for OT zones.
 * Open gaps: SR-1.7 (MFA) and SR-3.1 (GOOSE integrity).
 */

import { useEffect } from "react";
import { Shield, AlertTriangle } from "lucide-react";

import { useSecurityStore } from "../../store/securityStore";
import { Button } from "../ui/Button";
import AttackSimPanel from "./AttackSimPanel";

export default function SecurityDashboard() {
  const { zones, conduits, compliance, loading, error, fetchAll, clearError } = useSecurityStore();

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-text-muted text-sm">
        <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin mr-2" />
        Loading security posture…
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
          <Shield size={16} className="text-accent" />
          <span className="text-sm font-semibold text-text-primary">Cybersecurity — IEC 62443-3-3 SL-2</span>
        </div>
        <Button size="sm" onClick={fetchAll}>Refresh</Button>
      </div>

      {/* Zones + compliance */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Purdue Model zones */}
        {zones && (
          <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
            <h3 className="text-sm font-semibold text-text-primary mb-2">Purdue Model Zones</h3>
            <p className="text-xs text-text-muted mb-3">{zones.ot_it_boundary}</p>
            <div className="space-y-1.5">
              {zones.zones.map((zone) => (
                <div key={zone.id} className="flex items-center gap-3 p-2 rounded text-xs" style={{ backgroundColor: `${zone.color}10`, borderLeft: `2px solid ${zone.color}` }}>
                  <span className="font-mono text-text-muted w-6">L{zone.level}</span>
                  <span className="text-text-primary font-medium flex-1">{zone.name}</span>
                  <span className="text-text-muted">{zone.device_count} devices</span>
                  <span className="font-mono" style={{ color: zone.color }}>{zone.security_level_target}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Compliance */}
        {compliance && (
          <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-text-primary">IEC 62443 Compliance</h3>
              <span className="text-xs text-text-muted">{compliance.standard}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
              {[
                { label: "SL-1", value: compliance.sl1_score_pct },
                { label: "SL-2 (target)", value: compliance.sl2_score_pct },
                { label: "SL-3", value: compliance.sl3_score_pct },
              ].map(({ label, value }) => (
                <div key={label} className="bg-bg-tertiary rounded p-2">
                  <p className="text-text-muted">{label}</p>
                  <p className={`font-mono font-bold text-lg ${value >= 80 ? "text-status-success" : value >= 60 ? "text-status-warning" : "text-status-alarm"}`}>
                    {value.toFixed(0)}%
                  </p>
                </div>
              ))}
            </div>
            <div className="text-xs space-y-1">
              <p className="text-text-muted">{compliance.open_gaps} open gaps — Critical:</p>
              {compliance.critical_gaps.map((gap, i) => (
                <p key={i} className="text-status-alarm pl-2">• {gap}</p>
              ))}
            </div>
            <p className="mt-2 text-xs text-text-muted">{compliance.overall_assessment}</p>
          </div>
        )}
      </div>

      {/* Conduits summary */}
      {conduits && (
        <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-text-primary">Security Conduits ({conduits.total_conduits})</h3>
            {conduits.unencrypted_count > 0 && (
              <span className="text-xs text-status-warning">{conduits.unencrypted_count} unencrypted</span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {conduits.conduits.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs bg-bg-tertiary rounded p-2">
                <span className="text-text-muted font-mono">{c.source_zone}</span>
                <span className="text-text-muted">→</span>
                <span className="text-text-primary">{c.dest_zone}</span>
                <span className="ml-auto flex items-center gap-1">
                  {c.encryption ? <span className="text-status-success">🔒</span> : <span className="text-status-warning">⚠</span>}
                  <span className={`px-1 rounded ${c.criticality === "HIGH" ? "text-status-alarm" : "text-text-muted"}`}>{c.criticality}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attack simulator */}
      <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Attack Scenario Simulator (Educational)</h3>
        <AttackSimPanel />
      </div>
    </div>
  );
}
