/**
 * HV Grid Integration page — route /hv-grid.
 *
 * Seven tabs:
 *   grid          — Pandapower load-flow + FRT + N-1 (existing)
 *   ppc           — Power Plant Controller dispatch (existing)
 *   protection    — M05 relay coordination + TCC curves
 *   power-quality — M06 harmonics, resonance, flicker (IEC 61000)
 *   bess          — M08 50 MW / 200 MWh LFP BESS (FCR/FFR/ramp)
 *   cable-dts     — M10 IEC 60287 cable thermal monitoring
 *   market        — M11 TGE day-ahead bid + revenue + ancillary
 *
 * New module tabs are self-contained (useEffect on mount); no drawer needed.
 */

import { useEffect, useState } from "react";
import {
  Activity,
  Battery,
  Cable,
  FlaskConical,
  Network,
  Radio,
  ShieldCheck,
  TrendingUp,
  Zap,
  BookOpen,
} from "lucide-react";

import GridDashboard from "../components/p2/GridDashboard";
import PPCDashboard from "../components/p2/PPCDashboard";
import ProtectionDashboard from "../components/p2/ProtectionDashboard";
import PowerQualityDashboard from "../components/p2/PowerQualityDashboard";
import BESSDashboard from "../components/p2/BESSDashboard";
import CableDTSDashboard from "../components/p2/CableDTSDashboard";
import MarketDashboard from "../components/p2/MarketDashboard";
import AdvancedAnalysisTab from "../components/p2/AdvancedAnalysisTab";
import PlanningCouplingTab from "../components/p2/PlanningCouplingTab";
import { useGridStore } from "../store/gridStore";
import { usePPCStore } from "../store/ppcStore";
import { Button } from "../components/ui/Button";
import { TrainingGuide } from "../components/ui/TrainingGuide";
import { p2Guide } from "../constants/trainingGuideContent";
import { EducationPanel } from "../components/ui/EducationPanel";
import { hvacVsHvdcEducation } from "../constants/education/library/hvacVsHvdc";
import { statcomSizingEducation } from "../constants/education/library/statcomSizing";
import { arrayVoltageEducation } from "../constants/education/library/arrayVoltage";
import { cableCrossSectionEducation } from "../constants/education/library/cableCrossSection";


type Tab =
  | "grid"
  | "ppc"
  | "protection"
  | "power-quality"
  | "bess"
  | "cable-dts"
  | "market"
  | "advanced"
  | "planning";

const TABS: { id: Tab; label: string; Icon: React.FC<{ size?: number }>; tooltip: string }[] = [
  { id: "grid",          label: "Grid Analysis",    Icon: Zap,           tooltip: "Load flow, reactive power vs PSE range, IEC 60909 breaker duty, FRT, GFL vs GFM" },
  { id: "ppc",           label: "PPC",              Icon: Radio,         tooltip: "Power Plant Controller — TSO dispatch, LFSM/FSM frequency response, voltage control (PSE NC RfG)" },
  { id: "protection",    label: "Protection",       Icon: ShieldCheck,   tooltip: "Relay coordination, TCC curves, selectivity grading (IEC 60255)" },
  { id: "power-quality", label: "Power Quality",    Icon: Activity,      tooltip: "Harmonics, resonance scan, flicker at 66 kV POC (IEC 61000-3-6 / 3-7)" },
  { id: "bess",          label: "BESS",             Icon: Battery,       tooltip: "Battery Energy Storage System — 50 MW / 200 MWh LFP, FCR/FFR, ramp smoothing" },
  { id: "cable-dts",     label: "Cable DTS",        Icon: Cable,         tooltip: "Distributed Temperature Sensing — IEC 60287 dynamic ampacity, 45 km export cable" },
  { id: "market",        label: "Market",           Icon: TrendingUp,    tooltip: "One trading day: TGE day-ahead, PSE imbalance (CEN), two-sided CfD, BESS arbitrage" },
  { id: "advanced",      label: "Advanced",         Icon: FlaskConical,  tooltip: "Dynamic compliance, OPF/SCOPF, DC PF, SSO screening, ANDES network spec" },
  { id: "planning",      label: "Planning & P2X",   Icon: Network,       tooltip: "Economic dispatch, capacity expansion, sector coupling, electrolyzer, LDES" },
];

