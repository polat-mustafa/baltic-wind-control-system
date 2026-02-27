/**
 * HV Grid dashboard — grid layout composing all chart panels.
 *
 * Layout (desktop):
 * ┌──────────────────────────────────────┐
 * │         GridKPIHeader (full width)   │
 * ├──────────────────┬───────────────────┤
 * │ Voltage Profile  │  Cable Loading    │
 * ├──────────────────┼───────────────────┤
 * │ Short-Circuit    │  STATCOM Panel    │
 * ├──────────────────┴───────────────────┤
 * │        FRT Panel (full width)        │
 * ├──────────────────────────────────────┤
 * │   Converter Comparison (full width)  │
 * └──────────────────────────────────────┘
 */

import { useGridStore } from "../../store/gridStore";
import GridKPIHeader from "./GridKPIHeader";
import VoltageProfilePanel from "./VoltageProfilePanel";
import CableLoadingPanel from "./CableLoadingPanel";
import ShortCircuitPanel from "./ShortCircuitPanel";
import STATCOMPanel from "./STATCOMPanel";
import FRTPanel from "./FRTPanel";
import ConverterComparisonPanel from "./ConverterComparisonPanel";

export default function GridDashboard() {
  const { loadFlowResults } = useGridStore();

  if (!loadFlowResults) return null;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <GridKPIHeader />

      {/* Chart grid: 2 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <VoltageProfilePanel />
        <CableLoadingPanel />
        <ShortCircuitPanel />
        <STATCOMPanel />
      </div>

      {/* Full-width panels */}
      <FRTPanel />
      <ConverterComparisonPanel />
    </div>
  );
}
