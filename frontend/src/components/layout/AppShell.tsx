/**
 * Application shell — ISA-101 dark control room layout.
 *
 * Structure:
 *   1. Top bar — branding, breadcrumbs, system clock, connection status
 *   2. Sidebar — collapsible navigation with icons
 *   3. Content area — renders active route via <Outlet />
 *
 * The dark background follows ISA-101 High Performance HMI guidelines:
 * operators in dimmed control rooms benefit from a dark UI that makes
 * status colors (green/amber/red) more perceptually prominent. The header
 * toggle swaps the whole app to the parchment "storybook" palette (training /
 * presentation look) by putting .theme-storybook on <html>; every page reads
 * the same CSS tokens, so no page needs to know about it.
 */

import { Link, Outlet, useLocation } from "react-router-dom";
import { Suspense, useEffect, useState } from "react";
import {
  Wind,
  Signal,
  ChevronRight,
  AlertTriangle,
  Palette,
  Menu,
} from "lucide-react";

import Sidebar from "./Sidebar";
import { LockedPage } from "../project/LockedPage";
import ProjectChooser from "../project/ProjectChooser";
import ProjectMenu from "../project/ProjectMenu";
import TourMenu from "../../tour/TourMenu";
import TourOverlay from "../../tour/TourOverlay";
import TourWelcome from "../../tour/TourWelcome";
import { Skeleton } from "../ui/Skeleton";
import { StatusIndicator } from "../ui/StatusIndicator";
import { cn } from "../../lib/utils";
import { useFaultSync } from "../../hooks/useFaultSync";
import { useLiveFleet } from "../../hooks/useLiveFleet";
import { useEnergisationGate } from "../../hooks/useEnergisationGate";
import EnergisationOverlay from "../landing/EnergisationOverlay";
import { useScadaStore } from "../../store/scadaStore";
import { useLandingStore } from "../../store/landingStore";
import { useLayerStore } from "../../store/layerStore";
import { useModeStore } from "../../store/modeStore";
import { useSiteStore } from "../../store/siteStore";
import { useLocks } from "../../lib/project/progress";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Control Room",
  "/develop": "Site & Permits",
  "/develop/layout": "Layout",
  "/wind-resource": "Wind Resource",
  "/report": "Project Report",
  "/projects": "My Projects",
  "/hv-grid": "HV Grid Integration",
  "/scada": "SCADA & Automation",
  "/forecast": "AI Forecasting",
  "/commissioning": "HV Commissioning",
  "/digital-twin": "Digital Twin · Condition Monitoring",
  "/turbine-physics": "Turbine Physics",
  "/build": "Construction",
  "/build/handover": "Hand-over",
  "/decommission": "Decommissioning",
  "/academy": "Academy",
};

/** Placeholder while a lazy page chunk downloads. */
function PageLoading() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading page">
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-4 w-96" />
      <Skeleton className="h-[60vh] w-full" />
    </div>
  );
}

