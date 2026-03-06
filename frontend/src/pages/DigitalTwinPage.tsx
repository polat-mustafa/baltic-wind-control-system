/**
 * DigitalTwinPage — route /digital-twin.
 *
 * Loads config + scenarios on mount. Shows scenario selector sidebar
 * with controls, and DigitalTwinDashboard once analysis completes.
 *
 * Follows the TurbinePhysicsPage pattern: 2/3 dashboard + 1/3 controls.
 */

import { useEffect } from "react";
import { Cpu } from "lucide-react";

import DigitalTwinDashboard from "../components/digital-twin/DigitalTwinDashboard";
import { useDigitalTwinStore } from "../store/digitalTwinStore";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";

const SCENARIO_LABELS: Record<string, string> = {
  healthy: "Healthy Baseline",
  blade_icing: "Blade Icing",
  gearbox_degradation: "Gearbox Degradation",
  pitch_malfunction: "Pitch Malfunction",
  generator_derating: "Generator Derating",
  sensor_drift: "Sensor Drift",
};

export default function DigitalTwinPage() {
  const config = useDigitalTwinStore((s) => s.config);
  const loading = useDigitalTwinStore((s) => s.loading);
  const error = useDigitalTwinStore((s) => s.error);
  const analysisRun = useDigitalTwinStore((s) => s.analysisRun);
  const progress = useDigitalTwinStore((s) => s.progress);
  const progressMessage = useDigitalTwinStore((s) => s.progressMessage);
  const selectedScenario = useDigitalTwinStore((s) => s.selectedScenario);
  const numTimesteps = useDigitalTwinStore((s) => s.numTimesteps);
  const numTurbines = useDigitalTwinStore((s) => s.numTurbines);
  const setSelectedScenario = useDigitalTwinStore((s) => s.setSelectedScenario);
  const setNumTimesteps = useDigitalTwinStore((s) => s.setNumTimesteps);
  const setNumTurbines = useDigitalTwinStore((s) => s.setNumTurbines);
  const fetchConfig = useDigitalTwinStore((s) => s.fetchConfig);
  const fetchScenarios = useDigitalTwinStore((s) => s.fetchScenarios);
  const runAnalysis = useDigitalTwinStore((s) => s.runAnalysis);
  const clearError = useDigitalTwinStore((s) => s.clearError);

  useEffect(() => {
    fetchConfig();
    fetchScenarios();
  }, [fetchConfig, fetchScenarios]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-text-primary">
          Digital Twin
        </h2>
        <p className="text-xs text-text-muted mt-1 font-mono">
          {config
            ? `ISO 13374-1 Condition Monitoring | EWMA span=${config.ewma_span} | Weights: P=${config.health_weights.power} R=${config.health_weights.rpm} Pi=${config.health_weights.pitch}`
            : "Loading configuration..."}
        </p>
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

      {/* Main grid: charts on left, controls on right */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left: Dashboard (2/3 width) */}
        <div className="xl:col-span-2">
          {analysisRun ? (
            <DigitalTwinDashboard />
          ) : (
            <div className="flex items-center justify-center h-96 rounded-lg border border-border-primary bg-bg-secondary shadow-lg shadow-black/20">
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <Cpu size={24} className="text-accent" />
                  </div>
                </div>
                <p className="text-text-secondary text-base mb-2">
                  Select a scenario and run analysis
                </p>
                <p className="text-text-muted text-sm">
                  The digital twin compares physics predictions against
                  SCADA data to detect anomalies
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Controls (1/3 width) */}
        <div className="space-y-4">
          {/* Scenario selector */}
          <Card>
            <CardHeader>
              <CardTitle>Fault Scenario</CardTitle>
            </CardHeader>
            <CardContent>
              <select
                value={selectedScenario}
                onChange={(e) => setSelectedScenario(e.target.value)}
                className="w-full bg-bg-tertiary border border-border-secondary rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {Object.entries(SCENARIO_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-text-muted mt-2">
                {selectedScenario === "healthy" && "No faults — all turbines operate normally."}
                {selectedScenario === "blade_icing" && "WTG-05 to WTG-08: 20-40% power loss from ice."}
                {selectedScenario === "gearbox_degradation" && "WTG-12: progressive 5% efficiency loss."}
                {selectedScenario === "pitch_malfunction" && "WTG-20: pitch stuck at 5 degrees."}
                {selectedScenario === "generator_derating" && "WTG-28: generator capped at 12 MW."}
                {selectedScenario === "sensor_drift" && "WTG-15: anemometer reads 8% high."}
              </p>
            </CardContent>
          </Card>

          {/* Analysis settings */}
          <Card>
            <CardHeader>
              <CardTitle>Analysis Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <NumberInput
                  label="Timesteps"
                  unit="× 10min"
                  value={numTimesteps}
                  onChange={setNumTimesteps}
                  min={24}
                  max={1000}
                  step={24}
                />
                <NumberInput
                  label="Turbines"
                  unit="WTGs"
                  value={numTurbines}
                  onChange={setNumTurbines}
                  min={5}
                  max={34}
                  step={1}
                />
              </div>
            </CardContent>
          </Card>

          {/* Run Analysis button */}
          <Button
            onClick={runAnalysis}
            disabled={loading}
            className="w-full py-3"
            size="lg"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyzing...
              </span>
            ) : analysisRun ? (
              "Re-run Analysis"
            ) : (
              "Run Analysis"
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
                {progressMessage || "Initializing..."}
              </p>
            </div>
          )}

          {/* Quick Reference */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-medium text-text-secondary">Digital Twin</span>
                  <span className="text-text-muted">
                    {" "}
                    — Virtual replica predicting expected behavior from physics
                  </span>
                </div>
                <div>
                  <span className="font-medium text-text-secondary">Residual</span>
                  <span className="text-text-muted">
                    {" "}
                    — Actual minus predicted. Persistent deviation = fault
                  </span>
                </div>
                <div>
                  <span className="font-medium text-text-secondary">EWMA</span>
                  <span className="text-text-muted">
                    {" "}
                    — Exponentially Weighted Moving Average (span=24, ~4 hours)
                  </span>
                </div>
                <hr className="border-border-primary" />
                <div>
                  <span className="font-medium text-text-secondary">Health Score</span>
                  <span className="text-text-muted">
                    {" "}
                    — H = 100 x exp(-|EWMA| / sigma). Weighted: 50% power, 30% rpm, 20% pitch
                  </span>
                </div>
                <div>
                  <span className="font-medium text-text-secondary">ISO 13374-1</span>
                  <span className="text-text-muted">
                    {" "}
                    — Condition monitoring standard: Data → Detection → Assessment → Prognosis
                  </span>
                </div>
                <div>
                  <span className="font-medium text-text-secondary">RUL</span>
                  <span className="text-text-muted">
                    {" "}
                    — Remaining Useful Life = (health - threshold) / |slope|
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
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
        <span className="text-[10px] text-text-muted w-12">{unit}</span>
      </div>
    </div>
  );
}
