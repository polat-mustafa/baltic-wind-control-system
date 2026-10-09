/**
 * Landing page — single-screen wind farm overview.
 *
 * Leaflet map fills the full content area with glassmorphic KPI ribbon
 * overlaid at top. Quick-access buttons in the header bar.
 * Designed like a real control room overview screen — everything visible
 * without scrolling (ABB Ability, Siemens DEOP paradigm).
 *
 * Control Room Mode: fullscreen toggle hides AppShell and fills viewport.
 *
 * Detail panels (turbine, OSS, onshore, cable) are rendered OUTSIDE Leaflet's
 * DOM tree so they are never hidden behind GPU-composited translate3d layers.
 */

import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Monitor,
  Brain,
  ClipboardCheck,
  Maximize2,
  Minimize2,
} from "lucide-react";

import { farmTitle, turbineLabel, useFleet } from "../lib/fleet";
import MapKPIRibbon from "../components/landing/MapKPIRibbon";
import { WindRoseWidget } from "../components/landing/WindRoseWidget";
import LeafletWindFarmMap from "../components/landing/LeafletWindFarmMap";
import CableDetailPanel from "../components/landing/CableDetailPanel";
import TransformerDetailPanel from "../components/landing/TransformerDetailPanel";
import TurbineDetailPanel from "../components/landing/TurbineDetailPanel";
import LIDARDetailPanel from "../components/landing/LIDARDetailPanel";
import STATCOMDetailPanel from "../components/landing/STATCOMDetailPanel";
import {
  selectCable,
  selectTransformer,
  selectTurbine,
  useLandingStore,
} from "../store/landingStore";
import { useLiveGridPolling } from "../store/liveGridStore";

// Code-split 3D viewer (three.js + scene, the largest chunk). It is
// prefetched once the map is idle, so the first turbine click opens the panel
// at once instead of after a 2–3 s download (users clicked again and closed it).
const loadTurbineViewer = () => import("../components/landing/turbine3d/TurbineViewer3D");
const TurbineViewer3D = lazy(loadTurbineViewer);
import { InfoButton } from "../components/ui/InfoButton";
import { TrainingGuide } from "../components/ui/TrainingGuide";
import { farmOverviewInfo } from "../constants/panelInfo";
import { landingGuide } from "../constants/trainingGuideContent";
import { cn } from "../lib/utils";
import { useElementWidth } from "../hooks/useElementWidth";

// ── Connected detail panel wrappers ─────────────────────────────
// Defined at module level so React never unmounts/remounts them on parent render.
// Each subscribes to only the store slice it needs.

// 3D viewer width + gap before the detail panel
const VIEWER_W = 580;
const VIEWER_LEFT = 10;
const VIEWER_TOP = 60;
const PANEL_W = 440;
const PANEL_LEFT_WITH_VIEWER = VIEWER_LEFT + VIEWER_W + 10; // 600
// Map-area width → turbine layout: viewer 580 px + panel 440 px side by side
// when there is room, a narrower viewer (340 px, compact HUD) beside a panel
// that takes the rest on tablets / laptops with the sidebar open, and the
// viewer stacked above the panel on phones.
const WIDE_MIN_W = PANEL_LEFT_WITH_VIEWER + PANEL_W + 10; // 1050
const MEDIUM_MIN_W = 720;
const MEDIUM_VIEWER_W = 340;
const MEDIUM_PANEL_LEFT = VIEWER_LEFT + MEDIUM_VIEWER_W + 10; // 360
const STACK_VIEWER_H = "42%";
type TurbineLayout = "wide" | "medium" | "stacked";
const STACKED_PANEL_PLACEMENT = { left: 8, right: 8, top: "calc(42% + 16px)", bottom: 8 } as const;
const MEDIUM_PANEL_PLACEMENT = { left: MEDIUM_PANEL_LEFT, right: 10, top: VIEWER_TOP } as const;

function ConnectedTurbineDetailPanel({
  turbineId,
  onClose,
  layout,
}: {
  turbineId: string;
  onClose: () => void;
  layout: TurbineLayout;
}) {
  const turbine = useLandingStore(selectTurbine(turbineId));
  // Expanded: the 3D viewer takes the whole map area (same element, so the
  // WebGL scene is kept — only its size changes)
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    // Esc leaves the full view first (capture phase, before the panel's own Esc)
    const onEsc = (ev: KeyboardEvent) => {
      if (ev.code !== "Escape") return;
      ev.stopImmediatePropagation();
      setExpanded(false);
    };
    window.addEventListener("keydown", onEsc, true);
    return () => window.removeEventListener("keydown", onEsc, true);
  }, [expanded]);
  if (!turbine) return null;
  return (
    <>
      {/* 3D Viewer — to the left of the detail panel */}
      <div
        className="absolute"
        data-tour="turbine-viewer"
        style={
          expanded
            ? { zIndex: 1300, left: 8, top: 8, width: "calc(100% - 16px)", height: "calc(100% - 16px)" }
            : layout === "stacked"
              ? { zIndex: 1150, left: 8, right: 8, top: 8, height: STACK_VIEWER_H }
              : {
                  zIndex: 1150,
                  left: VIEWER_LEFT,
                  top: VIEWER_TOP,
                  width: layout === "wide" ? VIEWER_W : MEDIUM_VIEWER_W,
                  height: "calc(100% - 80px)",
                }
        }
      >
        <Suspense
          fallback={
            <div className="w-full h-full rounded-lg border border-border-primary bg-bg-secondary flex items-center justify-center">
              <span className="text-[11px] text-text-muted font-mono">
                Loading 3D viewer…
              </span>
            </div>
          }
        >
          <TurbineViewer3D
            turbineId={turbineId}
            turbine={turbine}
            expanded={expanded}
            onToggleExpand={() => setExpanded((v) => !v)}
          />
        </Suspense>
      </div>

      {/* Detail panel — shifted right to make room for viewer */}
      <TurbineDetailPanel
        turbine={turbine}
        onClose={onClose}
        leftOffset={PANEL_LEFT_WITH_VIEWER}
        placement={
          layout === "stacked"
            ? STACKED_PANEL_PLACEMENT
            : layout === "medium"
              ? MEDIUM_PANEL_PLACEMENT
              : undefined
        }
      />
    </>
  );
}

function ConnectedOSSPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const ossTx = useLandingStore(selectTransformer("OSS-TX1"));
  if (!ossTx) return null;
  return (
    <TransformerDetailPanel
      transformer={ossTx}
      onClose={onClose}
      onNavigate={() => navigate("/scada")}
      navLabel="Open SCADA Dashboard"
    />
  );
}

function ConnectedOnshorePanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const onsTx = useLandingStore(selectTransformer("ONS-TX1"));
  if (!onsTx) return null;
  return (
    <TransformerDetailPanel
      transformer={onsTx}
      onClose={onClose}
      onNavigate={() => navigate("/hv-grid")}
      navLabel="Open HV Grid Dashboard"
    />
  );
}

function ConnectedCablePanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const cable = useLandingStore(selectCable);
  if (!cable) return null;
  return (
    <CableDetailPanel
      cable={cable}
      onClose={onClose}
      onNavigate={() => navigate("/hv-grid")}
    />
  );
}

// ── Panel type ──────────────────────────────────────────────────
type DetailPanel =
  | "oss"
  | "onshore"
  | "cable"
  | "turbine"
  | "lidar"
  | "statcom"
  | null;

const QUICK_LINKS = [
  { label: "SCADA", path: "/scada", icon: Monitor, tip: "SCADA & automation" },
  { label: "Forecast", path: "/forecast", icon: Brain, tip: "Power forecasting" },
  {
    label: "Commissioning",
    path: "/commissioning",
    icon: ClipboardCheck,
    tip: "HV commissioning",
  },
] as const;

