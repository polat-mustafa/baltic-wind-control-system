/**
 * Wind Resource page — route /wind-resource.
 *
 * Three tabs:
 *   "AEP Analysis"     — animated AEP explainer + PyWake Weibull analysis (WindResourceDashboard)
 *   "Farm Comparison"  — M04 multi-farm AEP/LCOE comparison (FarmComparisonDashboard)
 *   "Availability & O&M" — M13 IEC 61400-26 availability + M14 weather windows / O&M cost
 *
 * Controls live in a slide-out drawer (AEP tab only).
 */

import { useEffect, useState } from "react";
import { BarChart2, Wrench, Wind } from "lucide-react";

import AEPExplainer from "../components/p1/AEPExplainer";
import WindResourceDashboard from "../components/p1/WindResourceDashboard";
import SensitivityPanel from "../components/p1/SensitivityPanel";
import FarmComparisonDashboard from "../components/p1/FarmComparisonDashboard";
import OperationsTab from "../components/p1/OperationsTab";
import { useWindResourceStore } from "../store/windResourceStore";
import { Button } from "../components/ui/Button";
import { TrainingGuide } from "../components/ui/TrainingGuide";
import { ControlDrawer } from "../components/ui/ControlDrawer";
import { p1Guide } from "../constants/trainingGuideContent";

type Tab = "aep" | "farms" | "ops";

export default function WindResourcePage() {
  const [activeTab, setActiveTab] = useState<Tab>("aep");

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
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-text-primary">
            Wind Resource & AEP
          </h2>
          <p className="text-xs text-text-muted mt-1 font-mono">
            34 × V236-15.0 MW · Baltic Sea · PyWake BPA Gaussian ·{" "}
            {turbineSpec
              ? `D=${turbineSpec.rotor_diameter_m}m, H=${turbineSpec.hub_height_m}m`
              : "Loading..."}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {activeTab === "aep" && (
            <>
              <Button onClick={runFullAnalysis} disabled={loading} size="sm">
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
            </>
          )}
          <TrainingGuide guide={p1Guide} />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-bg-secondary rounded-lg border border-border-primary w-fit max-w-full overflow-x-auto">
        <button
          onClick={() => setActiveTab("aep")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "aep"
              ? "bg-accent text-white"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
          }`}
        >
          <Wind size={14} />
          AEP Analysis
        </button>
        <button
          onClick={() => setActiveTab("farms")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "farms"
              ? "bg-accent text-white"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
          }`}
        >
          <BarChart2 size={14} />
          Farm Comparison
        </button>
        <button
          onClick={() => setActiveTab("ops")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "ops"
              ? "bg-accent text-white"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
          }`}
        >
          <Wrench size={14} />
          Availability &amp; O&amp;M
        </button>
      </div>

      {/* Error banner (AEP tab only) */}
      {error && activeTab === "aep" && (
        <div className="p-3 bg-status-alarm/10 border border-status-alarm/30 rounded-lg text-sm flex justify-between items-center">
          <span className="text-status-alarm">{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}

      {/* ── AEP Analysis tab ─────────────────────────────────── */}
      {activeTab === "aep" && (
        <>
          <AEPExplainer />
          {analysisRun ? (
            <WindResourceDashboard />
          ) : (
            <div className="flex items-center justify-center h-48 rounded-lg border border-border-primary bg-bg-secondary shadow-lg shadow-black/20">
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <Wind size={24} className="text-accent" />
                  </div>
                </div>
                <p className="text-text-secondary text-base mb-2">
                  Now run it for the real farm
                </p>
                <p className="text-text-muted text-sm max-w-md">
                  &quot;Run Analysis&quot; places all 34 turbines, runs the PyWake
                  wake model and the full loss cascade with the A/k above.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Farm Comparison tab ───────────────────────────────── */}
      {activeTab === "farms" && <FarmComparisonDashboard />}

      {/* ── Availability & O&M tab (M13 + M14) ─────────────────── */}
      {activeTab === "ops" && <OperationsTab />}
    </div>
  );
}