export default function HVGridPage() {
  const [activeTab, setActiveTab] = useState<Tab>("grid");
  const [libraryEntry, setLibraryEntry] = useState<
    typeof hvacVsHvdcEducation | typeof statcomSizingEducation | typeof arrayVoltageEducation | typeof cableCrossSectionEducation | null
  >(null);

  // Grid store (existing P2)
  const {
    networkSpec,
    loading: gridLoading,
    error: gridError,
    analysisRun,
    fetchNetworkSpec,
    runFullAnalysis,
    clearError: clearGridError,
  } = useGridStore();

  // PPC store (the PPC tab runs its own simulation; only the error is shown here)
  const { loading: ppcLoading, error: ppcError, clearError: clearPPCError } = usePPCStore();

  const loading =
    activeTab === "grid" ? gridLoading : activeTab === "ppc" ? ppcLoading : false;
  const error =
    activeTab === "grid" ? gridError : activeTab === "ppc" ? ppcError : null;
  const clearError =
    activeTab === "grid" ? clearGridError : clearPPCError;

  useEffect(() => {
    fetchNetworkSpec();
  }, [fetchNetworkSpec]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-text-primary">
            P2 · HV Grid Integration
          </h2>
          <p className="text-xs text-text-muted mt-1 font-mono">
            {networkSpec
              ? `${networkSpec.total_capacity_mw} MW · ${networkSpec.array_voltage_kv}/${networkSpec.export_voltage_kv}/${networkSpec.grid_voltage_kv} kV · ${networkSpec.export_length_km} km export`
              : "Loading..."}
          </p>
          {/* Design-rationale cross-links */}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {[
              { label: "Why HVAC?", entry: hvacVsHvdcEducation },
              { label: "Why 66 kV?", entry: arrayVoltageEducation },
              { label: "Why ±120 MVAR STATCOM?", entry: statcomSizingEducation },
              { label: "Why graded cables?", entry: cableCrossSectionEducation },
            ].map(({ label, entry }) => (
              <button
                key={label}
                onClick={() => setLibraryEntry(entry)}
                className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
              >
                <BookOpen size={10} />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Action buttons — only for grid/ppc tabs */}
          {activeTab === "grid" && (
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
            </>
          )}


          <TrainingGuide guide={p2Guide} />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-bg-secondary rounded-lg border border-border-primary max-w-full overflow-x-auto">
        {TABS.map(({ id, label, Icon, tooltip }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            title={tooltip}
            className={`flex shrink-0 items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
              activeTab === id
                ? "bg-accent text-white"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Error banner (grid/ppc only) */}
      {error && (activeTab === "grid" || activeTab === "ppc") && (
        <div className="p-3 bg-status-alarm/10 border border-status-alarm/30 rounded-lg text-sm flex justify-between items-center">
          <span className="text-status-alarm">{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}

      {/* ── Grid Analysis tab ────────────────────────────────── */}
      {activeTab === "grid" && (
        <>
          {analysisRun ? (
            <GridDashboard />
          ) : (
            <div className="flex items-center justify-center h-96 rounded-lg border border-border-primary bg-bg-secondary shadow-lg shadow-black/20">
              <div className="text-center max-w-sm">
                <div className="flex justify-center mb-4">
                  <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <Zap size={24} className="text-accent" />
                  </div>
                </div>
                <p className="text-text-secondary text-base mb-2 font-medium">
                  Grid Analysis — Pandapower + IEC 60909
                </p>
                <ul className="text-text-muted text-xs text-left mb-4 space-y-1 list-disc list-inside">
                  <li>Load flow in four cases: voltages, loadings, losses</li>
                  <li>Reactive power: cable charging, reactors, PSE Q range</li>
                  <li>IEC 60909 fault currents vs breaker ratings</li>
                  <li>Fault ride-through against the PSE type-D profile</li>
                  <li>Grid-following vs grid-forming after a phase jump</li>
                </ul>
                <Button onClick={runFullAnalysis} disabled={loading} size="sm">
                  {loading ? "Running…" : "Run Analysis"}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── PPC tab (controls + auto-run inside) ─────────────── */}
      {activeTab === "ppc" && <PPCDashboard />}

      {/* ── New module tabs (self-contained dashboards) ───────── */}
      {activeTab === "protection"    && <ProtectionDashboard />}
      {activeTab === "power-quality" && <PowerQualityDashboard />}
      {activeTab === "bess"          && <BESSDashboard />}
      {activeTab === "cable-dts"     && <CableDTSDashboard />}
      {activeTab === "market"        && <MarketDashboard />}
      {activeTab === "advanced"      && <AdvancedAnalysisTab />}
      {activeTab === "planning"      && <PlanningCouplingTab />}

      {/* ── Library: Design rationale panels ───────────────────── */}
      {libraryEntry && (
        <EducationPanel
          content={libraryEntry}
          open={libraryEntry !== null}
          onOpenChange={(open) => { if (!open) setLibraryEntry(null); }}
        />
      )}
    </div>
  );
}
