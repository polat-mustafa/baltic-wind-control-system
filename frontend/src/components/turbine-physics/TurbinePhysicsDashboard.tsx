/**
 * Turbine Physics dashboard — chart grid layout.
 *
 * Row 1: KPI Header (full width)
 * Row 2: PowerTimeChart | RotorPitchChart (2-col)
 * Row 3: CpSurfaceChart | TsrCpYawChart   (2-col)
 */

import TurbinePhysicsKPIHeader from "./TurbinePhysicsKPIHeader";
import PowerTimeChart from "./PowerTimeChart";
import RotorPitchChart from "./RotorPitchChart";
import CpSurfaceChart from "./CpSurfaceChart";
import TsrCpYawChart from "./TsrCpYawChart";

export default function TurbinePhysicsDashboard() {
  return (
    <div className="space-y-4">
      {/* Row 1: KPI ribbon */}
      <TurbinePhysicsKPIHeader />

      {/* Row 2: Power + Rotor/Pitch */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PowerTimeChart />
        <RotorPitchChart />
      </div>

      {/* Row 3: Cp Surface + TSR/Cp/Yaw */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CpSurfaceChart />
        <TsrCpYawChart />
      </div>
    </div>
  );
}
