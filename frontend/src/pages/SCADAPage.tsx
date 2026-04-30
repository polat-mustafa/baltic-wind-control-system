/**
 * P3 SCADA & IEC 61850 page — route /scada.
 *
 * ISA-101 / ASM Consortium high-performance HMI.
 *   Level 1 — PlantOverviewBar (persistent banner, situational awareness)
 *   Level 2 — Operations / Equipment / Diagnostics / Engineering (AreaTabs)
 *   Level 3 — sub-tabs per area (SubTabs)
 *
 * The page applies the .scada-isa101 wrapper class so the medium-grey
 * grayscale theme is scoped to /scada only — other dashboards keep their
 * dark control-room palette.
 */

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Maximize2, Play, Square, Zap } from "lucide-react";

import SCADADashboard from "../components/p3/SCADADashboard";
import SCADAKPIHeader from "../components/p3/SCADAKPIHeader";
import SCADAControlRoomBar from "../components/p3/SCADAControlRoomBar";
import SubstationSLD from "../components/p3/SubstationSLD";
import AlarmListPanel from "../components/p3/AlarmListPanel";
import PlantOverviewBar from "../components/p3/PlantOverviewBar";
import { ActiveAlarmsPanel } from "../components/p3/ActiveAlarmsPanel";
import { useScadaStore } from "../store/scadaStore";
import { Button } from "../components/ui/Button";
import { InfoButton } from "../components/ui/InfoButton";
import { TrainingGuide } from "../components/ui/TrainingGuide";
import { cn } from "../lib/utils";
import { p3Guide } from "../constants/trainingGuideContent";
import {
  runGooseSimButtonInfo,
  autoSimButtonInfo,
  controlRoomButtonInfo,
} from "../constants/panelInfo";

const ROLE_OPTIONS = [
  { value: 1, label: "Viewer (L1)" },
  { value: 2, label: "Operator (L2)" },
  { value: 3, label: "Sr. Operator (L3)" },
  { value: 4, label: "Engineer (L4)" },
  { value: 5, label: "Admin (L5)" },
] as const;

