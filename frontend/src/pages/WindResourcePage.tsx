/**
 * Wind Resource page — route /wind-resource.
 *
 * Loads turbine spec on mount. Controls live in a slide-out drawer.
 * Once analysis is run, renders the full WindResourceDashboard
 * with all 7 chart panels at full width.
 */

import { useEffect } from "react";
import { Wind } from "lucide-react";

import WindResourceDashboard from "../components/p1/WindResourceDashboard";
import SensitivityPanel from "../components/p1/SensitivityPanel";
import { useWindResourceStore } from "../store/windResourceStore";
import { Button } from "../components/ui/Button";
import { TrainingGuide } from "../components/ui/TrainingGuide";
import { ControlDrawer } from "../components/ui/ControlDrawer";
import { p1Guide } from "../constants/trainingGuideContent";

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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-text-primary">
            P1 · Wind Resource & AEP
          </h2>
          <p className="text-xs text-text-muted mt-1 font-mono">
            34 × V236-15.0 MW · Baltic Sea · PyWake BPA Gaussian ·{" "}
            {turbineSpec
              ? `D=${turbineSpec.rotor_diameter_m}m, H=${turbineSpec.hub_height_m}m`
              : "Loading..."}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
          <ControlDrawer
            title="Wind Resource Controls"
            subtitle="Weibull parameters, turbulence & pricing"
          >
            <SensitivityPanel />

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
          </ControlDrawer>
          <TrainingGuide guide={p1Guide} />
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

      {/* Full-width dashboard */}
      {analysisRun ? (
        <WindResourceDashboard />
      ) : (
        <div className="flex items-center justify-center h-96 rounded-lg border border-border-primary bg-bg-secondary shadow-lg shadow-black/20">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                <Wind size={24} className="text-accent" />
              </div>
            </div>
            <p className="text-text-secondary text-base mb-2">
              Configure parameters and run analysis
            </p>
            <p className="text-text-muted text-sm max-w-md">
              Adjust Weibull A/k, turbulence intensity, and electricity
              price, then click &quot;Run Analysis&quot;
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
