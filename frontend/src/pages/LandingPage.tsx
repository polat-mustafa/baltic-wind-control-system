/**
 * Landing page — single-screen wind farm overview.
 *
 * No-scroll layout: map fills ~75% width, KPI panel fills ~25% on right.
 * Quick-access buttons (P3/P4/P5) are compact icons in the header.
 * Designed like a real control room overview screen — everything visible
 * without scrolling (ABB Ability, Siemens DEOP paradigm).
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Monitor, Brain, ClipboardCheck } from "lucide-react";

import MapKPIRibbon from "../components/landing/MapKPIRibbon";
import WindFarmMap from "../components/landing/WindFarmMap";
import { useLandingStore } from "../store/landingStore";
import { InfoButton } from "../components/ui/InfoButton";
import { farmOverviewInfo } from "../constants/panelInfo";
import { cn } from "../lib/utils";

const QUICK_LINKS = [
  { label: "P3", path: "/scada", icon: Monitor, tip: "SCADA" },
  { label: "P4", path: "/forecast", icon: Brain, tip: "Forecast" },
  { label: "P5", path: "/commissioning", icon: ClipboardCheck, tip: "Commissioning" },
] as const;

export default function LandingPage() {
  const kpis = useLandingStore((s) => s.kpis);
  const startSimulation = useLandingStore((s) => s.startSimulation);
  const stopSimulation = useLandingStore((s) => s.stopSimulation);
  const navigate = useNavigate();

  useEffect(() => {
    startSimulation();
    return () => stopSimulation();
  }, [startSimulation, stopSimulation]);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header row — title + quick access buttons */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Wind Farm Overview
            </h2>
            <p className="text-[10px] text-text-muted font-mono">
              34 × V236-15.0 MW · Polish Baltic Sea · Real-time simulation
            </p>
          </div>
          <InfoButton info={farmOverviewInfo} />
        </div>

        {/* Quick nav buttons */}
        <div className="flex items-center gap-1.5">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                title={`${link.label} · ${link.tip}`}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5",
                  "border border-border-primary bg-bg-secondary",
                  "hover:bg-bg-hover hover:border-border-secondary",
                  "transition-all duration-150 group",
                )}
              >
                <Icon size={13} className="text-accent" />
                <span className="text-[10px] font-medium text-text-muted group-hover:text-text-primary">
                  {link.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main area: Map (flex-1) + KPI strip (fixed width) */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* Map — fills remaining space */}
        <div className="flex-1 min-w-0 h-full">
          <WindFarmMap totalPowerMW={kpis.totalOutputMW} />
        </div>

        {/* KPI vertical strip */}
        <div className="w-52 shrink-0">
          <MapKPIRibbon kpis={kpis} />
        </div>
      </div>
    </div>
  );
}
