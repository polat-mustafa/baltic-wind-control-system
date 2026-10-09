/**
 * Role-based access control — IEC 62351-8 roles, enforced on the SCADA
 * actions (switchgear control needs L2, permit approval L3 …).
 *
 * Permission matrix: one row per permission, one column per role; the role
 * selected in the toolbar is highlighted. Below: the minimum role level per
 * IEC 62443 access zone.
 */

import { Check } from "lucide-react";

import { useScadaStore } from "../../store/scadaStore";
import { InfoButton } from "../ui/InfoButton";
import { rbacInfo } from "../../constants/panelInfo";
import { cn } from "../../lib/utils";

export default function RBACPanel() {
  const roles = useScadaStore((s) => s.roles);
  const zones = useScadaStore((s) => s.zones);
  const active = useScadaStore((s) => s.selectedRoleLevel);

  if (roles.length === 0) return null;
  const sorted = [...roles].sort((a, b) => a.level - b.level);
  const permissions = [...new Set(sorted.flatMap((r) => r.permissions))].sort();
  const col = (level: number) => (level === active ? "bg-accent/10" : undefined);

  return (
    <div className="space-y-3">
      <section className="bg-bg-secondary rounded-lg border border-border-primary p-3">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-xs font-semibold text-text-primary">RBAC permission matrix · IEC 62351-8 / IEC 62443</h3>
          <InfoButton info={rbacInfo} />
          <span className="text-xs text-text-muted">acting role highlighted — change it in the toolbar</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-text-muted align-bottom">
                <th className="py-1 pr-3 font-medium">Permission</th>
                {sorted.map((r) => (
                  <th key={r.level} className={cn("py-1 px-2 font-medium text-center", col(r.level))} title={r.description}>
                    <div className="font-mono text-text-primary">L{r.level}</div>
                    <div className="text-text-secondary">{r.name}</div>
                    <div className="font-normal">
                      SL-{r.security_level} · MFA {r.mfa_required ? "YES" : "no"}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((p) => (
                <tr key={p} className="border-t border-border-primary/60">
                  <td className="py-1 pr-3 font-mono text-text-primary">{p}</td>
                  {sorted.map((r) => (
                    <td key={r.level} className={cn("py-1 px-2 text-center", col(r.level))}>
                      {r.permissions.includes(p) ? <Check size={13} className="inline text-text-primary" aria-label="granted" /> : <span className="text-text-muted">·</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-xs text-text-secondary">
          {sorted.map((r) => (
            <li key={r.level}>
              <b className="font-mono text-text-primary">L{r.level} {r.name}</b> — {r.description}
            </li>
          ))}
        </ul>
      </section>

      {zones.length > 0 && (
        <section className="bg-bg-secondary rounded-lg border border-border-primary p-3">
          <h4 className="text-xs font-semibold text-text-primary mb-1">Access zones · minimum role</h4>
          <table className="w-full text-xs">
            <tbody>
              {[...zones]
                .sort((a, b) => b.min_access_level - a.min_access_level)
                .map((z) => (
                  <tr key={z.zone} className="border-t border-border-primary/60">
                    <td className="py-1 pr-3 font-mono text-text-primary whitespace-nowrap">{z.zone}</td>
                    <td className="py-1 pr-3 font-mono whitespace-nowrap text-text-secondary">≥ L{z.min_access_level}</td>
                    <td className="py-1 text-text-secondary">{z.description}</td>
                    <td className="py-1 pl-2 text-right whitespace-nowrap font-mono">
                      {active >= z.min_access_level ? <span className="text-text-secondary">access</span> : <span className="text-text-muted">denied</span>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
