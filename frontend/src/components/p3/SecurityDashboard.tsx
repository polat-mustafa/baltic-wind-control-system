/**
 * Cybersecurity — IEC 62443-3-3 zones & conduits, requirement checklist and
 * an educational attack walk-through (M07).
 *
 * Zones follow the Purdue levels (L0 process … L5 external); every conduit
 * between zones is listed with its protocols and protection. The checklist
 * shows each system requirement (SR) with evidence, so the SL scores are
 * traceable instead of a bare percentage. Target: SL-2 for the OT zones.
 */

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

import { useSecurityStore } from "../../store/securityStore";
import AttackSimPanel from "./AttackSimPanel";
import { cn } from "../../lib/utils";

const Pill = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
  <span
    className={cn(
      "inline-block px-1.5 rounded-sm text-xs font-mono font-bold",
      ok ? "border border-border-secondary text-text-secondary" : "bg-status-alarm text-bg-primary",
    )}
  >
    {children}
  </span>
);

export default function SecurityDashboard() {
  const zones = useSecurityStore((s) => s.zones);
  const conduits = useSecurityStore((s) => s.conduits);
  const compliance = useSecurityStore((s) => s.compliance);
  const loading = useSecurityStore((s) => s.loading);
  const error = useSecurityStore((s) => s.error);
  const fetchAll = useSecurityStore((s) => s.fetchAll);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const zoneLevel = new Map((zones?.zones ?? []).map((z) => [z.name, z.level]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold text-text-primary">Cybersecurity · IEC 62443-3-3 · target SL-2</h3>
        {compliance && <span className="text-xs text-text-secondary">{compliance.overall_assessment}</span>}
        <span className="flex-1" />
        <button type="button" onClick={() => void fetchAll()} className="flex items-center gap-1 h-6 px-2 rounded border border-border-primary text-xs text-text-secondary hover:bg-bg-hover">
          <RefreshCw size={11} className={loading ? "animate-spin" : undefined} /> Refresh
        </button>
      </div>
      {error && <p className="text-xs text-status-warning">{error}</p>}

      {compliance && (
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["SL-1", compliance.sl1_score_pct],
              ["SL-2 (target)", compliance.sl2_score_pct],
              ["SL-3", compliance.sl3_score_pct],
            ] as const
          ).map(([label, pct]) => (
            <div key={label} className="rounded-lg border border-border-primary bg-bg-secondary p-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-text-muted">{label} requirements met</span>
                <span className="text-base font-mono font-semibold text-text-primary">{pct.toFixed(0)} %</span>
              </div>
              <div className="h-2 mt-1 rounded bg-bg-tertiary overflow-hidden">
                <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {zones && (
          <section className="rounded-lg border border-border-primary bg-bg-secondary p-3">
            <h4 className="text-xs font-semibold text-text-primary mb-1">Zones (Purdue levels)</h4>
            <table className="w-full text-xs">
              <thead className="text-left text-text-muted">
                <tr>
                  <th className="py-1 pr-2 font-medium">Level</th>
                  <th className="py-1 pr-2 font-medium">Zone</th>
                  <th className="py-1 pr-2 font-medium text-right">Assets</th>
                  <th className="py-1 font-medium whitespace-nowrap">SL-T</th>
                </tr>
              </thead>
              <tbody>
                {[...zones.zones]
                  .sort((a, b) => a.level - b.level)
                  .map((z) => (
                    <tr key={z.id} className="border-t border-border-primary/60" title={z.description}>
                      <td className="py-1 pr-2 font-mono text-text-muted">L{z.level}</td>
                      <td className="py-1 pr-2 text-text-primary">
                        {z.name.replace(/_/g, " ").toLowerCase()}
                        <div className="text-text-muted">{z.description}</div>
                      </td>
                      <td className="py-1 pr-2 font-mono text-right text-text-secondary">{z.device_count}</td>
                      <td className="py-1 font-mono text-text-secondary whitespace-nowrap">{z.security_level_target}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        )}

        {conduits && (
          <section className="rounded-lg border border-border-primary bg-bg-secondary p-3">
            <h4 className="text-xs font-semibold text-text-primary mb-1">
              Conduits <span className="font-normal text-text-muted">({conduits.total_conduits}, {conduits.unencrypted_count} unencrypted)</span>
            </h4>
            <table className="w-full text-xs">
              <thead className="text-left text-text-muted">
                <tr>
                  <th className="py-1 pr-2 font-medium">From → to</th>
                  <th className="py-1 pr-2 font-medium">Protocols</th>
                  <th className="py-1 pr-2 font-medium">Protection</th>
                  <th className="py-1 font-medium">Criticality</th>
                </tr>
              </thead>
              <tbody>
                {conduits.conduits.map((c) => {
                  // Purdue rule: control levels (L0-L2) never talk directly to L4/L5
                  const lv = [zoneLevel.get(c.source_zone) ?? 0, zoneLevel.get(c.dest_zone) ?? 0];
                  const skip = Math.min(...lv) <= 2 && Math.max(...lv) >= 4;
                  return (
                    <tr key={c.id} className="border-t border-border-primary/60 align-top">
                      <td className="py-1 pr-2 font-mono text-text-primary whitespace-nowrap">
                        L{zoneLevel.get(c.source_zone)} → L{zoneLevel.get(c.dest_zone)} {c.bidirectional ? "⇄" : "→"}
                        <div className="font-sans text-text-muted">{c.name}</div>
                        {skip && <Pill ok={false}>bypasses the DMZ</Pill>}
                      </td>
                      <td className="py-1 pr-2 text-text-secondary">{c.allowed_protocols.join(", ")}</td>
                      <td className="py-1 pr-2">
                        {c.encryption === "NONE" ? <Pill ok={false}>none</Pill> : <span className="text-text-secondary">{c.encryption}</span>}
                      </td>
                      <td className="py-1 font-mono text-text-secondary">{c.criticality.toLowerCase()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-xs text-text-muted mt-1">
              "None" is acceptable only inside a physically secured zone (hard-wired process level); it is listed so the
              exception stays visible.
            </p>
          </section>
        )}
      </div>

      {compliance && (
        <section className="rounded-lg border border-border-primary bg-bg-secondary p-3">
          <h4 className="text-xs font-semibold text-text-primary mb-1">
            System requirements · {compliance.open_gaps} open gaps
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-text-muted">
                <tr>
                  <th className="py-1 pr-2 font-medium">SR</th>
                  <th className="py-1 pr-2 font-medium">SL</th>
                  <th className="py-1 pr-2 font-medium">Requirement</th>
                  <th className="py-1 pr-2 font-medium">Evidence</th>
                  <th className="py-1 pr-2 font-medium text-right">Risk</th>
                  <th className="py-1 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {[...compliance.checks]
                  .sort((a, b) => Number(a.compliant) - Number(b.compliant) || b.risk_score - a.risk_score)
                  .map((r) => (
                    <tr key={r.requirement_id} className="border-t border-border-primary/60 align-top">
                      <td className="py-1 pr-2 font-mono text-text-primary">{r.requirement_id}</td>
                      <td className="py-1 pr-2 font-mono text-text-muted">{r.security_level}</td>
                      <td className="py-1 pr-2 text-text-primary">
                        {r.description}
                        <div className="text-text-muted">{r.category}</div>
                      </td>
                      <td className="py-1 pr-2 text-text-secondary">{r.evidence ?? "—"}</td>
                      <td className="py-1 pr-2 font-mono text-right text-text-secondary">{r.risk_score.toFixed(1)}</td>
                      <td className="py-1">
                        <Pill ok={r.compliant}>{r.compliant ? "met" : "GAP"}</Pill>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-border-primary bg-bg-secondary p-3">
        <h4 className="text-xs font-semibold text-text-primary mb-2">Attack walk-through (educational)</h4>
        <AttackSimPanel />
      </section>
    </div>
  );
}
