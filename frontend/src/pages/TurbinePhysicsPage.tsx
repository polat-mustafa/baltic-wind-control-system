/**
 * Turbine Physics page — route /turbine-physics.
 *
 * Loads turbine config + Cp surface on mount. Controls live in a
 * slide-out drawer. Dashboard renders at full width once simulation completes.
 */

import { useEffect } from "react";
import { Activity } from "lucide-react";

import TurbinePhysicsDashboard from "../components/turbine-physics/TurbinePhysicsDashboard";
import { useTurbinePhysicsStore } from "../store/turbinePhysicsStore";
import { Button } from "../components/ui/Button";
import { TrainingGuide } from "../components/ui/TrainingGuide";
import { ControlDrawer } from "../components/ui/ControlDrawer";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { turbinePhysicsGuide } from "../constants/trainingGuideContent";

const SCENARIO_OPTIONS = [
  { value: "constant", label: "Constant Wind" },
  { value: "step_response", label: "Step Response" },
  { value: "oscillating", label: "Oscillating Wind" },
] as const;

export default function TurbinePhysicsPage() {
  const {
    config,
    loading,
    error,
    analysisRun,
    progress,
    progressMessage,
    scenario,
    constantWindMs,
    stepInitMs,
    stepFinalMs,
    stepRampS,
    stepTotalS,
    oscMeanMs,
    oscAmplitudeMs,
    oscPeriodS,
    oscDurationS,
    dt,
    initialRotorSpeedRpm,
    airDensityKgM3,
    setScenario,
    setConstantWindMs,
    setStepInitMs,
    setStepFinalMs,
    setStepRampS,
    setStepTotalS,
    setOscMeanMs,
    setOscAmplitudeMs,
    setOscPeriodS,
    setOscDurationS,
    setDt,
    setInitialRotorSpeedRpm,
    setAirDensityKgM3,
    fetchConfig,
    fetchCpSurface,
    runSimulation,
    clearError,
  } = useTurbinePhysicsStore();

  useEffect(() => {
    fetchConfig();
    fetchCpSurface();
  }, [fetchConfig, fetchCpSurface]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-text-primary">
            Turbine Physics
          </h2>
          <p className="text-xs text-text-muted mt-1 font-mono">
            {config
              ? `${config.turbine_name} · ${config.rated_power_mw} MW · D=${config.rotor_diameter_m}m · Cut-in ${config.cut_in_speed_ms} / Rated ${config.rated_speed_ms} / Cut-out ${config.cut_out_speed_ms} m/s`
              : "Loading turbine config..."}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
            ) : analysisRun ? (
              "Re-run"
            ) : (
              "Run Simulation"
            )}
          </Button>
          <ControlDrawer
            title="Physics Controls"
            subtitle="Wind scenario & simulation settings"
            footer={
              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-medium text-text-secondary">Cp</span>
                  <span className="text-text-muted">
                    {" "}— Power coefficient. Fraction of wind kinetic energy captured by rotor
                  </span>
                </div>
                <div>
                  <span className="font-medium text-text-secondary">TSR (λ)</span>
                  <span className="text-text-muted">
                    {" "}— Tip-Speed Ratio = ωR/V. Optimal ≈ 7–9 for modern turbines
                  </span>
                </div>
                <div>
                  <span className="font-medium text-text-secondary">Betz Limit</span>
                  <span className="text-text-muted">
                    {" "}— Max theoretical Cp = 16/27 ≈ 0.593
                  </span>
                </div>
              </div>
            }
          >
            {/* Wind Scenario selector */}
            <Card>
              <CardHeader>
                <CardTitle>Wind Scenario</CardTitle>
              </CardHeader>
              <CardContent>
                <select
                  value={scenario}
                  onChange={(e) =>
                    setScenario(
                      e.target.value as "constant" | "step_response" | "oscillating",
                    )
                  }
                  className="w-full bg-bg-tertiary border border-border-secondary rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  {SCENARIO_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {/* Conditional inputs per scenario */}
                <div className="mt-3 space-y-2">
                  {scenario === "constant" && (
                    <NumberInput
                      label="Wind Speed"
                      unit="m/s"
                      value={constantWindMs}
                      onChange={setConstantWindMs}
                      min={0}
                      max={35}
                      step={0.5}
                    />
                  )}

                  {scenario === "step_response" && (
                    <>
                      <NumberInput
                        label="Initial Wind"
                        unit="m/s"
                        value={stepInitMs}
                        onChange={setStepInitMs}
                        min={0}
                        max={35}
                        step={0.5}
                      />
                      <NumberInput
                        label="Final Wind"
                        unit="m/s"
                        value={stepFinalMs}
                        onChange={setStepFinalMs}
                        min={0}
                        max={35}
                        step={0.5}
                      />
                      <NumberInput
                        label="Ramp Duration"
                        unit="s"
                        value={stepRampS}
                        onChange={setStepRampS}
                        min={0.1}
                        max={300}
                        step={1}
                      />
                      <NumberInput
                        label="Total Duration"
                        unit="s"
                        value={stepTotalS}
                        onChange={setStepTotalS}
                        min={1}
                        max={3600}
                        step={10}
                      />
                    </>
                  )}

                  {scenario === "oscillating" && (
                    <>
                      <NumberInput
                        label="Mean Wind"
                        unit="m/s"
                        value={oscMeanMs}
                        onChange={setOscMeanMs}
                        min={0}
                        max={35}
                        step={0.5}
                      />
                      <NumberInput
                        label="Amplitude"
                        unit="m/s"
                        value={oscAmplitudeMs}
                        onChange={setOscAmplitudeMs}
                        min={0}
                        max={15}
                        step={0.5}
                      />
                      <NumberInput
                        label="Period"
                        unit="s"
                        value={oscPeriodS}
                        onChange={setOscPeriodS}
                        min={1}
                        max={300}
                        step={1}
                      />
                      <NumberInput
                        label="Duration"
                        unit="s"
                        value={oscDurationS}
                        onChange={setOscDurationS}
                        min={1}
                        max={3600}
                        step={10}
                      />
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Simulation Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Simulation Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <NumberInput
                    label="Timestep (dt)"
                    unit="s"
                    value={dt}
                    onChange={setDt}
                    min={0.01}
                    max={10}
                    step={0.01}
                  />
                  <NumberInput
                    label="Initial Rotor Speed"
                    unit="rpm"
                    value={initialRotorSpeedRpm}
                    onChange={setInitialRotorSpeedRpm}
                    min={0}
                    max={15}
                    step={0.5}
                  />
                  <NumberInput
                    label="Air Density"
                    unit="kg/m³"
                    value={airDensityKgM3}
                    onChange={setAirDensityKgM3}
                    min={0.8}
                    max={1.6}
                    step={0.005}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Run Simulation button + progress */}
            <Button
              onClick={runSimulation}
              disabled={loading}
              className="w-full py-3"
              size="lg"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Running Simulation...
                </span>
              ) : analysisRun ? (
                "Re-run Simulation"
              ) : (
                "Run Simulation"
              )}
            </Button>

            {/* Progress bar */}
            {loading && (
              <div className="rounded-lg border border-border-primary bg-bg-secondary p-3 space-y-2">
                <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-text-muted text-center font-mono">
                  {progressMessage || "Initialising simulation..."}
                </p>
              </div>
            )}
          </ControlDrawer>
          <TrainingGuide guide={turbinePhysicsGuide} />
        </div>
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

      {/* Progress bar (visible inline when loading) */}
      {loading && (
        <div className="rounded-lg border border-border-primary bg-bg-secondary p-3 space-y-2">
          <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-text-muted text-center font-mono">
            {progressMessage || "Initialising simulation..."}
          </p>
        </div>
      )}

      {/* Full-width dashboard */}
      {analysisRun ? (
        <TurbinePhysicsDashboard />
      ) : (
        <div className="flex items-center justify-center h-96 rounded-lg border border-border-primary bg-bg-secondary shadow-lg shadow-black/20">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                <Activity size={24} className="text-accent" />
              </div>
            </div>
            <p className="text-text-secondary text-base mb-2">
              Configure parameters and run simulation
            </p>
            <p className="text-text-muted text-sm">
              Select wind scenario, adjust settings, then click
              &quot;Run Simulation&quot;
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper: Inline Number Input ─────────────────────────────────

function NumberInput({
  label,
  unit,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="text-xs text-text-secondary whitespace-nowrap">
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-20 bg-bg-tertiary border border-border-secondary rounded-md px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent font-mono text-right"
        />
        <span className="text-[10px] text-text-muted w-8">{unit}</span>
      </div>
    </div>
  );
}
