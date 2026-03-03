/**
 * SCADA dashboard — professional layout with always-visible SLD + alarms.
 *
 * Layout:
 * ┌──────────────────────────────────┬─────────────────────────┐
 * │   Substation SLD (interactive)   │  Alarm Table (ISA-18.2) │
 * │   Live breaker states            │  Filterable, sortable   │
 * │   Fault zone highlighting        │  ACK/Shelve controls    │
 * ├──────────────────────────────────┴─────────────────────────┤
 * │  Tabs: [GOOSE Sim] [Event Log] [Permits] [RBAC]           │
 * │  Selected tab content                                      │
 * └────────────────────────────────────────────────────────────┘
 */

import { useState } from "react";
import { Zap, FileText, Shield, ScrollText } from "lucide-react";

import { useScadaStore } from "../../store/scadaStore";
import SubstationSLD from "./SubstationSLD";
import AlarmListPanel from "./AlarmListPanel";
import GOOSESimPanel from "./GOOSESimPanel";
import EventLogPanel from "./EventLogPanel";
import PermitWorkflowPanel from "./PermitWorkflowPanel";
import RBACPanel from "./RBACPanel";
import { cn } from "../../lib/utils";

const TABS = [
  { id: "goose", label: "GOOSE Sim", icon: Zap },
  { id: "events", label: "Event Log", icon: ScrollText },
  { id: "permits", label: "Permits", icon: FileText },
  { id: "rbac", label: "RBAC", icon: Shield },
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
        {/* Tab bar */}
        <div className="flex items-center border-b border-border-primary bg-bg-tertiary px-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px",
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
          {activeTab === "goose" && <GOOSESimPanel />}
          {activeTab === "events" && <EventLogPanel />}
          {activeTab === "permits" && <PermitWorkflowPanel />}
          {activeTab === "rbac" && <RBACPanel />}
        </div>
      </div>
    </div>
  );
}
