/**
 * P3 SCADA & IEC 61850 page — route /scada.
 *
 * ISA-101 / ASM Consortium high-performance HMI.
 *   Level 1 — PlantOverviewBar (persistent banner, situational awareness)
 *   Level 2 — Operations / Equipment / Diagnostics / Engineering (AreaTabs)
 *   Level 3 — sub-tabs per area (SubTabs)
 *
 * The page owns the live plant: it runs the browser farm simulation and polls
 * the backend load flow, so every display reads the same state. The
 * .scada-isa101 wrapper scopes the grey HMI theme to /scada.
 */

import { useCallback, useEffect, useState } from "react";
import { Maximize2, Minimize2, Play, Square, Zap } from "lucide-react";

import SCADADashboard from "../components/p3/SCADADashboard";
import SubstationSLD from "../components/p3/SubstationSLD";
import AlarmListPanel from "../components/p3/AlarmListPanel";
import PlantOverviewBar from "../components/p3/PlantOverviewBar";
import { useScadaStore } from "../store/scadaStore";
import { useLandingStore } from "../store/landingStore";
import { useLiveGridPolling } from "../store/liveGridStore";
import { Button } from "../components/ui/Button";
import { InfoButton } from "../components/ui/InfoButton";
import { TrainingGuide } from "../components/ui/TrainingGuide";
import { cn } from "../lib/utils";
import { p3Guide } from "../constants/trainingGuideContent";
import { runGooseSimButtonInfo, autoSimButtonInfo, controlRoomButtonInfo } from "../constants/panelInfo";

const ROLE_OPTIONS = [
  { value: 1, label: "L1 Viewer" },
  { value: 2, label: "L2 Operator" },
  { value: 3, label: "L3 Sr. Operator" },
  { value: 4, label: "L4 Engineer" },
  { value: 5, label: "L5 Admin" },
] as const;

/** "cable_earth_fault" → "Cable earth fault" */
const scenarioLabel = (faultType: string) =>
  faultType.charAt(0).toUpperCase() + faultType.slice(1).replace(/_/g, " ");

const selectCls =
  "h-7 text-xs bg-bg-secondary border border-border-primary rounded px-2 text-text-secondary focus:outline-none focus:border-accent";
const toolBtnCls =
  "flex items-center gap-1.5 h-7 text-xs px-2.5 rounded border transition-colors whitespace-nowrap";

