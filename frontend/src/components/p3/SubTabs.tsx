/**
 * Level-3 sub-tab strip — context-dependent on the active Level-2 area.
 *
 * Operations:  Mimic · SLD · Alarms · Event Log · Permits · Bay Control
 * Equipment:   Condition Monitoring · Vibration · Historian
 * Diagnostics: GOOSE Protection · SOE Recorder · Interlocks · Comms Network
 * Engineering: RBAC · Cybersecurity · OPC UA · SCL Generator · Alarm Rationalisation
 */

import {
  AlertTriangle,
  Bell,
  Database,
  FileCode,
  FileText,
  GitBranch,
  LayoutGrid,
  Layers,
  List,
  Lock,
  Network,
  ScrollText,
  Server,
  Shield,
  ShieldAlert,
  Stethoscope,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";

import {
  useScadaStore,
  type ScadaArea,
  type ScadaSubTab,
} from "../../store/scadaStore";
import { cn } from "../../lib/utils";

interface SubTabDef {
  id: ScadaSubTab;
  label: string;
  icon: LucideIcon;
}

const SUB_TABS: Record<ScadaArea, readonly SubTabDef[]> = {
  operations: [
    { id: "mimic",   label: "Plant Mimic", icon: LayoutGrid },
    { id: "sld",     label: "Single-Line", icon: GitBranch },
    { id: "alarms",  label: "Alarms",      icon: Bell },
    { id: "events",  label: "Event Log",   icon: ScrollText },
    { id: "permits", label: "Permits",     icon: FileText },
    { id: "bays",    label: "Bay Control", icon: Layers },
  ],
  equipment: [
    { id: "cms",       label: "Condition Mon.", icon: Stethoscope },
    { id: "vibration", label: "Vibration",      icon: Waves },
    { id: "historian", label: "Historian",      icon: Database },
  ],
  diagnostics: [
    { id: "goose",      label: "GOOSE Protection", icon: Zap },
    { id: "soe",        label: "SOE Recorder",     icon: List },
    { id: "interlocks", label: "Interlocks",       icon: Lock },
    { id: "network",    label: "Comms Network",    icon: Network },
  ],
  engineering: [
    { id: "rbac",     label: "RBAC",              icon: Shield },
    { id: "security", label: "Cybersecurity",     icon: ShieldAlert },
    { id: "opcua",    label: "OPC UA",            icon: Server },
    { id: "scl",      label: "SCL Generator",     icon: FileCode },
    { id: "almrat",   label: "Alarm Rationalisation", icon: AlertTriangle },
  ],
} as const;


export default function SubTabs() {
  const area = useScadaStore((s) => s.area);
  const subTabs = useScadaStore((s) => s.subTabs);
  const setSubTab = useScadaStore((s) => s.setSubTab);

  const tabs = SUB_TABS[area];
  const active = subTabs[area];

  return (
    <div className="flex items-center border-b border-border-primary bg-bg-secondary px-2 overflow-x-auto">
      {tabs.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(area, id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs font-medium",
              "border-b-2 -mb-px whitespace-nowrap shrink-0 transition-colors",
              isActive
                ? "text-accent border-accent"
                : "text-text-muted border-transparent hover:text-text-secondary",
            )}
          >
            <Icon size={12} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
