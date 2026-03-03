/**
 * Landing page — interactive wind farm overview map.
 *
 * The visual entry point for the Baltic Wind Alpha platform.
 * Shows 34 turbines across 6 strings, the offshore substation,
 * 220 kV export cable, and onshore PSE grid connection — like a
 * real SCADA geographic overview screen (ABB Ability, Siemens DEOP).
 *
 * Simulated live data updates every 3s via the landing Zustand store.
 */

import { useEffect } from "react";

import MapKPIRibbon from "../components/landing/MapKPIRibbon";
import QuickAccessBar from "../components/landing/QuickAccessBar";
import WindFarmMap from "../components/landing/WindFarmMap";
import { useLandingStore } from "../store/landingStore";
import { InfoButton } from "../components/ui/InfoButton";
import { farmOverviewInfo } from "../constants/panelInfo";

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
    <div className="flex flex-col gap-5 h-full overflow-auto">
      {/* Map header with info button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            Wind Farm Overview
          </h2>
          <p className="text-xs text-text-muted font-mono">
            34 × V236-15.0 MW · Polish Baltic Sea · Real-time simulation
          </p>
        </div>
        <InfoButton info={farmOverviewInfo} />
      </div>

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