export default function AppShell() {
  const location = useLocation();
  const currentLabel = ROUTE_LABELS[location.pathname] ?? "Dashboard";

  // Unified fault synchronization between landing map and SCADA
  useFaultSync();
  // The live plant (map, control room, alarms) runs on SB-510 or the own project
  useLiveFleet();
  // ... and is only energised once it has been commissioned
  useEnergisationGate();

  // Own project: modules unlock stage by stage; the locks need the site assessment and constraint layers.
  const mode = useModeStore((s) => s.mode);
  const hasSite = useSiteStore((s) => s.site !== null);
  const lock = useLocks()[location.pathname] ?? null;
  useEffect(() => {
    if (mode !== "own") return;
    const s = useSiteStore.getState();
    void s.loadLayers();
    if (s.site && !s.report && !s.assessing) void s.assess();
  }, [mode, hasSite]);

  // Subscribe to alarm/fault state using primitives — never return arrays from
  // Zustand selectors (filter/map return new references → Object.is fails → infinite loop)
  const criticalCount = useScadaStore((s) =>
    s.alarms.filter((a) => a.priority === "CRITICAL" && a.state === "ACTIVE").length,
  );
  const firstCriticalText = useScadaStore((s) => {
    const alarm = s.alarms.find((a) => a.priority === "CRITICAL" && a.state === "ACTIVE");
    if (!alarm) return "";
    return `${alarm.equipment} ${alarm.description.split("—")[0]?.trim() ?? ""}`;
  });
  const landingActiveAlerts = useLandingStore((s) => s.kpis.activeAlerts);

  // Dynamic status indicator
  const headerStatus: "normal" | "warning" | "alarm" = criticalCount > 0
    ? "alarm"
    : landingActiveAlerts > 0
      ? "warning"
      : "normal";
  const headerLabel = criticalCount > 0
    ? `${criticalCount} Critical`
    : landingActiveAlerts > 0
      ? "Degraded"
      : "Normal";

  // App-wide palette: control room (default) or storybook
  const mapTheme = useLayerStore((s) => s.mapTheme);
  const setMapTheme = useLayerStore((s) => s.setMapTheme);
  const storybook = mapTheme === "storybook";
  useEffect(() => {
    document.documentElement.classList.toggle("theme-storybook", storybook);
  }, [storybook]);

  // Off-canvas navigation drawer (phones / narrow tablets, below md)
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => {
    if (!navOpen) return;
    const onKey = ({ code }: KeyboardEvent) => code === "Escape" && setNavOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  // Simulation clock — updates every second
  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col">
      {/* ── Top Bar ── */}
      <header className="h-12 bg-bg-secondary border-b border-border-primary flex items-center justify-between gap-2 px-2 sm:px-4 shrink-0">
        {/* Left: Menu (drawer) + Logo + Breadcrumb */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            data-tour="nav-menu"
            aria-expanded={navOpen}
            className="md:hidden flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-bg-hover"
          >
            <Menu size={18} />
          </button>
          <Link
            to="/"
            data-tour="brand"
            className="flex shrink-0 items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center justify-center h-7 w-7 rounded-md bg-accent/15">
              <Wind size={16} className="text-accent" />
            </div>
            <span className="hidden sm:inline font-semibold text-sm tracking-tight text-text-primary whitespace-nowrap">
              OffshoreForge
            </span>
          </Link>

          {/* Breadcrumb */}
          <div className="flex min-w-0 items-center gap-1.5 text-text-muted">
            <ChevronRight size={12} className="shrink-0" />
            <span className="truncate text-xs font-medium text-text-secondary">
              {currentLabel}
            </span>
          </div>
        </div>

        {/* Right: System info */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          {/* Farm spec badge (the reference case study) */}
          {mode !== "own" && (
            <span className="hidden xl:inline-flex text-[10px] text-text-muted font-mono tracking-wide whitespace-nowrap">
              510 MW · 34 × 15 MW · 66/220/400 kV
            </span>
          )}

          {/* Connection status (label hidden on phones) */}
          <div className="flex items-center gap-2">
            <Signal size={12} className="hidden sm:block text-text-muted" />
            <StatusIndicator
              status={headerStatus}
              label={headerLabel}
              className="[&>span:last-child]:max-sm:hidden"
            />
          </div>

          <ProjectMenu />
          <TourMenu />

          <button
            type="button"
            onClick={() => setMapTheme(storybook ? "hmi" : "storybook")}
            aria-pressed={storybook}
            aria-label="Switch colour palette"
            data-tour="theme-toggle"
            title="Switch colour palette"
            className="flex items-center gap-1.5 rounded-md border border-border-primary bg-bg-tertiary px-2 py-1 text-xs font-medium text-text-secondary hover:bg-bg-hover"
          >
            <Palette size={13} />
            <span className="hidden sm:inline">{storybook ? "Storybook" : "Control room"}</span>
          </button>

          {/* Simulation clock (date hidden on phones) */}
          <div
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md",
              "bg-bg-tertiary border border-border-primary",
              "font-mono text-xs text-text-secondary tabular-nums whitespace-nowrap",
            )}
          >
            <span className="hidden md:inline">{clock.toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" })}</span>
            <span>{clock.toLocaleTimeString("sv-SE", { timeZone: "Europe/Warsaw" })}</span>
            <span className="hidden sm:inline text-text-muted text-[10px]">
              {clock.toLocaleString("en-GB", { timeZone: "Europe/Warsaw", timeZoneName: "short" }).split(" ").pop()}
            </span>
          </div>
        </div>
      </header>

      {/* ── Global Critical Alarm Banner ── */}
      {criticalCount > 0 && (
        <div className="shrink-0 px-2 sm:px-4 py-1.5 bg-red-900/40 border-b border-red-700/50 flex items-center justify-between gap-2 animate-pulse">
          <div className="flex min-w-0 items-center gap-2 text-xs font-mono text-red-400">
            <AlertTriangle size={14} className="shrink-0" />
            <span className="font-bold shrink-0">
              {criticalCount} CRITICAL ALARM{criticalCount > 1 ? "S" : ""} ACTIVE
            </span>
            {firstCriticalText && (
              <span className="truncate text-red-400/70">— {firstCriticalText}</span>
            )}
          </div>
          <Link
            to="/scada"
            className="shrink-0 text-[10px] font-mono text-red-400 hover:text-red-300 underline underline-offset-2"
          >
            Open SCADA →
          </Link>
        </div>
      )}

      {/* ── Main Layout: Sidebar + Content ── */}
      <div className="flex flex-1 overflow-hidden">
        {navOpen && (
          <div
            className="md:hidden fixed inset-0 z-[1999] bg-black/60"
            onClick={() => setNavOpen(false)}
            aria-hidden
          />
        )}
        <Sidebar mobileOpen={navOpen} onMobileClose={() => setNavOpen(false)} />
        <main className="min-w-0 flex-1 overflow-auto p-2 sm:p-3">
          {/* Pages are lazy-loaded (App.tsx) */}
          <Suspense fallback={<PageLoading />}>
            {lock ? <LockedPage title={currentLabel} lock={lock} /> : <Outlet />}
          </Suspense>
        </main>
      </div>

      {/* Guided tours (portals above everything) */}
      <TourWelcome />
      <TourOverlay />
      <EnergisationOverlay />
      <ProjectChooser />
    </div>
  );
}
