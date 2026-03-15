/**
 * HV Grid Integration page — route /hv-grid.
 *
 * Two tabs: "Grid Analysis" (P2 steady-state + dynamic) and
 * "Power Plant Controller" (PPC dispatch simulation).
 *
 * Controls live in a slide-out drawer (separate content per tab).
 * Dashboards render at full width.
 */

import { useEffect, useState } from "react";
import { Zap, Radio } from "lucide-react";

import GridDashboard from "../components/p2/GridDashboard";
import PPCDashboard from "../components/p2/PPCDashboard";
import { useGridStore } from "../store/gridStore";
import { usePPCStore } from "../store/ppcStore";
import { Button } from "../components/ui/Button";
import { TrainingGuide } from "../components/ui/TrainingGuide";
import { ControlDrawer } from "../components/ui/ControlDrawer";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { p2Guide } from "../constants/trainingGuideContent";

import type { ActivePowerMode, ReactivePowerMode } from "../types/ppc";

type Tab = "grid" | "ppc";

const SCENARIO_OPTIONS = [
  { value: "full_load", label: "Full Load (510 MW)" },
  { value: "partial_load", label: "Partial Load (255 MW)" },
  { value: "no_load", label: "No Load (Ferranti)" },
  { value: "n_minus_1", label: "N-1 Contingency" },
] as const;

const FRT_OPTIONS = [
  { value: "lvrt", label: "LVRT (Voltage Dip)" },
  { value: "hvrt", label: "HVRT (Voltage Swell)" },
] as const;

const CONVERTER_OPTIONS = [
  { value: "strong_grid", label: "Strong Grid (SCR \u2248 19.6)" },
  { value: "weak_grid", label: "Weak Grid (SCR \u2248 3.9)" },
] as const;

const ACTIVE_POWER_MODES: { value: ActivePowerMode; label: string }[] = [
  { value: "power_reference", label: "Power Reference (TSO setpoint)" },
  { value: "delta_control", label: "Delta Control (reserve margin)" },
  { value: "absolute_limitation", label: "Absolute Limitation (cap)" },
  { value: "ramp_rate_control", label: "Ramp Rate Control" },
];

const REACTIVE_POWER_MODES: { value: ReactivePowerMode; label: string }[] = [
  { value: "voltage_control", label: "Voltage PI Control" },
  { value: "reactive_power", label: "Direct Q Setpoint" },
  { value: "power_factor", label: "Power Factor" },
  { value: "q_v_droop", label: "Q(V) Droop" },
];