export default function LandingPage() {
  const fleet = useFleet();
  const kpis = useLandingStore((s) => s.kpis);
  const startSimulation = useLandingStore((s) => s.startSimulation);
  const stopSimulation = useLandingStore((s) => s.stopSimulation);
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Width of the map area decides side-by-side vs stacked turbine viewer
  const [areaRef, areaWidth] = useElementWidth<HTMLDivElement>();
  const turbineLayout: TurbineLayout =
    areaWidth === 0 || areaWidth >= WIDE_MIN_W ? "wide" : areaWidth >= MEDIUM_MIN_W ? "medium" : "stacked";

  // Panel state — lifted from LeafletWindFarmMap so panels render outside Leaflet DOM
  const [activePanel, setActivePanel] = useState<DetailPanel>(null);
  const [selectedTurbineId, setSelectedTurbineId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    startSimulation();
    return () => stopSimulation();
  }, [startSimulation, stopSimulation]);

  // A new live fleet (own project ↔ SB-510) closes the panels of the old plant
  useEffect(() => {
    setActivePanel(null);
    setSelectedTurbineId(null);
  }, [fleet]);

  // Grid physics for the live operating point from the backend (pandapower)
  useLiveGridPolling();

  // Warm the 3D viewer chunk after the map has settled
  useEffect(() => {
    const id = setTimeout(() => void loadTurbineViewer(), 2500);
    return () => clearTimeout(id);
  }, []);

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

  // Map click handlers — stable callbacks for memo'd LeafletWindFarmMap
  const handleTurbineClick = useCallback((turbineId: string) => {
    setSelectedTurbineId(turbineId);
    setActivePanel("turbine");
  }, []);

  const handleOSSClick = useCallback(() => setActivePanel("oss"), []);
  const handleOnshoreClick = useCallback(() => setActivePanel("onshore"), []);
  const handleCableClick = useCallback(() => setActivePanel("cable"), []);
  const handleSTATCOMClick = useCallback(() => setActivePanel("statcom"), []);
  const handleLIDARClick = useCallback(() => setActivePanel("lidar"), []);

  const handlePanelClose = useCallback(() => {
    setActivePanel(null);
    setSelectedTurbineId(null);
  }, []);

  // Round power to avoid re-renders on decimal changes
  const roundedPower = Math.round(kpis.totalOutputMW);

  // Detail panels — rendered outside Leaflet's DOM tree
  const detailPanels = (
    <>
      {activePanel === "oss" && (
        <ConnectedOSSPanel onClose={handlePanelClose} />
      )}
      {activePanel === "onshore" && (
        <ConnectedOnshorePanel onClose={handlePanelClose} />
      )}
      {activePanel === "cable" && (
        <ConnectedCablePanel onClose={handlePanelClose} />
      )}
      {activePanel === "lidar" && (
        <LIDARDetailPanel onClose={handlePanelClose} />
      )}
      {activePanel === "statcom" && (
        <STATCOMDetailPanel onClose={handlePanelClose} />
      )}
      {activePanel === "turbine" && selectedTurbineId && (
        <ConnectedTurbineDetailPanel
          turbineId={selectedTurbineId}
          onClose={handlePanelClose}
          layout={turbineLayout}
        />
      )}
    </>
  );

  // Fullscreen (Control Room Mode) — map fills entire viewport
  if (isFullscreen) {
    return (
      <div
        className="fixed inset-0 bg-bg-primary flex flex-col"
        style={{ zIndex: 9999 }}
      >
        {/* Horizontal KPI ribbon — glassmorphic overlay at top */}
        <div
          className="absolute top-2 left-0 right-0 pointer-events-none"
          style={{ zIndex: 1001 }}
        >
          <MapKPIRibbon kpis={kpis} horizontal />
        </div>

        {/* Exit fullscreen button */}
        <button
          onClick={toggleFullscreen}
          className={cn(
            "absolute top-2 right-3 flex items-center gap-1.5 rounded-md px-2 py-1.5",
            "bg-bg-secondary/80 border border-border-primary backdrop-blur-sm",
            "text-text-muted hover:text-text-primary hover:bg-bg-hover",
            "transition-colors duration-150",
          )}
          title="Exit Control Room Mode (Esc)"
          style={{ zIndex: 1002 }}
        >
          <Minimize2 size={13} />
          <span className="text-[10px] font-medium">Exit</span>
        </button>

        {/* Map fills viewport — panels rendered after map, outside Leaflet DOM */}
        <div ref={areaRef} className="relative flex-1">
          <div className="w-full h-full">
            <LeafletWindFarmMap
              totalPowerMW={roundedPower}
              selectedTurbineId={selectedTurbineId}
              onTurbineClick={handleTurbineClick}
              onOSSClick={handleOSSClick}
              onOnshoreClick={handleOnshoreClick}
              onCableClick={handleCableClick}
              onSTATCOMClick={handleSTATCOMClick}
              onLIDARClick={handleLIDARClick}
            />
          </div>

          {/* Wind rose climatology widget — top-left corner overlay (also
              rendered in normal mode below). Both code paths must include it
              so the widget survives the Control Room toggle. */}
          <WindRoseWidget />

          {detailPanels}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-6.5rem)] min-h-[30rem] sm:h-[calc(100dvh-8rem)]">
      {/* Header row — title + quick access buttons */}
      <div
        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-2 sm:mb-3 shrink-0"
        data-tour="page-header"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-text-primary">
              Wind Farm Overview
            </h2>
            <p className="text-[10px] text-text-muted font-mono">
              {farmTitle(fleet)} · {fleet.turbines.length} × {turbineLabel(fleet)} · Polish Baltic Sea · Live simulation
            </p>
          </div>
          <InfoButton info={farmOverviewInfo} />
        </div>

        {/* Quick nav + Training Guide + Control Room Mode button */}
        <div className="flex flex-wrap items-center gap-1.5">
          <TrainingGuide guide={landingGuide} />
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                title={link.tip}
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

          {/* Control Room Mode toggle (iPhone Safari has no Fullscreen API for pages) */}
          {"requestFullscreen" in document.documentElement && (
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
            <span className="hidden sm:inline text-[10px] font-medium text-accent/80 group-hover:text-accent">
              Control Room
            </span>
          </button>
          )}
        </div>
      </div>

      {/* Main area: Map fills width, KPI + detail panels overlaid */}
      <div ref={areaRef} className="relative flex-1 min-h-0">
        {/* Horizontal KPI ribbon overlay */}
        <div
          className="absolute top-2 left-0 right-0 pointer-events-none"
          style={{ zIndex: 1001 }}
          data-tour="kpi-ribbon"
        >
          <MapKPIRibbon kpis={kpis} horizontal />
        </div>

        {/* Leaflet map — fills remaining space */}
        <div className="w-full h-full" data-tour="farm-map">
          <LeafletWindFarmMap
            totalPowerMW={roundedPower}
            selectedTurbineId={selectedTurbineId}
            onTurbineClick={handleTurbineClick}
            onOSSClick={handleOSSClick}
            onOnshoreClick={handleOnshoreClick}
            onCableClick={handleCableClick}
            onSTATCOMClick={handleSTATCOMClick}
            onLIDARClick={handleLIDARClick}
          />
        </div>

        {/* Wind rose climatology widget — top-left corner overlay */}
        <WindRoseWidget />

        {/* Detail panels — OUTSIDE Leaflet's DOM, above compositor layers */}
        {detailPanels}
      </div>
    </div>
  );
}
