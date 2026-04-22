/**
 * P2 Grid · Planning & Sector Coupling tab.
 *
 * Surfaces 10 backend endpoints that were previously orphaned from the UI:
 *   /economic-dispatch, /bess-dispatch, /ac-dc-comparison, /capacity-expansion,
 *   /pathway-planning, /sector-coupling, /electrolyzer, /seasonal-storage,
 *   /flexible-demand, /multi-energy-carrier.
 *
 * All cards use the generic EndpointRunnerCard.
 */

import { EndpointRunnerCard } from "./EndpointRunnerCard";
import {
  DEFAULTS,
  postEconomicDispatch,
  postBESSDispatch,
  postACDCComparison,
  postCapacityExpansion,
  postPathwayPlanning,
  postSectorCoupling,
  postElectrolyzer,
  postSeasonalStorage,
  postFlexibleDemand,
  postMultiEnergy,
} from "../../services/gridAdvancedApi";

export default function PlanningCouplingTab() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <EndpointRunnerCard
        title="24-h Economic Dispatch"
        description="Hourly wind dispatch with ramp-rate compliance and curtailment cost."
        standard="PSE IRiESP · 10 %Pn/min ramp"
        defaultBody={DEFAULTS.economicDispatch}
        runner={postEconomicDispatch}
      />
      <EndpointRunnerCard
        title="BESS Dispatch Optimisation"
        description="Battery dispatch for grid-export limiting and revenue maximisation."
        standard="LFP 4-h LCOS · degradation-aware"
        defaultBody={DEFAULTS.bessDispatch}
        runner={postBESSDispatch}
      />
      <EndpointRunnerCard
        title="HVAC vs HVDC Export Comparison"
        description="Compare losses, reactive demand and CAPEX for HVAC, VSC-HVDC and hybrid."
        standard="IEC 60287 · Cigré TB 680 (HVDC)"
        defaultBody={DEFAULTS.acDcComparison}
        runner={postACDCComparison}
      />
      <EndpointRunnerCard
        title="Capacity Expansion Plan"
        description="Multi-phase build-out: CAPEX, AEP, NPV/IRR and LCOE per phase."
        standard="IEA WEO methodology"
        defaultBody={DEFAULTS.capacityExpansion}
        runner={postCapacityExpansion}
      />
      <EndpointRunnerCard
        title="Energy-Transition Pathway"
        description="Multi-decade pathway: CO₂ trajectory, renewable share, system LCOE."
        standard="EU Fit-for-55 · 2030/2050 targets"
        defaultBody={DEFAULTS.pathwayPlanning}
        runner={postPathwayPlanning}
      />
      <EndpointRunnerCard
        title="Sector Coupling (P2X)"
        description="Electricity + heat + hydrogen integrated dispatch and curtailment reduction."
        standard="IEA P2X framework"
        defaultBody={DEFAULTS.sectorCoupling}
        runner={postSectorCoupling}
      />
      <EndpointRunnerCard
        title="Electrolyzer (Green H₂)"
        description="PEM/Alkaline/SOEC sizing with price-threshold dispatch."
        standard="IEC 22734 · IRENA Green H₂"
        defaultBody={DEFAULTS.electrolyzer}
        runner={postElectrolyzer}
      />
      <EndpointRunnerCard
        title="Seasonal (Long-Duration) Storage"
        description="Hydrogen cavern, CAES, or pumped hydro — annual cycling economics."
        standard="DOE LDES roadmap"
        defaultBody={DEFAULTS.seasonalStorage}
        runner={postSeasonalStorage}
      />
      <EndpointRunnerCard
        title="Flexible Demand / DSR"
        description="Price-elastic demand response — peak shaving and shifted MWh."
        standard="ENTSO-E NC DCC"
        defaultBody={DEFAULTS.flexibleDemand}
        runner={postFlexibleDemand}
      />
      <EndpointRunnerCard
        title="Multi-Energy Carrier Balance"
        description="Annual electricity / heat / hydrogen supply-demand balance."
        standard="IEA ETP framework"
        defaultBody={DEFAULTS.multiEnergy}
        runner={postMultiEnergy}
      />
    </div>
  );
}