export default function HVGridPage() {
  const [activeTab, setActiveTab] = useState<Tab>("grid");

  // Grid store (existing P2)
  const {
    networkSpec,
    loading: gridLoading,
    error: gridError,
    analysisRun,
    activeScenario,
    frtType,
    converterScenario,
    setActiveScenario,
    setFrtType,
    setConverterScenario,
    fetchNetworkSpec,
    runFullAnalysis,
    clearError: clearGridError,
  } = useGridStore();

  // PPC store
  const {
    loading: ppcLoading,
    error: ppcError,
    simulationRun,
    powerSetpointMW,
    windSpeedMS,
    availableTurbines,
    deltaReserveMW,
    absoluteLimitMW,
    activePowerMode,
    reactivePowerMode,
    setPowerSetpointMW,
    setWindSpeedMS,
    setAvailableTurbines,
    setDeltaReserveMW,
    setAbsoluteLimitMW,
    setActivePowerMode,
    setReactivePowerMode,
    runSimulation,
    clearError: clearPPCError,
  } = usePPCStore();

  const loading = activeTab === "grid" ? gridLoading : ppcLoading;
  const error = activeTab === "grid" ? gridError : ppcError;
  const clearError = activeTab === "grid" ? clearGridError : clearPPCError;

  useEffect(() => {
    fetchNetworkSpec();
  }, [fetchNetworkSpec]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-text-primary">
            P2 · HV Grid Integration
          </h2>
          <p className="text-xs text-text-muted mt-1 font-mono">
            {networkSpec
              ? `${networkSpec.total_capacity_mw} MW · ${networkSpec.array_voltage_kv}/${networkSpec.export_voltage_kv}/${networkSpec.grid_voltage_kv} kV · ${networkSpec.export_length_km} km export`
              : "Loading..."}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {activeTab === "grid" ? (
            <Button
              onClick={runFullAnalysis}
              disabled={loading}
              size="sm"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Running...
                </span>
              ) : analysisRun ? (
                "Re-run"
              ) : (
                "Run Analysis"
              )}
            </Button>
          ) : (
            <Button
              onClick={runSimulation}
              disabled={loading}
              size="sm"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Simulating...
                </span>
              ) : simulationRun ? (
                "Re-run"
              ) : (
                "Run PPC"
              )}
            </Button>
          )}

          {/* Grid Controls Drawer */}
          {activeTab === "grid" && (
            <ControlDrawer
              title="Grid Analysis Controls"
              subtitle="Load flow, FRT & grid strength"
              footer={
                <div className="space-y-1">
                  <p className="text-xs text-text-muted">
                    <span className="font-medium text-text-secondary">Standards:</span>{" "}
                    PSE IRiESP (0.95-1.05 pu), IEC 60909, ENTSO-E NC RfG Type D
                  </p>
                  <p className="text-xs text-text-muted">
                    <span className="font-medium text-text-secondary">Tools:</span>{" "}
                    Pandapower (steady-state), ANDES (dynamic)
                  </p>
                </div>
              }
            >
              <Card>
                <CardHeader>
                  <CardTitle>Load Flow Scenario</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {SCENARIO_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                        <input type="radio" name="scenario" value={opt.value} checked={activeScenario === opt.value} onChange={() => setActiveScenario(opt.value)} className="accent-accent" />
                        <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Fault Ride-Through</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {FRT_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                        <input type="radio" name="frt" value={opt.value} checked={frtType === opt.value} onChange={() => setFrtType(opt.value)} className="accent-accent" />
                        <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Grid Strength</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {CONVERTER_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                        <input type="radio" name="converter" value={opt.value} checked={converterScenario === opt.value} onChange={() => setConverterScenario(opt.value)} className="accent-accent" />
                        <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Button onClick={runFullAnalysis} disabled={loading} className="w-full py-3" size="lg">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Running Analysis...
                  </span>
                ) : analysisRun ? "Re-run Analysis" : "Run Analysis"}
              </Button>
            </ControlDrawer>
          )}

          {/* PPC Controls Drawer */}
          {activeTab === "ppc" && (
            <ControlDrawer
              title="PPC Controls"
              subtitle="TSO dispatch & reactive power"
              footer={
                <div className="space-y-1">
                  <p className="text-xs text-text-muted">
                    <span className="font-medium text-text-secondary">PPC Control:</span>{" "}
                    PSE ramp up 10%Pn/min, down 20%Pn/min, accuracy ±5%
                  </p>
                  <p className="text-xs text-text-muted">
                    <span className="font-medium text-text-secondary">Standards:</span>{" "}
                    ENTSO-E NC RfG Type D, PSE IRiESP, IEC 61400-25
                  </p>
                </div>
              }
            >
              {/* Active Power Mode */}
              <Card>
                <CardHeader><CardTitle>Active Power Mode</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {ACTIVE_POWER_MODES.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                        <input type="radio" name="ap_mode" value={opt.value} checked={activePowerMode === opt.value} onChange={() => setActivePowerMode(opt.value)} className="accent-accent" />
                        <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* TSO Setpoint */}
              <Card>
                <CardHeader><CardTitle>TSO Setpoint</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {activePowerMode === "power_reference" && (
                      <div>
                        <label className="text-xs text-text-muted block mb-1">Power Setpoint [MW]</label>
                        <input type="range" min={0} max={510} step={10} value={powerSetpointMW} onChange={(e) => setPowerSetpointMW(Number(e.target.value))} className="w-full accent-accent" />
                        <span className="text-sm font-mono text-text-primary">{powerSetpointMW} MW</span>
                      </div>
                    )}
                    {activePowerMode === "delta_control" && (
                      <div>
                        <label className="text-xs text-text-muted block mb-1">Delta Reserve [MW]</label>
                        <input type="range" min={0} max={100} step={5} value={deltaReserveMW} onChange={(e) => setDeltaReserveMW(Number(e.target.value))} className="w-full accent-accent" />
                        <span className="text-sm font-mono text-text-primary">{deltaReserveMW} MW</span>
                      </div>
                    )}
                    {activePowerMode === "absolute_limitation" && (
                      <div>
                        <label className="text-xs text-text-muted block mb-1">Absolute Limit [MW]</label>
                        <input type="range" min={0} max={510} step={10} value={absoluteLimitMW} onChange={(e) => setAbsoluteLimitMW(Number(e.target.value))} className="w-full accent-accent" />
                        <span className="text-sm font-mono text-text-primary">{absoluteLimitMW} MW</span>
                      </div>
                    )}
                    {activePowerMode === "ramp_rate_control" && (
                      <div>
                        <label className="text-xs text-text-muted block mb-1">Power Setpoint [MW]</label>
                        <input type="range" min={0} max={510} step={10} value={powerSetpointMW} onChange={(e) => setPowerSetpointMW(Number(e.target.value))} className="w-full accent-accent" />
                        <span className="text-sm font-mono text-text-primary">{powerSetpointMW} MW</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Wind & Turbines */}
              <Card>
                <CardHeader><CardTitle>Operating Conditions</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-text-muted block mb-1">Wind Speed [m/s]</label>
                      <input type="range" min={0} max={35} step={0.5} value={windSpeedMS} onChange={(e) => setWindSpeedMS(Number(e.target.value))} className="w-full accent-accent" />
                      <span className="text-sm font-mono text-text-primary">{windSpeedMS} m/s</span>
                    </div>
                    <div>
                      <label className="text-xs text-text-muted block mb-1">Online Turbines</label>
                      <input type="range" min={0} max={34} step={1} value={availableTurbines} onChange={(e) => setAvailableTurbines(Number(e.target.value))} className="w-full accent-accent" />
                      <span className="text-sm font-mono text-text-primary">{availableTurbines} / 34</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Reactive Power Mode */}
              <Card>
                <CardHeader><CardTitle>Reactive Power Mode</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {REACTIVE_POWER_MODES.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                        <input type="radio" name="rp_mode" value={opt.value} checked={reactivePowerMode === opt.value} onChange={() => setReactivePowerMode(opt.value)} className="accent-accent" />
                        <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Run PPC Simulation */}
              <Button onClick={runSimulation} disabled={loading} className="w-full py-3" size="lg">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Simulating PPC...
                  </span>
                ) : simulationRun ? "Re-run PPC Simulation" : "Run PPC Simulation"}
              </Button>
            </ControlDrawer>
          )}

          <TrainingGuide guide={p2Guide} />
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 p-1 bg-bg-secondary rounded-lg border border-border-primary w-fit">
        <button
          onClick={() => setActiveTab("grid")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "grid"
              ? "bg-accent text-white"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
          }`}
        >
          <Zap size={14} />
          Grid Analysis
        </button>
        <button
          onClick={() => setActiveTab("ppc")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "ppc"
              ? "bg-accent text-white"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
          }`}
        >
          <Radio size={14} />
          Power Plant Controller
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-3 bg-status-alarm/10 border border-status-alarm/30 rounded-lg text-sm flex justify-between items-center">
          <span className="text-status-alarm">{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}

      {/* ── Grid Analysis Tab — Full Width ──────────────────────── */}
      {activeTab === "grid" && (
        <>
          {analysisRun ? (
            <GridDashboard />
          ) : (
            <div className="flex items-center justify-center h-96 rounded-lg border border-border-primary bg-bg-secondary shadow-lg shadow-black/20">
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <Zap size={24} className="text-accent" />
                  </div>
                </div>
                <p className="text-text-secondary text-base mb-2">
                  Configure scenarios and run analysis
                </p>
                <p className="text-text-muted text-sm">
                  Select load flow scenario, FRT type, and grid strength,
                  then click &quot;Run Analysis&quot;
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── PPC Tab — Full Width ─────────────────────────────────── */}
      {activeTab === "ppc" && (
        <>
          {simulationRun ? (
            <PPCDashboard />
          ) : (
            <div className="flex items-center justify-center h-96 rounded-lg border border-border-primary bg-bg-secondary shadow-lg shadow-black/20">
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <Radio size={24} className="text-accent" />
                  </div>
                </div>
                <p className="text-text-secondary text-base mb-2">
                  Configure TSO dispatch and run PPC simulation
                </p>
                <p className="text-text-muted text-sm">
                  Set power setpoint, wind speed, control mode,
                  then click &quot;Run PPC Simulation&quot;
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
