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
import { PageHeader } from "../components/layout/PageHeader";
import { PageTabs, type PageTab } from "../components/layout/PageTabs";
import { useAutoRun } from "../hooks/useAutoRun";

type Tab = "aep" | "farms" | "ops";

const TABS: PageTab<Tab>[] = [
  { id: "aep", label: "AEP Analysis", Icon: Wind },
  { id: "farms", label: "Farm Comparison", Icon: BarChart2 },
  { id: "ops", label: "Availability & O&M", Icon: Wrench },
];

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
  // Open with results: PyWake for the 34 turbines takes a few seconds
  useAutoRun(!analysisRun && !loading && !error, runFullAnalysis);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Wind Resource & AEP"
        description="The wind climate at the site, PyWake wake losses and the farm's energy yield with its uncertainty (P50 / P90)."
        meta={turbineSpec ? `34 × 15 MW IEA-15-240-RWT · Baltic Sea · PyWake BPA Gaussian · D ${turbineSpec.rotor_diameter_m} m · hub ${turbineSpec.hub_height_m} m` : undefined}
        actions={
          <>
            <div className="flex items-center gap-2 shrink-0">
              {activeTab === "aep" && (
                <>
                  <Button onClick={runFullAnalysis} disabled={loading} size="sm" data-tour="run-button">
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
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
                          <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
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
          </>
        }
      />

      <PageTabs tabs={TABS} value={activeTab} onChange={setActiveTab} />

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
