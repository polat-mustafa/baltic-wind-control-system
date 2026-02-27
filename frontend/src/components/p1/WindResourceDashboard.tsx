/**
 * Wind Resource dashboard — grid layout composing all chart panels.
 *
 * Layout (desktop):
 * ┌──────────────────────────────────────┐
 * │          KPI Header (full width)     │
 * ├──────────────────┬───────────────────┤
 * │  Farm Layout Map │  Wind Rose        │
 * ├──────────────────┼───────────────────┤
 * │  Weibull Chart   │  Wake Loss Panel  │
 * ├──────────────────┴───────────────────┤
 * │        AEP Cascade (full width)      │
 * ├──────────────────────────────────────┤
 * │      Layout Comparison (full width)  │
 * └──────────────────────────────────────┘
 */

import { useWindResourceStore } from "../../store/windResourceStore";
import KPIHeader from "./KPIHeader";
import FarmLayoutMap from "./FarmLayoutMap";
import WindRoseChart from "./WindRoseChart";
import WeibullChart from "./WeibullChart";
import WakeLossPanel from "./WakeLossPanel";
import AEPCascadePanel from "./AEPCascadePanel";
import LayoutComparison from "./LayoutComparison";

export default function WindResourceDashboard() {
  const { aepCascade } = useWindResourceStore();

  if (!aepCascade) return null;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <KPIHeader />

      {/* Chart grid: 2 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FarmLayoutMap />
        <WindRoseChart />
        <WeibullChart />
        <WakeLossPanel />
      </div>

      {/* Full-width panels */}
      <AEPCascadePanel />
      <LayoutComparison />
    </div>
  );
}
