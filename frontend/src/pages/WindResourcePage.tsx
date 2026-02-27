/**
 * Wind Resource page — route /wind-resource.
 *
 * Loads turbine spec on mount. Shows parameter controls and
 * "Run Analysis" button. Once analysis is run, renders the
 * full WindResourceDashboard with all 7 chart panels.
 */

import { useEffect } from "react";

import WindResourceDashboard from "../components/p1/WindResourceDashboard";
import SensitivityPanel from "../components/p1/SensitivityPanel";
import { useWindResourceStore } from "../store/windResourceStore";

export default function WindResourcePage() {
  const {
    turbineSpec,
    loading,
    error,
    analysisRun,
    fetchTurbineSpec,
    runFullAnalysis,
    clearError,
  } = useWindResourceStore();

  useEffect(() => {
    fetchTurbineSpec();
  }, [fetchTurbineSpec]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">P1 · Wind Resource & AEP</h2>
        <p className="text-xs text-slate-400 mt-1">
          34 × V236-15.0 MW · Baltic Sea · PyWake BPA Gaussian ·{" "}
          {turbineSpec
            ? `D=${turbineSpec.rotor_diameter_m}m, H=${turbineSpec.hub_height_m}m`
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
            <WindResourceDashboard />
          ) : (
            <div className="flex items-center justify-center h-96 bg-slate-800 rounded-lg border border-slate-700">
              <div className="text-center">
                <p className="text-slate-400 text-lg mb-2">
                  Configure parameters and run analysis
                </p>
                <p className="text-slate-500 text-sm">
                  Adjust Weibull A/k, turbulence intensity, and electricity
                  price, then click &quot;Run Analysis&quot;
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Controls (1/3 width) */}
        <div className="space-y-4">
          <SensitivityPanel />

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
        </div>
      </div>
    </div>
  );
}
