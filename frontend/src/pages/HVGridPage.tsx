/**
 * HV Grid Integration page — route /hv-grid.
 *
 * Loads network spec on mount. Shows scenario selectors and
 * "Run Analysis" button. Once analysis is run, renders the
 * full GridDashboard with all 6 chart panels.
 */

import { useEffect } from "react";
import { Zap } from "lucide-react";

import GridDashboard from "../components/p2/GridDashboard";
import { useGridStore } from "../store/gridStore";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";

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

export default function HVGridPage() {
  const {
    networkSpec,
    loading,
    error,
    analysisRun,
    activeScenario,
    frtType,
    converterScenario,
    setActiveScenario,
    setFrtType,
    setConverterScenario,
    fetchNetworkSpec,
    runFullAnalysis,
    clearError,
  } = useGridStore();

  useEffect(() => {
    fetchNetworkSpec();
  }, [fetchNetworkSpec]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-text-primary">
          P2 · HV Grid Integration
        </h2>
        <p className="text-xs text-text-muted mt-1 font-mono">
          {networkSpec
            ? `${networkSpec.total_capacity_mw} MW · ${networkSpec.array_voltage_kv}/${networkSpec.export_voltage_kv}/${networkSpec.grid_voltage_kv} kV · ${networkSpec.export_length_km} km export · Pandapower + ANDES`
            : "Loading..."}
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

      {/* Main grid: controls on right, charts on left */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left: Dashboard charts (2/3 width) */}
        <div className="xl:col-span-2">
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
        </div>

        {/* Right: Controls (1/3 width) */}
        <div className="space-y-4">
          {/* Scenario selector */}
          <Card>
            <CardHeader>
              <CardTitle>Load Flow Scenario</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {SCENARIO_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <input
                      type="radio"
                      name="scenario"
                      value={opt.value}
                      checked={activeScenario === opt.value}
                      onChange={() => setActiveScenario(opt.value)}
                      className="accent-accent"
                    />
                    <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* FRT selector */}
          <Card>
            <CardHeader>
              <CardTitle>Fault Ride-Through</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {FRT_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <input
                      type="radio"
                      name="frt"
                      value={opt.value}
                      checked={frtType === opt.value}
                      onChange={() => setFrtType(opt.value)}
                      className="accent-accent"
                    />
                    <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Converter scenario selector */}
          <Card>
            <CardHeader>
              <CardTitle>Grid Strength</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {CONVERTER_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <input
                      type="radio"
                      name="converter"
                      value={opt.value}
                      checked={converterScenario === opt.value}
                      onChange={() => setConverterScenario(opt.value)}
                      className="accent-accent"
                    />
                    <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Run Analysis button */}
          <Button
            onClick={runFullAnalysis}
            disabled={loading}
            className="w-full py-3"
            size="lg"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Running Analysis...
              </span>
            ) : analysisRun ? (
              "Re-run Analysis"
            ) : (
              "Run Analysis"
            )}
          </Button>

          {/* Reference box */}
          <div className="rounded-lg border border-border-primary bg-bg-tertiary p-3">
            <p className="text-xs text-text-muted">
              <span className="font-medium text-text-secondary">Standards:</span>{" "}
              PSE IRiESP (0.95-1.05 pu), IEC 60909, ENTSO-E NC RfG Type D
            </p>
            <p className="text-xs text-text-muted mt-1">
              <span className="font-medium text-text-secondary">Tools:</span>{" "}
              Pandapower (steady-state), ANDES (dynamic)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