export default function SCADAPage() {
  const substationSummary = useScadaStore((s) => s.substationSummary);
  const faultScenarios = useScadaStore((s) => s.faultScenarios);
  const selectedFaultType = useScadaStore((s) => s.selectedFaultType);
  const selectedRoleLevel = useScadaStore((s) => s.selectedRoleLevel);
  const loading = useScadaStore((s) => s.loading);
  const error = useScadaStore((s) => s.error);
  const dataLoaded = useScadaStore((s) => s.dataLoaded);
  const autoSimEnabled = useScadaStore((s) => s.autoSimEnabled);
  const alarms = useScadaStore((s) => s.alarms);

  const setSelectedFaultType = useScadaStore((s) => s.setSelectedFaultType);
  const setSelectedRoleLevel = useScadaStore((s) => s.setSelectedRoleLevel);
  const fetchInitialData = useScadaStore((s) => s.fetchInitialData);
  const runGooseSimulation = useScadaStore((s) => s.runGooseSimulation);
  const startAutoSimulation = useScadaStore((s) => s.startAutoSimulation);
  const stopAutoSimulation = useScadaStore((s) => s.stopAutoSimulation);
  const clearError = useScadaStore((s) => s.clearError);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    return () => stopAutoSimulation();
  }, [stopAutoSimulation]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(true);

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

  const activeCount = alarms.filter((a) => a.state === "ACTIVE").length;

  // Fullscreen Control Room Mode — SLD fills viewport with alarm sidebar.
  if (isFullscreen) {
    return (
      <div className="scada-isa101 fixed inset-0 z-[9999] flex flex-col">
        <SCADAControlRoomBar onExit={toggleFullscreen} />
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 min-w-0">
            <SubstationSLD />
          </div>
          <div className="w-80 border-l border-border-primary flex flex-col min-h-0">
            <AlarmListPanel compact />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="scada-isa101 flex flex-col h-full">
      {/* ── Level 1: Plant Overview banner ── */}
      <PlantOverviewBar />

      {/* ── Compact title row ── */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-primary bg-bg-secondary shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            P3 · SCADA &amp; Automation
          </h2>
          <span className="text-[10px] text-text-muted font-mono hidden md:inline">
            {substationSummary
              ? `${substationSummary.total_devices} IEDs · ${substationSummary.total_logical_nodes} LN · IEC 61850 · GOOSE`
              : "Loading..."}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <TrainingGuide guide={p3Guide} />
          {activeCount > 0 && (
            <ActiveAlarmsPanel>
              <button
                className="text-[10px] font-mono cursor-pointer rounded px-1.5 py-0.5 text-text-secondary hover:bg-bg-hover transition-colors"
                title="Click to view active alarms"
              >
                {activeCount} active
              </button>
            </ActiveAlarmsPanel>
          )}
          <button
            type="button"
            onClick={() => setControlsOpen((o) => !o)}
            className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-primary"
            title={controlsOpen ? "Hide simulation controls" : "Show simulation controls"}
          >
            {controlsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Controls
          </button>
        </div>
      </div>

      {/* ── Collapsible simulation control bar ── */}
      {controlsOpen && (
        <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border-primary bg-bg-tertiary shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Zap size={12} className="text-text-muted" />
            <select
              value={selectedFaultType}
              onChange={(e) => setSelectedFaultType(e.target.value)}
              className="text-xs bg-bg-secondary border border-border-primary rounded px-2 py-1 text-text-secondary"
              title="Select a turbine fault scenario to inject"
            >
              {faultScenarios.map((s) => (
                <option key={s.fault_type} value={s.fault_type}>
                  {s.description}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <InfoButton info={runGooseSimButtonInfo} />
            <Button
              onClick={runGooseSimulation}
              disabled={loading}
              size="sm"
              className="text-xs"
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Running...
                </span>
              ) : (
                "Run GOOSE Sim"
              )}
            </Button>
          </div>

          <div className="w-px h-5 bg-border-primary" />

          <div className="flex items-center gap-1">
            <button
              onClick={autoSimEnabled ? stopAutoSimulation : startAutoSimulation}
              className={cn(
                "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border transition-colors",
                autoSimEnabled
                  ? "border-status-normal text-status-normal hover:bg-bg-hover"
                  : "bg-bg-secondary border-border-primary text-text-muted hover:bg-bg-hover",
              )}
            >
              {autoSimEnabled ? <Square size={10} /> : <Play size={10} />}
              {autoSimEnabled ? "Stop Auto-Sim" : "Auto-Sim"}
            </button>
            <InfoButton info={autoSimButtonInfo} />
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-text-muted">Role:</span>
            <select
              value={selectedRoleLevel}
              onChange={(e) => setSelectedRoleLevel(Number(e.target.value))}
              className="text-xs bg-bg-secondary border border-border-primary rounded px-2 py-1 text-text-secondary"
              title="Operator RBAC role (IEC 62351 access control)"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border bg-bg-secondary border-border-primary text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors"
            >
              <Maximize2 size={10} />
              Control Room
            </button>
            <InfoButton info={controlRoomButtonInfo} />
          </div>
        </div>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div className="mx-3 mt-2 p-2 bg-status-alarm/10 border border-status-alarm/30 rounded text-xs flex justify-between items-center shrink-0">
          <span className="text-status-alarm">{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}

      {/* ── KPI strip (system status) ── */}
      {dataLoaded && (
        <div className="border-b border-border-primary shrink-0">
          <SCADAKPIHeader />
        </div>
      )}

      {/* ── Main routing area ── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {dataLoaded ? (
          <SCADADashboard />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              {loading ? (
                <span className="flex items-center justify-center gap-2 text-text-secondary">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Loading SCADA configuration...
                </span>
              ) : (
                <p className="text-text-muted text-sm">SCADA HMI loading…</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
