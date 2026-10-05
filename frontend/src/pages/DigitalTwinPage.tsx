/**
 * Digital Twin — route /digital-twin.
 *
 * Condition monitoring of the 34 × V236 fleet against a physics reference
 * model, structured by ISO 13374-1 (DA → DM → SD → HA → PA → AG).
 *
 *   Fleet     — KPIs, processing chain, map, health heatmap, fault register, events
 *   Turbine   — diagnosis/advisory/prognosis, control charts, twin vs measured,
 *               power curve, hypothesis test, fault size over time
 *   Model     — validation vs injected ground truth, reference curves, model card
 *
 * Runs on mount with the default case so the page is never empty.
 */

import { useEffect } from "react";
import { BookOpenCheck, Cpu, LayoutGrid, Wind } from "lucide-react";

import EventLog from "../components/digital-twin/EventLog";
import FarmMap from "../components/digital-twin/FarmMap";
import FaultRegister from "../components/digital-twin/FaultRegister";
import FleetHealthHeatmap from "../components/digital-twin/FleetHealthHeatmap";
import FleetKPIs from "../components/digital-twin/FleetKPIs";
import ChannelComparePanel from "../components/digital-twin/ChannelComparePanel";
import HypothesisPanel from "../components/digital-twin/HypothesisPanel";
import ModelCardPanel from "../components/digital-twin/ModelCardPanel";
import PipelineStrip from "../components/digital-twin/PipelineStrip";
import PowerCurvePanel from "../components/digital-twin/PowerCurvePanel";
import ReferenceCurvePanel from "../components/digital-twin/ReferenceCurvePanel";
import ResidualChartsPanel from "../components/digital-twin/ResidualChartsPanel";
import SeverityTrendPanel from "../components/digital-twin/SeverityTrendPanel";
import TurbineHeader from "../components/digital-twin/TurbineHeader";
import TwinControlBar from "../components/digital-twin/TwinControlBar";
import ValidationPanel from "../components/digital-twin/ValidationPanel";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { TrainingGuide } from "../components/ui/TrainingGuide";
import { digitalTwinGuide } from "../constants/trainingGuideContent";
import { useDigitalTwinStore, type TwinTab } from "../store/digitalTwinStore";

const TABS: { id: TwinTab; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { id: "fleet", label: "Fleet overview", Icon: LayoutGrid },
  { id: "turbine", label: "Turbine analysis", Icon: Wind },
  { id: "model", label: "Model & validation", Icon: BookOpenCheck },
];

function LoadingBlock({ height = 320 }: { height?: number }) {
  return (
    <div style={{ height }}>
      <Skeleton className="h-full w-full rounded-lg" />
    </div>
  );
}

export default function DigitalTwinPage() {
  const analysis = useDigitalTwinStore((s) => s.analysis);
  const detail = useDigitalTwinStore((s) => s.detail);
  const loading = useDigitalTwinStore((s) => s.loading);
  const detailLoading = useDigitalTwinStore((s) => s.detailLoading);
  const error = useDigitalTwinStore((s) => s.error);
  const tab = useDigitalTwinStore((s) => s.tab);
  const setTab = useDigitalTwinStore((s) => s.setTab);
  const loadModel = useDigitalTwinStore((s) => s.loadModel);
  const runAnalysis = useDigitalTwinStore((s) => s.runAnalysis);
  const clearError = useDigitalTwinStore((s) => s.clearError);

  useEffect(() => {
    loadModel();
    if (!useDigitalTwinStore.getState().analysis) runAnalysis();
  }, [loadModel, runAnalysis]);

  const showDetail = detail != null && !detailLoading;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2" data-tour="page-header">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-text-primary">
            <Cpu size={20} className="text-accent" aria-hidden />
            Digital Twin · Condition Monitoring
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Physics reference model of the V236-15.0 MW run at the measured wind of every 10-min
            SCADA record · EWMA control charts · model-based fault isolation · ISO 13374-1 / 13381-1
          </p>
        </div>
        <TrainingGuide guide={digitalTwinGuide} />
      </div>

      <TwinControlBar />

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-status-alarm/30 bg-status-alarm/10 p-3 text-sm"
        >
          <span className="text-status-alarm">{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}

      <div
        role="tablist"
        aria-label="Digital twin views"
        data-tour="page-tabs"
        className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-border-primary bg-bg-secondary p-1"
      >
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
              tab === id
                ? "bg-accent text-white"
                : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {!analysis ? (
        loading ? (
          <div className="space-y-4">
            <LoadingBlock height={96} />
            <LoadingBlock height={420} />
          </div>
        ) : (
          <div className="flex h-72 items-center justify-center rounded-lg border border-border-primary bg-bg-secondary">
            <p className="text-sm text-text-muted">Run the twin to see the fleet.</p>
          </div>
        )
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={loading}>
          {tab === "fleet" && (
            <div className="space-y-4">
              <FleetKPIs />
              <PipelineStrip />
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                <FarmMap />
                <FleetHealthHeatmap />
              </div>
              <FaultRegister />
              <EventLog />
            </div>
          )}

          {tab === "turbine" && (
            <div className="space-y-4">
              <TurbineHeader />
              {showDetail ? (
                <>
                  <ResidualChartsPanel />
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <ChannelComparePanel />
                    <PowerCurvePanel />
                  </div>
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <HypothesisPanel />
                    <SeverityTrendPanel />
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <LoadingBlock height={620} />
                  <LoadingBlock height={360} />
                </div>
              )}
            </div>
          )}

          {tab === "model" && (
            <div className="space-y-4">
              <ValidationPanel />
              <ReferenceCurvePanel />
              <ModelCardPanel />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
