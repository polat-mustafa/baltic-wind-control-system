/**
 * Level-2 navigation per ISA-101 four-level display hierarchy.
 *
 * Operations  — operator's primary surface (SLD, alarms, permits, events)
 * Equipment   — asset health (CMS, vibration, historian, network)
 * Diagnostics — protection + comms diagnostics (GOOSE, SOE, latency)
 * Engineering — admin (RBAC, security, OPC-UA, SCL gen, alarm rationalization)
 */

import {
  Activity,
  Cpu,
  ScanSearch,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { useScadaStore, type ScadaArea } from "../../store/scadaStore";
import { cn } from "../../lib/utils";

interface AreaDef {
  id: ScadaArea;
  label: string;
  icon: LucideIcon;
}

const AREAS: AreaDef[] = [
  { id: "operations",  label: "Operations",  icon: Activity },
  { id: "equipment",   label: "Equipment",   icon: Cpu },
  { id: "diagnostics", label: "Diagnostics", icon: ScanSearch },
  { id: "engineering", label: "Engineering", icon: Wrench },
];

export default function AreaTabs() {
  const area = useScadaStore((s) => s.area);
  const setArea = useScadaStore((s) => s.setArea);

  return (
    <div className="flex items-stretch border-b border-border-primary bg-bg-tertiary">
      {AREAS.map(({ id, label, icon: Icon }) => {
        const isActive = area === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setArea(id)}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider",
              "border-b-2 -mb-px transition-colors",
              isActive
                ? "text-accent border-accent bg-bg-secondary"
                : "text-text-secondary border-transparent hover:text-text-primary hover:bg-bg-elevated/40",
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
