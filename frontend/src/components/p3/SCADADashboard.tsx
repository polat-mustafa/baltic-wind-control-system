/**
 * SCADA dashboard — professional layout with always-visible SLD + alarms.
 *
 * Layout:
 * ┌──────────────────────────────────┬─────────────────────────┐
 * │   Substation SLD (interactive)   │  Alarm Table (ISA-18.2) │
 * │   Live breaker states            │  Filterable, sortable   │
 * │   Fault zone highlighting        │  ACK/Shelve controls    │
 * ├──────────────────────────────────┴─────────────────────────┤
 * │  Tabs (12 total):                                          │
 * │  GOOSE Sim · Event Log · Permits · RBAC · Historian        │
 * │  Bays · SOE · OPC-UA · Security · Alarm KPI · CMS · Network│
 * └────────────────────────────────────────────────────────────┘
 */

import { useState } from "react";
import {
  Activity,
  Bell,
  Database,
  FileText,
  GitBranch,
  List,
  Lock,
  Network,
  ScrollText,
  Server,
  Shield,
  Zap,
} from "lucide-react";

import { useScadaStore } from "../../store/scadaStore";
import SubstationSLD from "./SubstationSLD";
import AlarmListPanel from "./AlarmListPanel";
import GOOSESimPanel from "./GOOSESimPanel";
import EventLogPanel from "./EventLogPanel";
import HistorianPanel from "./HistorianPanel";
import PermitWorkflowPanel from "./PermitWorkflowPanel";
import RBACPanel from "./RBACPanel";
// M01 — Bay Controller
import BayControllerPanel from "./BayControllerPanel";
// M02 — SOE Recorder
import SOERecorderPanel from "./SOERecorderPanel";
// M03 — OPC-UA
import OPCUAPanel from "./OPCUAPanel";
// M07 — Cybersecurity
import SecurityDashboard from "./SecurityDashboard";
// M09 — Alarm Rationalization
import AlarmRationalizationPanel from "./AlarmRationalizationPanel";
// M12 — Condition Monitoring
import CMSDashboard from "./CMSDashboard";
// M15 — Communication Network
import NetworkDashboard from "./NetworkDashboard";
import { cn } from "../../lib/utils";

const TABS = [
  // ── Original 5 tabs ────────────────────────────────
  { id: "goose",     label: "GOOSE Sim",   icon: Zap },
  { id: "events",    label: "Event Log",   icon: ScrollText },
  { id: "permits",   label: "Permits",     icon: FileText },
  { id: "rbac",      label: "RBAC",        icon: Shield },
  { id: "historian", label: "Historian",   icon: Database },
  // ── M01-M03, M07, M09, M12, M15 ───────────────────
  { id: "bays",      label: "Bay Control", icon: GitBranch },
  { id: "soe",       label: "SOE",         icon: List },
  { id: "opcua",     label: "OPC-UA",      icon: Server },
  { id: "security",  label: "Security",    icon: Lock },
  { id: "alarm-kpi", label: "Alarm KPI",   icon: Bell },
  { id: "cms",       label: "CMS",         icon: Activity },
  { id: "network",   label: "Network",     icon: Network },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function SCADADashboard() {
  const { substationSummary } = useScadaStore();
  const [activeTab, setActiveTab] = useState<TabId>("goose");

  if (!substationSummary) return null;

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Top half: SLD + Alarms side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-3" style={{ minHeight: 400 }}>
        {/* SLD — takes 3/5 width */}
        <div className="xl:col-span-3">
          <SubstationSLD />
        </div>

        {/* Alarm table — takes 2/5 width */}
        <div className="xl:col-span-2">
          <AlarmListPanel />
        </div>
      </div>

      {/* Bottom half: Tabbed secondary panels */}
      <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
        {/* Tab bar — scrollable on small screens */}
        <div className="flex items-center border-b border-border-primary bg-bg-tertiary px-2 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px whitespace-nowrap shrink-0",
                  isActive
                    ? "text-accent border-accent"
                    : "text-text-muted hover:text-text-secondary border-transparent",
                )}
              >
                <Icon size={12} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="p-3">
          {/* ── Original tabs ── */}
          {activeTab === "goose"     && <GOOSESimPanel />}
          {activeTab === "events"    && <EventLogPanel />}
          {activeTab === "permits"   && <PermitWorkflowPanel />}
          {activeTab === "rbac"      && <RBACPanel />}
          {activeTab === "historian" && <HistorianPanel />}
          {/* ── New module tabs ── */}
          {activeTab === "bays"      && <BayControllerPanel />}
          {activeTab === "soe"       && <SOERecorderPanel />}
          {activeTab === "opcua"     && <OPCUAPanel />}
          {activeTab === "security"  && <SecurityDashboard />}
          {activeTab === "alarm-kpi" && <AlarmRationalizationPanel />}
          {activeTab === "cms"       && <CMSDashboard />}
          {activeTab === "network"   && <NetworkDashboard />}
        </div>
      </div>
    </div>
  );
}
