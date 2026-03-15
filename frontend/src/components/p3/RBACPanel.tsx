/**
 * RBAC panel — IEC 62443 role matrix and security zone diagram.
 *
 * Displays:
 * - 5 role definitions with permissions, MFA requirements, security levels
 * - IEC 62443-3-3 zone definitions with minimum access levels
 *
 * Active role is highlighted based on selectedRoleLevel in store.
 */

import { useScadaStore } from "../../store/scadaStore";
import { SCADA_COLORS } from "../../constants/scadaColors";
import { InfoButton } from "../ui/InfoButton";
import { rbacInfo } from "../../constants/panelInfo";

const ROLE_COLORS: Record<number, string> = {
  1: SCADA_COLORS.ALARM_LOW,
  2: SCADA_COLORS.DE_ENERGIZED,
  3: SCADA_COLORS.WARNING,
  4: SCADA_COLORS.ENERGIZED,
  5: SCADA_COLORS.FAULT,
};

export default function RBACPanel() {
  const { roles, zones, selectedRoleLevel } = useScadaStore();

  if (roles.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Role matrix */}
      <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
        <div className="px-4 py-2 border-b border-border-primary flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-primary">
            RBAC Role Matrix (IEC 62443)
          </h3>
          <InfoButton info={rbacInfo} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-900/50">
              <tr>
                <th className="text-left px-3 py-1.5 text-slate-500">Level</th>
                <th className="text-left px-3 py-1.5 text-slate-500">Role</th>
                <th className="text-left px-3 py-1.5 text-slate-500">SL</th>
                <th className="text-left px-3 py-1.5 text-slate-500">MFA</th>
                <th className="text-left px-3 py-1.5 text-slate-500">
                  Permissions
                </th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => {
                const isActive = role.level === selectedRoleLevel;
                const color = ROLE_COLORS[role.level] ?? SCADA_COLORS.DE_ENERGIZED;
                return (
                  <tr
                    key={role.level}
                    className={`border-b border-slate-700/50 ${
                      isActive ? "bg-slate-700/40" : "hover:bg-slate-700/20"
                    }`}
                  >
                    <td className="px-3 py-2">
                      <span
                        className="font-mono font-bold text-sm"
                        style={{ color }}
                      >
                        L{role.level}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div
                        className="font-semibold"
                        style={{ color: isActive ? color : "#cbd5e1" }}
                      >
                        {role.name}
                      </div>
                      <div className="text-slate-500 text-[10px]">
                        {role.description}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-400">
                      SL-{role.security_level}
                    </td>
                    <td className="px-3 py-2">
                      {role.mfa_required ? (
                        <span className="text-amber-400 font-bold">YES</span>
                      ) : (
                        <span className="text-slate-600">No</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.map((p) => (
                          <span
                            key={p}
                            className="bg-slate-900 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security zones */}
      {zones.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300">
              IEC 62443-3-3 Security Zones
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {zones.map((zone) => {
              const accessible = selectedRoleLevel >= zone.min_access_level;
              return (
                <div
                  key={zone.zone}
                  className="rounded border p-3"
                  style={{
                    borderColor: accessible
                      ? SCADA_COLORS.ENERGIZED
                      : SCADA_COLORS.FAULT,
                    backgroundColor: accessible
                      ? "rgba(0,255,0,0.05)"
                      : "rgba(255,0,0,0.05)",
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-bold text-slate-300">
                      {zone.zone}
                    </span>
                    <span
                      className="text-[10px] font-mono"
                      style={{
                        color: accessible
                          ? SCADA_COLORS.ENERGIZED
                          : SCADA_COLORS.FAULT,
                      }}
                    >
                      {accessible ? "ACCESS" : "DENIED"} (L
                      {zone.min_access_level}+)
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {zone.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
