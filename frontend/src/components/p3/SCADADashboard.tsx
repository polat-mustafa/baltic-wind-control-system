/**
 * SCADA dashboard — grid layout composing all P3 panels.
 *
 * Layout (desktop):
 * ┌──────────────────────────────────────┐
 * │       SCADAKPIHeader (full width)    │
 * ├──────────────────────────────────────┤
 * │       SubstationSLD (full width)     │
 * ├──────────────────────────────────────┤
 * │      GOOSESimPanel (full width)      │
 * ├──────────────────┬───────────────────┤
 * │   Alarm List     │    Event Log      │
 * ├──────────────────┴───────────────────┤
 * │   PermitWorkflowPanel (full width)   │
 * ├──────────────────────────────────────┤
 * │      RBACPanel (full width)          │
 * └──────────────────────────────────────┘
 */

import { useScadaStore } from "../../store/scadaStore";
import SCADAKPIHeader from "./SCADAKPIHeader";
import SubstationSLD from "./SubstationSLD";
import GOOSESimPanel from "./GOOSESimPanel";
import AlarmListPanel from "./AlarmListPanel";
import EventLogPanel from "./EventLogPanel";
import PermitWorkflowPanel from "./PermitWorkflowPanel";
import RBACPanel from "./RBACPanel";

export default function SCADADashboard() {
  const { substationSummary } = useScadaStore();

  if (!substationSummary) return null;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <SCADAKPIHeader />

      {/* Substation SLD */}
      <SubstationSLD />

      {/* GOOSE simulation */}
      <GOOSESimPanel />

      {/* Alarm + Event split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AlarmListPanel />
        <EventLogPanel />
      </div>

      {/* Permit-to-Work */}
      <PermitWorkflowPanel />

      {/* RBAC */}
      <RBACPanel />
    </div>
  );
}
