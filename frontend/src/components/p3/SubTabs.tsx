/**
 * Level-3 sub-tab strip — context-dependent on the active Level-2 area.
 *
 * Operations:  SLD · Alarms · Permits · Events · Bay Control
 * Equipment:   CMS · Vibration · Historian · Network · Interlocks
 * Diagnostics: GOOSE Sim · SOE · Latency · Fleet Health · Attack Sim
 * Engineering: RBAC · Security · OPC-UA · SCL Gen · Alarm Rationalization
 */

import {
  Activity,
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
  Timer,
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
    { id: "permits", label: "Permits",     icon: FileText },
    { id: "events",  label: "Event Log",   icon: ScrollText },
    { id: "bays",    label: "Bay Control", icon: Layers },
  ],
  equipment: [
    { id: "cms",        label: "Condition Mon.", icon: Stethoscope },
    { id: "vibration",  label: "Vibration",      icon: Waves },
    { id: "historian",  label: "Historian",      icon: Database },
    { id: "network",    label: "Network",        icon: Network },
    { id: "interlocks", label: "Interlocks",     icon: Lock },
  ],
  diagnostics: [
    { id: "goose",   label: "GOOSE Sim",     icon: Zap },
    { id: "soe",     label: "SOE Recorder",  icon: List },
    { id: "latency", label: "Latency Budget", icon: Timer },
    { id: "fleet",   label: "Fleet Health",  icon: Activity },
    { id: "attack",  label: "Attack Sim",    icon: ShieldAlert },
  ],
  engineering: [
    { id: "rbac",     label: "RBAC",        icon: Shield },
    { id: "security", label: "Security",    icon: Lock },
    { id: "opcua",    label: "OPC-UA",      icon: Server },
    { id: "scl",      label: "SCL Gen",     icon: FileCode },
    { id: "almrat",   label: "Alarm Rat.",  icon: AlertTriangle },
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
