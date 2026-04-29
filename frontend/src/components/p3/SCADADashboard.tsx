/**
 * SCADA dashboard — ISA-101 Level-2/3 area router.
 *
 * Hierarchy:
 *   Level 1 — PlantOverviewBar (rendered by SCADAPage, persistent)
 *   Level 2 — Operations · Equipment · Diagnostics · Engineering (AreaTabs)
 *   Level 3 — sub-tabs per area (SubTabs)
 *
 * This component dispatches to the active L3 panel based on store state.
 * Operations · SLD is the operator's default landing — it gets the
 * privileged side-by-side SLD + Alarm List layout; every other sub-tab
 * fills the area-content region.
 */

import { useScadaStore } from "../../store/scadaStore";

import SubstationSLD from "./SubstationSLD";
import AlarmListPanel from "./AlarmListPanel";
import WindFarmMimic from "./WindFarmMimic";
import GOOSESimPanel from "./GOOSESimPanel";
import EventLogPanel from "./EventLogPanel";
import HistorianPanel from "./HistorianPanel";
import PermitWorkflowPanel from "./PermitWorkflowPanel";
import RBACPanel from "./RBACPanel";
import BayControllerPanel from "./BayControllerPanel";
import SOERecorderPanel from "./SOERecorderPanel";
import OPCUAPanel from "./OPCUAPanel";
import SecurityDashboard from "./SecurityDashboard";
import AlarmRationalizationPanel from "./AlarmRationalizationPanel";
import CMSDashboard from "./CMSDashboard";
import NetworkDashboard from "./NetworkDashboard";
import SCLGeneratorPanel from "./SCLGeneratorPanel";
import VibrationPanel from "./VibrationPanel";
import InterlockStatusPanel from "./InterlockStatusPanel";
import LatencyBudgetPanel from "./LatencyBudgetPanel";
import FleetHealthPanel from "./FleetHealthPanel";
import AttackSimPanel from "./AttackSimPanel";

import AreaTabs from "./AreaTabs";
import SubTabs from "./SubTabs";

export default function SCADADashboard() {
  const substationSummary = useScadaStore((s) => s.substationSummary);
  const area = useScadaStore((s) => s.area);
  const subTabs = useScadaStore((s) => s.subTabs);

  if (!substationSummary) return null;

  const active = subTabs[area];

  return (
    <div className="flex flex-col h-full bg-bg-secondary border border-border-primary overflow-hidden">
      <AreaTabs />
      <SubTabs />

      <div className="flex-1 min-h-0 overflow-auto">
        {/* Operations · Plant Mimic — operator's primary surface */}
        {area === "operations" && active === "mimic" && (
          <div className="h-full min-h-[560px]"><WindFarmMimic /></div>
        )}

        {/* Operations · SLD — privileged side-by-side layout */}
        {area === "operations" && active === "sld" && (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-2 p-2 h-full min-h-[520px]">
            <div className="xl:col-span-3 min-h-[480px]">
              <SubstationSLD />
            </div>
            <div className="xl:col-span-2 min-h-[480px]">
              <AlarmListPanel />
            </div>
          </div>
        )}

        {/* Operations · others */}
        {area === "operations" && active === "alarms" && (
          <div className="p-2 h-full"><AlarmListPanel /></div>
        )}
        {area === "operations" && active === "permits" && (
          <div className="p-3"><PermitWorkflowPanel /></div>
        )}
        {area === "operations" && active === "events" && (
          <div className="p-3"><EventLogPanel /></div>
        )}
        {area === "operations" && active === "bays" && (
          <div className="p-3"><BayControllerPanel /></div>
        )}

        {/* Equipment */}
        {area === "equipment" && active === "cms" && (
          <div className="p-3"><CMSDashboard /></div>
        )}
        {area === "equipment" && active === "vibration" && (
          <div className="p-3"><VibrationPanel /></div>
        )}
        {area === "equipment" && active === "historian" && (
          <div className="p-3"><HistorianPanel /></div>
        )}
        {area === "equipment" && active === "network" && (
          <div className="p-3"><NetworkDashboard /></div>
        )}
        {area === "equipment" && active === "interlocks" && (
          <div className="p-3"><InterlockStatusPanel /></div>
        )}

        {/* Diagnostics */}
        {area === "diagnostics" && active === "goose" && (
          <div className="p-3"><GOOSESimPanel /></div>
        )}
        {area === "diagnostics" && active === "soe" && (
          <div className="p-3"><SOERecorderPanel /></div>
        )}
        {area === "diagnostics" && active === "latency" && (
          <div className="p-3"><LatencyBudgetPanel /></div>
        )}
        {area === "diagnostics" && active === "fleet" && (
          <div className="p-3"><FleetHealthPanel /></div>
        )}
        {area === "diagnostics" && active === "attack" && (
          <div className="p-3"><AttackSimPanel /></div>
        )}

        {/* Engineering */}
        {area === "engineering" && active === "rbac" && (
          <div className="p-3"><RBACPanel /></div>
        )}
        {area === "engineering" && active === "security" && (
          <div className="p-3"><SecurityDashboard /></div>
        )}
        {area === "engineering" && active === "opcua" && (
          <div className="p-3"><OPCUAPanel /></div>
        )}
        {area === "engineering" && active === "scl" && (
          <div className="p-3"><SCLGeneratorPanel /></div>
        )}
        {area === "engineering" && active === "almrat" && (
          <div className="p-3"><AlarmRationalizationPanel /></div>
        )}
      </div>
    </div>
  );
}
