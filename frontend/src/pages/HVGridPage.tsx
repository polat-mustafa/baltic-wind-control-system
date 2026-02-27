/**
 * HV Grid Integration page — route /hv-grid.
 *
 * Loads network spec on mount. Shows scenario selectors and
 * "Run Analysis" button. Once analysis is run, renders the
 * full GridDashboard with all 6 chart panels.
 */

import { useEffect } from "react";

import GridDashboard from "../components/p2/GridDashboard";
import { useGridStore } from "../store/gridStore";

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
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">P2 · HV Grid Integration</h2>
        <p className="text-xs text-slate-400 mt-1">
          {networkSpec
            ? `${networkSpec.total_capacity_mw} MW · ${networkSpec.array_voltage_kv}/${networkSpec.export_voltage_kv}/${networkSpec.grid_voltage_kv} kV · ${networkSpec.export_length_km} km export · Pandapower + ANDES`
            : "Loading..."}
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm flex justify-between">
          <span>{error}</span>
          <button
            onClick={clearError}
            className="text-red-400 hover:text-red-200 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main grid: controls on right, charts on left */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Left: Dashboard charts (2/3 width) */}
        <div className="xl:col-span-2">
          {analysisRun ? (
            <GridDashboard />
          ) : (
            <div className="flex items-center justify-center h-96 bg-slate-800 rounded-lg border border-slate-700">
              <div className="text-center">
                <p className="text-slate-400 text-lg mb-2">
                  Configure scenarios and run analysis
                </p>
                <p className="text-slate-500 text-sm">
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
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Load Flow Scenario
            </h3>
            <div className="space-y-2">
              {SCENARIO_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="scenario"
                    value={opt.value}
                    checked={activeScenario === opt.value}
                    onChange={() => setActiveScenario(opt.value)}
                    className="accent-blue-500"
                  />
                  <span className="text-sm text-slate-300">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* FRT selector */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Fault Ride-Through Type
            </h3>
            <div className="space-y-2">
              {FRT_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="frt"
                    value={opt.value}
                    checked={frtType === opt.value}
                    onChange={() => setFrtType(opt.value)}
                    className="accent-blue-500"
                  />
                  <span className="text-sm text-slate-300">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Converter scenario selector */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Grid Strength (GFL vs GFM)
            </h3>
            <div className="space-y-2">
              {CONVERTER_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="converter"
                    value={opt.value}
                    checked={converterScenario === opt.value}
                    onChange={() => setConverterScenario(opt.value)}
                    className="accent-blue-500"
                  />
                  <span className="text-sm text-slate-300">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Run Analysis button */}
          <button
            onClick={runFullAnalysis}
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-sm font-semibold transition-colors"
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
          </button>

          {/* Reference box */}
          <div className="bg-slate-900/50 rounded-lg border border-slate-700 p-3">
            <p className="text-xs text-slate-500">
              <strong>Standards:</strong> PSE IRiESP (0.95-1.05 pu), IEC 60909,
              ENTSO-E NC RfG Type D, IEC 62271-100
            </p>
            <p className="text-xs text-slate-500 mt-1">
              <strong>Tools:</strong> Pandapower (steady-state), ANDES (dynamic)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
