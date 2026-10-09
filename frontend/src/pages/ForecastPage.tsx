/**
 * AI Forecasting page — route /forecast.
 *
 * Five views of the same forecasting system:
 *   Forecast          the dashboard (ensemble P10/P50/P90, model comparison,
 *                     SHAP, accuracy, revenue)
 *   Real data         day-ahead forecast of measured Baltic offshore output (DK2)
 *   Training monitor  the models being built, live (stages, epochs, losses)
 *   AI Academy        the course: from "why forecast" to XGBoost, LSTM, TFT,
 *                     with interactive illustrations and narration (EN/TR)
 *   Concept map       how the ideas connect; click → lesson
 * Controls live in a slide-out drawer.
 */

import { useEffect } from "react";
import { farmTitle, useFleet } from "../lib/fleet";
import { Activity, BookOpen, Brain, Database, Network, Play } from "lucide-react";

import ForecastDashboard from "../components/p4/ForecastDashboard";
import TrainingMonitor from "../components/p4/academy/TrainingMonitor";
import AcademyTab from "../components/p4/academy/AcademyTab";
import ConceptMap from "../components/p4/academy/ConceptMap";
import RealDataPanel from "../components/p4/RealDataPanel";
import { useForecastStore, type ForecastTab } from "../store/forecastStore";
import { Button } from "../components/ui/Button";
import { TrainingGuide } from "../components/ui/TrainingGuide";
import { ControlDrawer } from "../components/ui/ControlDrawer";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { readStored } from "../lib/storage";
import { p4Guide } from "../constants/trainingGuideContent";
import { PageHeader } from "../components/layout/PageHeader";
import { useAutoRun } from "../hooks/useAutoRun";

const TABS: { id: ForecastTab; label: string; Icon: typeof Brain }[] = [
  { id: "forecast", label: "Forecast", Icon: Brain },
  { id: "real", label: "Real data", Icon: Database },
  { id: "monitor", label: "Training monitor", Icon: Activity },
  { id: "academy", label: "AI Academy", Icon: BookOpen },
  { id: "map", label: "Concept map", Icon: Network },
];

/** Language chosen in the academy (shared with the concept map). */
function academyLang(): "en" | "tr" {
  return readStored("of.academyLang") === "tr" ? "tr" : "en";
}

function StartCard({
  Icon,
  title,
  text,
  action,
  onClick,
  disabled = false,
}: {
  Icon: typeof Brain;
  title: string;
  text: string;
  action: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-border-primary bg-bg-secondary p-5">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent/15">
        <Icon size={20} className="text-accent" />
      </div>
      <div className="mb-1 text-base font-semibold text-text-primary">{title}</div>
      <p className="mb-4 flex-1 text-sm leading-relaxed text-text-secondary">{text}</p>
      <Button onClick={onClick} disabled={disabled} size="sm" className="self-start">
        {action}
      </Button>
    </div>
  );
}

const HORIZON_OPTIONS = [
  { value: 144, label: "24 hours (144 steps)" },
  { value: 288, label: "48 hours (288 steps)" },
] as const;

