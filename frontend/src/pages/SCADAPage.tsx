/**
 * SCADA & IEC 61850 page — route /scada.
 *
 * Professional layout:
 * - Compact header with alarm summary badges
 * - Fault scenario + role selectors inline (dropdowns, not sidebar)
 * - Auto-simulation toggle for continuous fault injection
 * - Full-width SCADADashboard with SLD + alarms + tabbed panels
 */

import { useEffect } from "react";
import { Monitor, Play, Square, Zap } from "lucide-react";

import SCADADashboard from "../components/p3/SCADADashboard";
import SCADAKPIHeader from "../components/p3/SCADAKPIHeader";
import { useScadaStore } from "../store/scadaStore";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/utils";

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

  // Stop auto-sim on unmount
  useEffect(() => {
    return () => stopAutoSimulation();
  }, [stopAutoSimulation]);

  // Alarm counts for header
  const critCount = alarms.filter((a) => a.priority === "CRITICAL" && a.state === "ACTIVE").length;
  const highCount = alarms.filter((a) => a.priority === "HIGH" && a.state === "ACTIVE").length;
  const medCount = alarms.filter((a) => a.priority === "MEDIUM" && a.state === "ACTIVE").length;
  const activeCount = alarms.filter((a) => a.state === "ACTIVE").length;

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Compact header row */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-text-primary">
            P3 · SCADA & Automation
          </h2>
          <span className="text-[10px] text-text-muted font-mono hidden md:inline">
            {substationSummary
              ? `${substationSummary.total_devices} IEDs · ${substationSummary.total_logical_nodes} LNs · IEC 61850 · GOOSE`
              : "Loading..."}
          </span>
        </div>

        {/* Alarm summary badges */}
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              {critCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-red-900/40 text-red-400 font-bold animate-pulse">
                  {critCount} CRIT
                </span>
              )}
              {highCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-orange-900/40 text-orange-400">
                  {highCount} HIGH
                </span>
              )}
              {medCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-yellow-900/30 text-yellow-400">
                  {medCount} MED
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Controls bar — inline selectors + simulation buttons */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        {/* Fault scenario dropdown */}
        <div className="flex items-center gap-1.5">
          <Zap size={12} className="text-text-muted" />
          <select
            value={selectedFaultType}
            onChange={(e) => setSelectedFaultType(e.target.value)}
            className="text-xs bg-bg-secondary border border-border-primary rounded px-2 py-1 text-text-secondary"
          >
            {faultScenarios.map((s) => (
              <option key={s.fault_type} value={s.fault_type}>
                {s.description}
              </option>
            ))}
          </select>
        </div>

        {/* Run GOOSE simulation */}
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

        <div className="w-px h-5 bg-border-primary" />

        {/* Auto-simulation toggle */}
        <button
          onClick={autoSimEnabled ? stopAutoSimulation : startAutoSimulation}
          className={cn(
            "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border transition-colors",
            autoSimEnabled
              ? "bg-green-900/30 border-green-700/50 text-green-400 hover:bg-green-900/50"
              : "bg-bg-secondary border-border-primary text-text-muted hover:bg-bg-hover",
          )}
        >
          {autoSimEnabled ? <Square size={10} /> : <Play size={10} />}
          {autoSimEnabled ? "Stop Auto-Sim" : "Auto-Sim"}
        </button>

        <div className="flex-1" />

        {/* Role selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-text-muted">Role:</span>
          <select
            value={selectedRoleLevel}
            onChange={(e) => setSelectedRoleLevel(Number(e.target.value))}
            className="text-xs bg-bg-secondary border border-border-primary rounded px-2 py-1 text-text-secondary"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Standards reference */}
        <span className="text-[9px] text-text-muted font-mono hidden lg:inline">
          ISA-18.2 · IEC 61850 · IEC 62443
        </span>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-2 bg-status-alarm/10 border border-status-alarm/30 rounded-lg text-xs flex justify-between items-center shrink-0">
          <span className="text-status-alarm">{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}

      {/* KPI row — compact */}
      {dataLoaded && <SCADAKPIHeader />}

      {/* Main dashboard */}
      <div className="flex-1 min-h-0 overflow-auto">
        {dataLoaded ? (
          <SCADADashboard />
        ) : (
          <div className="flex items-center justify-center h-96 rounded-lg border border-border-primary bg-bg-secondary shadow-lg shadow-black/20">
            <div className="text-center">
              {loading ? (
                <span className="flex items-center justify-center gap-2 text-text-secondary">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Loading SCADA configuration...
                </span>
              ) : (
                <>
                  <div className="flex justify-center mb-4">
                    <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                      <Monitor size={24} className="text-accent" />
                    </div>
                  </div>
                  <p className="text-text-secondary text-base mb-2">
                    SCADA HMI loading...
                  </p>
                  <p className="text-text-muted text-sm">
                    IEC 61850 device registry, GOOSE configuration, RBAC matrix
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
