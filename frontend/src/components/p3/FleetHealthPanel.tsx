/**
 * Fleet health matrix — 5 monitored components × every turbine of the farm (CMS, M12).
 *
 * ISA-101: healthy cells stay neutral; colour appears only as the health
 * index leaves the GREEN band (YELLOW < 80, AMBER < 60, RED < 40,
 * CRITICAL < 20). Each cell carries its number, so colour is never the only
 * cue. Click a column to open that turbine.
 */

import type { CMSAlertLevel } from "../../types/cms";
import { useCMSStore } from "../../store/cmsStore";
import { CMS_COMPONENTS, LEVEL_STYLE, hiLevel } from "../../constants/cmsLevels";
import { cn } from "../../lib/utils";

export default function FleetHealthPanel() {
  const fleet = useCMSStore((s) => s.fleetHealth);
  const selected = useCMSStore((s) => s.selectedTurbineId);
  const select = useCMSStore((s) => s.fetchTurbineDetail);

  if (!fleet) return null;

  return (
    <section className="bg-bg-secondary rounded-lg border border-border-primary p-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-2">
        <h3 className="text-xs font-semibold text-text-primary">Fleet health index · {fleet.turbines.length} × 15 MW</h3>
        <span className="text-xs font-mono text-text-muted">
          fleet mean {fleet.fleet_average_hi.toFixed(0)} · {fleet.turbines_in_alert} amber · {fleet.turbines_in_warning} red/critical
        </span>
        <span className="flex-1" />
        <span className="flex flex-wrap gap-2 text-xs text-text-muted">
          {(Object.keys(LEVEL_STYLE) as CMSAlertLevel[]).map((l) => (
            <span key={l} className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm border border-border-secondary" style={{ background: LEVEL_STYLE[l].bg }} />
              {LEVEL_STYLE[l].label}
            </span>
          ))}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0.5 text-xs font-mono">
          <thead>
            <tr>
              <th />
              {fleet.turbines.map((t) => (
                <th key={t.turbine_id} className="px-0 font-normal">
                  <button
                    type="button"
                    onClick={() => void select(t.turbine_id)}
                    className={cn("w-7 rounded-sm", selected === t.turbine_id ? "bg-accent text-accent-ink" : "text-text-muted hover:text-text-primary")}
                    title={`Open ${t.turbine_id}`}
                  >
                    {t.turbine_id.slice(4)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CMS_COMPONENTS.map((c) => (
              <tr key={c.id}>
                <th className="pr-2 text-left font-sans font-normal text-xs text-text-secondary whitespace-nowrap">{c.label}</th>
                {fleet.turbines.map((t) => {
                  const hi = t.component_health[c.id];
                  const st = LEVEL_STYLE[hiLevel(hi)];
                  return (
                    <td key={t.turbine_id} className="p-0">
                      <button
                        type="button"
                        onClick={() => void select(t.turbine_id)}
                        title={`${t.turbine_id} ${c.label}: HI ${hi.toFixed(1)}`}
                        className={cn(
                          "w-7 h-6 rounded-sm border tabular-nums",
                          selected === t.turbine_id ? "border-accent" : "border-border-primary",
                        )}
                        style={{ background: st.bg, color: st.fg }}
                      >
                        {hi.toFixed(0)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
