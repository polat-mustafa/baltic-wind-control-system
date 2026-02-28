/**
 * Landing page — interactive wind farm overview map.
 *
 * The visual entry point for the Baltic Wind Alpha platform.
 * Shows 34 turbines across 6 strings, the offshore substation,
 * 220 kV export cable, and onshore PSE grid connection — like a
 * real SCADA geographic overview screen (ABB Ability, Siemens DEOP).
 *
 * Simulated live data updates every 3s via the landing Zustand store:
 *   - Wind speed jitters ±0.5 m/s around 10-12 m/s
 *   - Power follows a simplified cubic wind-power curve
 *   - Random status changes (operating/curtailed/fault) for realism
 *
 * Click navigation:
 *   - Turbine → /wind-resource (P1)
 *   - OSS → /scada (P3)
 *   - Export cable / Onshore SS → /hv-grid (P2)
 *   - Quick-access buttons → P3, P4, P5
 */

import { useEffect } from "react";

import MapKPIRibbon from "../components/landing/MapKPIRibbon";
import QuickAccessBar from "../components/landing/QuickAccessBar";
import WindFarmMap from "../components/landing/WindFarmMap";
import { useLandingStore } from "../store/landingStore";

export default function LandingPage() {
  const turbines = useLandingStore((s) => s.turbines);
  const kpis = useLandingStore((s) => s.kpis);
  const startSimulation = useLandingStore((s) => s.startSimulation);
  const stopSimulation = useLandingStore((s) => s.stopSimulation);

  useEffect(() => {
    startSimulation();
    return () => stopSimulation();
  }, [startSimulation, stopSimulation]);

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-auto">
      {/* Main interactive map */}
      <WindFarmMap turbines={turbines} totalPowerMW={kpis.totalOutputMW} />

      {/* Bottom section: KPIs + quick nav */}
      <div className="flex flex-col lg:flex-row gap-4 items-start justify-between">
        <MapKPIRibbon kpis={kpis} />
        <QuickAccessBar />
      </div>
    </div>
  );
}
