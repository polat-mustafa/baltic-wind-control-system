/**
 * Application shell — ISA-101 dark control room layout.
 *
 * Structure:
 *   1. Top bar — brand, lifecycle breadcrumb, project, alarm state (only when
 *      not normal), tour, palette toggle, clock
 *   2. Sidebar — icon rail, expandable (constants/navigation)
 *   3. Content area — renders active route via <Outlet />
 *
 * The dark background follows ISA-101 High Performance HMI guidelines:
 * operators in dimmed control rooms benefit from a dark UI that makes
 * status colors (green/amber/red) more perceptually prominent. The header
 * toggle swaps the whole app to the parchment "storybook" palette (training /
 * presentation look) by putting .theme-storybook on <html>; every page reads
 * the same CSS tokens, so no page needs to know about it.
 */

import TutorPanel from "../tutor/TutorPanel";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Suspense, useEffect, useState } from "react";
import { Wind, ChevronRight, AlertTriangle, Sun, Moon, Menu } from "lucide-react";

import Sidebar from "./Sidebar";
import { LockedPage } from "../project/LockedPage";
import ProjectChooser from "../project/ProjectChooser";
import ProjectMenu from "../project/ProjectMenu";
import TourMenu from "../../tour/TourMenu";
import TourOverlay from "../../tour/TourOverlay";
import TourWelcome from "../../tour/TourWelcome";
import { Skeleton } from "../ui/Skeleton";
import { StatusIndicator } from "../ui/StatusIndicator";
import { navTrail } from "../../constants/navigation";
import { useFaultSync } from "../../hooks/useFaultSync";
import { useLiveFleet } from "../../hooks/useLiveFleet";
import { useEnergisationGate } from "../../hooks/useEnergisationGate";
import { useScadaStore } from "../../store/scadaStore";
import { useLandingStore } from "../../store/landingStore";
import { useLayerStore } from "../../store/layerStore";
import { useModeStore } from "../../store/modeStore";
import { useSiteStore } from "../../store/siteStore";
import { useLocks } from "../../lib/project/progress";

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
  const trail = navTrail(location.pathname);
  const currentLabel = trail?.label ?? "OffshoreForge";

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
      {/* ── Top bar: menu (phones), brand, breadcrumb · project, alarm state, tour, palette, clock ── */}
      <header className="h-12 bg-bg-secondary border-b border-border-primary flex items-center justify-between gap-2 px-2 sm:px-4 shrink-0">
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
          <Link to="/" data-tour="brand" className="flex shrink-0 items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="flex items-center justify-center h-7 w-7 rounded-md bg-accent-muted">
              <Wind size={16} className="text-accent" />
            </div>
            <span className="hidden sm:inline font-semibold text-sm tracking-tight text-text-primary whitespace-nowrap">
              OffshoreForge
            </span>
          </Link>
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm text-text-muted">
            {trail && (
              <>
                <ChevronRight size={14} className="hidden shrink-0 sm:block" aria-hidden />
                <span className="hidden shrink-0 sm:inline">{trail.group}</span>
              </>
            )}
            <ChevronRight size={14} className="shrink-0" aria-hidden />
            <span className="truncate font-medium text-text-primary" aria-current="page">{currentLabel}</span>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Plant state only when something needs attention (ISA-101: normal is quiet) */}
          {headerStatus !== "normal" && (
            <StatusIndicator status={headerStatus} label={headerLabel} className="[&>span:last-child]:max-sm:hidden" />
          )}
          <ProjectMenu />
          <div
            className="hidden items-baseline gap-1.5 px-1 font-mono text-sm tabular-nums text-text-secondary sm:flex"
            title={clock.toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" })}
          >
            <span>{clock.toLocaleTimeString("sv-SE", { timeZone: "Europe/Warsaw" })}</span>
            <span className="text-xs text-text-muted">
              {clock.toLocaleString("en-GB", { timeZone: "Europe/Warsaw", timeZoneName: "short" }).split(" ").pop()}
            </span>
          </div>
          <TourMenu />
          <button
            type="button"
            onClick={() => setMapTheme(storybook ? "hmi" : "storybook")}
            aria-pressed={storybook}
            aria-label={storybook ? "Switch to the control room palette" : "Switch to the storybook palette"}
            data-tour="theme-toggle"
            title={storybook ? "Storybook palette — switch to control room" : "Control room palette — switch to storybook"}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border-secondary text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            {storybook ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
          </button>
        </div>
      </header>

      {/* ── Global Critical Alarm Banner ── */}
      {criticalCount > 0 && (
        <div className="shrink-0 px-2 sm:px-4 py-1.5 bg-status-alarm/15 border-b border-status-alarm/40 flex items-center justify-between gap-2 animate-pulse">
          <div className="flex min-w-0 items-center gap-2 text-xs font-mono text-status-alarm">
            <AlertTriangle size={14} className="shrink-0" />
            <span className="font-bold shrink-0">
              {criticalCount} CRITICAL ALARM{criticalCount > 1 ? "S" : ""} ACTIVE
            </span>
            {firstCriticalText && (
              <span className="truncate text-status-alarm/80">— {firstCriticalText}</span>
            )}
          </div>
          <Link
            to="/scada"
            className="shrink-0 text-xs font-mono text-status-alarm hover:text-text-primary underline underline-offset-2"
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
        <main className="min-w-0 flex-1 overflow-auto p-3 md:px-6 md:py-5">
          {/* Pages are lazy-loaded (App.tsx) */}
          <Suspense fallback={<PageLoading />}>
            {lock ? <LockedPage title={currentLabel} lock={lock} /> : <Outlet />}
          </Suspense>
        </main>
      </div>

      {/* Guided tours (portals above everything) */}
      <TourWelcome />
      <TourOverlay />
      <ProjectChooser />
      <TutorPanel />
    </div>
  );
}