export default function ForecastPage() {
  const {
    turbineSpec,
    loading,
    error,
    analysisRun,
    progress,
    progressMessage,
    turbineIndex,
    horizonSteps,
    rampThresholdMwHr,
    spotPriceEurMwh,
    setTurbineIndex,
    setHorizonSteps,
    setRampThresholdMwHr,
    setSpotPriceEurMwh,
    fetchTurbineSpec,
    runFullAnalysis,
    clearError,
    tab,
    setTab,
    live,
  } = useForecastStore();

  useEffect(() => {
    fetchTurbineSpec();
    void useForecastStore.getState().fetchTrainingProgress();
  }, [fetchTurbineSpec]);
  // Open with results when the models are already trained and cached (seconds);
  // a first training takes ~30 min on a CPU, so that one stays a choice
  useAutoRun(!!live && live.last_build_s != null && !live.active && !analysisRun && !loading && !error, runFullAnalysis);

  // The models train on one turbine of the 34-turbine reference SCADA set; the picker
  // names it after the farm on screen (an own project has as many choices as turbines).
  const fleet = useFleet();
  const turbineOptions = fleet.turbines.slice(0, 34).map((t, i) => ({ value: i, label: t.id }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI Forecasting"
        description={
          <>
            {farmTitle(fleet)}: {fleet.turbines.length} turbines = {fleet.net.total_capacity_mw.toFixed(0)} MW. The SB-510 models train on a synthetic reference SCADA set (34 turbines, SB-510 climate, cached); the Real data tab trains and scores the same methods on measured Baltic offshore output (Energinet DK2, 977 MW) with archived ECMWF / ICON forecasts.
          </>
        }
        meta={turbineSpec ? `${turbineSpec.name} · ${turbineSpec.rated_power_mw} MW · cut-in ${turbineSpec.cut_in_speed_ms} / rated ${turbineSpec.rated_speed_ms} / cut-out ${turbineSpec.cut_out_speed_ms} m/s · XGBoost + LSTM + TFT` : undefined}
        actions={
          <>
            <TrainingGuide guide={p4Guide} />
            <Button
                        onClick={runFullAnalysis}
                        data-tour="run-button"
                        disabled={loading}
                        size="sm"
                      >
                        {loading ? (
                          <span className="flex items-center gap-2">
                            <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                            Running...
                          </span>
                        ) : analysisRun ? (
                          "Re-run"
                        ) : (
                          "Run Forecast"
                        )}
                      </Button>
                      <ControlDrawer
                        title="Forecast Controls"
                        subtitle="Turbine, horizon, ramp & pricing"
                        footer={
                          <div className="space-y-2 text-xs">
                            <div>
                              <span className="font-medium text-text-secondary">Models:</span>
                              <span className="text-text-muted"> XGBoost (gradient boosting), LSTM (recurrent neural net), TFT (transformer with attention)</span>
                            </div>
                            <div>
                              <span className="font-medium text-text-secondary">SHAP</span>
                              <span className="text-text-muted"> — SHapley Additive exPlanations. Shows which input features drive the forecast</span>
                            </div>
                            <p className="text-text-muted italic">
                              Spot prices are synthetic (educational). Revenue figures are illustrative.
                            </p>
                            <p className="text-text-muted italic">
                              Inputs are causal: SCADA measured up to t−1 plus the NWP forecast for t. A skill
                              score near 1.0 would indicate leakage; operational 10-min forecasts typically
                              reach 0.1–0.5 vs persistence.
                            </p>
                          </div>
                        }
                      >
                        {/* Turbine selector */}
                        <Card>
                          <CardHeader>
                            <CardTitle>Turbine Selector</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <select
                              value={turbineIndex}
                              onChange={(e) => setTurbineIndex(Number(e.target.value))}
                              className="w-full bg-bg-tertiary border border-border-secondary rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                            >
                              {turbineOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </CardContent>
                        </Card>

                        {/* Forecast horizon */}
                        <Card>
                          <CardHeader>
                            <CardTitle>Forecast Horizon</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {HORIZON_OPTIONS.map((opt) => (
                                <label
                                  key={opt.value}
                                  className="flex items-center gap-2 cursor-pointer group"
                                >
                                  <input
                                    type="radio"
                                    name="horizon"
                                    value={opt.value}
                                    checked={horizonSteps === opt.value}
                                    onChange={() => setHorizonSteps(opt.value)}
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

                        {/* Ramp threshold slider */}
                        <Card>
                          <CardHeader>
                            <CardTitle>Ramp Threshold</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <input
                              type="range"
                              min={10}
                              max={200}
                              step={5}
                              value={rampThresholdMwHr}
                              onChange={(e) => setRampThresholdMwHr(Number(e.target.value))}
                              className="w-full accent-accent"
                            />
                            <p className="text-sm text-text-secondary mt-2 text-center font-mono tabular-nums">
                              {rampThresholdMwHr} MW/hr
                            </p>
                          </CardContent>
                        </Card>

                        {/* Spot price input */}
                        <Card>
                          <CardHeader>
                            <CardTitle>Spot Price</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                max={500}
                                step={1}
                                value={spotPriceEurMwh}
                                onChange={(e) => setSpotPriceEurMwh(Number(e.target.value))}
                                className="w-full bg-bg-tertiary border border-border-secondary rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent font-mono"
                              />
                              <span className="text-xs text-text-muted whitespace-nowrap">
                                EUR/MWh
                              </span>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Run Analysis button + progress */}
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
                            "Re-run Forecast Analysis"
                          ) : (
                            "Run Forecast Analysis"
                          )}
                        </Button>

                      </ControlDrawer>
          </>
        }
      />

      {/* Error banner */}
      {error && (
        <div className="p-3 bg-status-alarm/10 border border-status-alarm/30 rounded-lg text-sm flex justify-between items-center">
          <span className="text-status-alarm">{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Live progress (compact) — the full view is the training monitor */}
      {loading && tab !== "monitor" && (
        <button
          type="button"
          onClick={() => setTab("monitor")}
          className="w-full rounded-lg border border-border-primary bg-bg-secondary p-3 text-left hover:bg-bg-hover"
        >
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="font-semibold text-text-primary">{progressMessage || "Initialising pipeline…"}</span>
            <span className="font-mono text-text-secondary">
              {progress} %{live?.eta_s ? ` · ETA ${Math.ceil(live.eta_s / 60)} min` : ""} · open training monitor →
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-bg-tertiary">
            <div className="h-full rounded-full bg-accent transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
          </div>
        </button>
      )}

      {/* View tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border-primary" role="tablist" aria-label="Forecast views" data-tour="page-tabs">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
              tab === id ? "border-accent text-text-primary" : "border-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            <Icon size={15} />
            {label}
            {id === "monitor" && loading && <span className="h-2 w-2 animate-pulse rounded-full bg-status-warning" />}
          </button>
        ))}
      </div>

      {tab === "forecast" &&
        (analysisRun ? (
          <ForecastDashboard />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StartCard
              Icon={Play}
              title="Run a forecast"
              text="Trains XGBoost, LSTM and a Temporal Fusion Transformer on causal SCADA + NWP features with 5-fold TimeSeriesSplit, then combines them into a P10/P50/P90 ensemble. First run about 30 min on a CPU server, then cached for a week (seconds)."
              action="Run forecast"
              onClick={() => void runFullAnalysis()}
              disabled={loading}
            />
            <StartCard
              Icon={BookOpen}
              title="Learn how it works"
              text="AI Academy: eleven short chapters from why we forecast wind to gradient boosting, LSTM memory gates, attention and uncertainty — interactive, with narration in English or Turkish."
              action="Open the academy"
              onClick={() => setTab("academy")}
            />
            <StartCard
              Icon={Network}
              title="See the big picture"
              text="The concept map connects data, learning, models, evaluation and grid operation. Hover to see what a concept depends on, click to jump to its lesson."
              action="Open the concept map"
              onClick={() => setTab("map")}
            />
          </div>
        ))}
      {tab === "real" && <RealDataPanel />}
      {tab === "monitor" && <TrainingMonitor />}
      {tab === "academy" && <AcademyTab />}
      {tab === "map" && <ConceptMap lang={academyLang()} />}
    </div>
  );
}
