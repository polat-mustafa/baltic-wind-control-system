/**
 * Landing page — single-screen wind farm overview.
 *
 * Leaflet map fills the full content area with glassmorphic KPI ribbon
 * overlaid at top. Quick-access buttons in the header bar.
 * Designed like a real control room overview screen — everything visible
 * without scrolling (ABB Ability, Siemens DEOP paradigm).
 *
 * Control Room Mode: fullscreen toggle hides AppShell and fills viewport.
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Monitor, Brain, ClipboardCheck, Maximize2, Minimize2 } from "lucide-react";

import MapKPIRibbon from "../components/landing/MapKPIRibbon";
import LeafletWindFarmMap from "../components/landing/LeafletWindFarmMap";
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    startSimulation();
    return () => stopSimulation();
  }, [startSimulation, stopSimulation]);

  // Listen for fullscreen change events (Escape key, etc.)
  useEffect(() => {
    const handleChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }, []);

  // Fullscreen (Control Room Mode) — map fills entire viewport
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[9999] bg-bg-primary flex flex-col">
        {/* Horizontal KPI ribbon — glassmorphic overlay at top */}
        <div className="absolute top-0 left-0 right-0 z-[1001]">
          <MapKPIRibbon kpis={kpis} horizontal />
        </div>

        {/* Exit fullscreen button */}
        <button
          onClick={toggleFullscreen}
          className={cn(
            "absolute top-2 right-3 z-[1002] flex items-center gap-1.5 rounded-md px-2 py-1.5",
            "bg-bg-secondary/80 border border-border-primary backdrop-blur-sm",
            "text-text-muted hover:text-text-primary hover:bg-bg-hover",
            "transition-colors duration-150",
          )}
          title="Exit Control Room Mode (Esc)"
        >
          <Minimize2 size={13} />
          <span className="text-[10px] font-medium">Exit</span>
        </button>

        {/* Map fills viewport */}
        <div className="flex-1">
          <LeafletWindFarmMap totalPowerMW={kpis.totalOutputMW} />
        </div>
      </div>
    );
  }

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

        {/* Quick nav + Control Room Mode button */}
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

          {/* Control Room Mode toggle */}
          <button
            onClick={toggleFullscreen}
            title="Control Room Mode (fullscreen)"
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5",
              "border border-accent/30 bg-accent/10",
              "hover:bg-accent/20 hover:border-accent/50",
              "transition-all duration-150 group",
            )}
          >
            <Maximize2 size={13} className="text-accent" />
            <span className="text-[10px] font-medium text-accent/80 group-hover:text-accent">
              Control Room
            </span>
          </button>
        </div>
      </div>

      {/* Main area: Map fills width, horizontal KPI bar overlaid at top */}
      <div className="relative flex-1 min-h-0">
        {/* Horizontal KPI ribbon overlay */}
        <div className="absolute top-0 left-0 right-0 z-[1001]">
          <MapKPIRibbon kpis={kpis} horizontal />
        </div>

        {/* Leaflet map — fills remaining space */}
        <div className="w-full h-full">
          <LeafletWindFarmMap totalPowerMW={kpis.totalOutputMW} />
        </div>
      </div>
    </div>
  );
}