export default function SCADAPage() {
  const substationSummary = useScadaStore((s) => s.substationSummary);
  const faultScenarios = useScadaStore((s) => s.faultScenarios);
  const selectedFaultType = useScadaStore((s) => s.selectedFaultType);
  const selectedRoleLevel = useScadaStore((s) => s.selectedRoleLevel);
  const loading = useScadaStore((s) => s.loading);
  const error = useScadaStore((s) => s.error);
  const dataLoaded = useScadaStore((s) => s.dataLoaded);
  const autoSimEnabled = useScadaStore((s) => s.autoSimEnabled);

  const setSelectedFaultType = useScadaStore((s) => s.setSelectedFaultType);
  const setSelectedRoleLevel = useScadaStore((s) => s.setSelectedRoleLevel);
  const fetchInitialData = useScadaStore((s) => s.fetchInitialData);
  const runGooseSimulation = useScadaStore((s) => s.runGooseSimulation);
  const startAutoSimulation = useScadaStore((s) => s.startAutoSimulation);
  const stopAutoSimulation = useScadaStore((s) => s.stopAutoSimulation);
  const clearError = useScadaStore((s) => s.clearError);

  const startFarm = useLandingStore((s) => s.startSimulation);
  const stopFarm = useLandingStore((s) => s.stopSimulation);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Live plant: farm simulation + backend load flow while the page is open
  useEffect(() => {
    startFarm();
    return () => stopFarm();
  }, [startFarm, stopFarm]);
  useLiveGridPolling();

  useEffect(() => () => stopAutoSimulation(), [stopAutoSimulation]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const handleChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  }, []);

  // Control Room mode — overview banner + SLD + alarm sidebar, nothing else
  if (isFullscreen) {
    return (
      <div className="scada-isa101 fixed inset-0 z-9999 flex flex-col bg-bg-primary">
        <PlantOverviewBar
          trailing={
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 px-3 text-xs border-l border-border-primary text-text-secondary hover:bg-bg-hover"
            >
              <Minimize2 size={12} /> Exit
            </button>
          }
        />
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 min-w-0 p-2">
            <SubstationSLD />
          </div>
          <div className="w-96 border-l border-border-primary flex flex-col min-h-0">
            <AlarmListPanel compact />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="scada-isa101 flex flex-col h-full">
      <PlantOverviewBar />

      {/* ── Toolbar: title · fault trigger · auto-sim · role · control room ── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5 border-b border-border-primary bg-bg-secondary shrink-0">
        <div className="flex items-baseline gap-2 mr-auto min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-primary whitespace-nowrap">
            P3 · SCADA &amp; Automation
          </h2>
          <span className="hidden 2xl:inline text-[10px] text-text-muted font-mono truncate">
            {substationSummary
              ? `${substationSummary.total_devices} IEDs · ${substationSummary.total_logical_nodes} logical nodes · IEC 61850 station bus`
              : "Loading…"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Zap size={12} className="shrink-0 text-text-muted" />
          <select
            value={selectedFaultType}
            onChange={(e) => setSelectedFaultType(e.target.value)}
            className={cn(selectCls, "max-w-48")}
            title={faultScenarios.find((s) => s.fault_type === selectedFaultType)?.description}
            aria-label="Protection fault scenario"
          >
            {faultScenarios.map((s) => (
              <option key={s.fault_type} value={s.fault_type} title={s.description}>
                {scenarioLabel(s.fault_type)}
              </option>
            ))}
          </select>
          <Button onClick={runGooseSimulation} disabled={loading} size="sm" className="h-7 text-xs">
            {loading ? "Running…" : "Inject fault"}
          </Button>
          <InfoButton info={runGooseSimButtonInfo} />
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={autoSimEnabled ? stopAutoSimulation : startAutoSimulation}
            className={cn(
              toolBtnCls,
              autoSimEnabled
                ? "border-status-normal text-status-normal hover:bg-bg-hover"
                : "bg-bg-secondary border-border-primary text-text-secondary hover:bg-bg-hover",
            )}
          >
            {autoSimEnabled ? <Square size={10} /> : <Play size={10} />}
            {autoSimEnabled ? "Stop auto-sim" : "Auto-sim"}
          </button>
          <InfoButton info={autoSimButtonInfo} />
        </div>

        <select
          value={selectedRoleLevel}
          onChange={(e) => setSelectedRoleLevel(Number(e.target.value))}
          className={selectCls}
          title="Operator role (IEC 62351-8 role-based access control)"
          aria-label="Operator role"
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* iPhone Safari has no Fullscreen API for pages */}
        {"requestFullscreen" in document.documentElement && (
          <div className="hidden md:flex items-center gap-1">
            <button
              type="button"
              onClick={toggleFullscreen}
              className={cn(toolBtnCls, "bg-bg-secondary border-border-primary text-text-secondary hover:bg-bg-hover")}
            >
              <Maximize2 size={10} /> Control room
            </button>
            <InfoButton info={controlRoomButtonInfo} />
          </div>
        )}
        <TrainingGuide guide={p3Guide} />
      </div>

      {error && (
        <div className="mx-3 mt-2 p-2 bg-status-alarm/10 border border-status-alarm/30 rounded text-xs flex justify-between items-center shrink-0">
          <span className="text-status-alarm">{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden">
        {dataLoaded ? (
          <SCADADashboard />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-text-muted">
            {loading ? "Loading SCADA configuration…" : "SCADA backend unreachable"}
          </div>
        )}
      </div>
    </div>
  );
}
