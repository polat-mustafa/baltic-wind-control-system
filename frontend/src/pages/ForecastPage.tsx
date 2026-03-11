/**
 * AI Forecasting page — route /forecast.
 *
 * Loads turbine spec on mount. Controls live in a slide-out drawer.
 * Once analysis completes, renders the full ForecastDashboard at full width.
 */

import { useEffect } from "react";
import { Brain } from "lucide-react";

import ForecastDashboard from "../components/p4/ForecastDashboard";
import { useForecastStore } from "../store/forecastStore";
import { Button } from "../components/ui/Button";
import { TrainingGuide } from "../components/ui/TrainingGuide";
import { ControlDrawer } from "../components/ui/ControlDrawer";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { p4Guide } from "../constants/trainingGuideContent";

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
  } = useForecastStore();

  useEffect(() => {
    fetchTurbineSpec();
  }, [fetchTurbineSpec]);

  const turbineOptions = Array.from({ length: 34 }, (_, i) => ({
    value: i,
    label: `WTG_${String(i + 1).padStart(2, "0")}`,
  }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-text-primary">
            P4 · AI Forecasting
          </h2>
          <p className="text-xs text-text-muted mt-1 font-mono">
            {turbineSpec
              ? `${turbineSpec.name} · ${turbineSpec.rated_power_mw} MW · Cut-in ${turbineSpec.cut_in_speed_ms} / Rated ${turbineSpec.rated_speed_ms} / Cut-out ${turbineSpec.cut_out_speed_ms} m/s · XGBoost + LSTM + TFT`
              : "Loading turbine spec..."}
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
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Running Analysis...
                </span>
              ) : analysisRun ? (
                "Re-run Forecast Analysis"
              ) : (
                "Run Forecast Analysis"
              )}
            </Button>

            {/* Progress bar during analysis */}
            {loading && (
              <div className="rounded-lg border border-border-primary bg-bg-secondary p-3 space-y-2">
                <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-text-muted text-center font-mono">
                  {progressMessage || "Initialising pipeline..."}
                </p>
              </div>
            )}
          </ControlDrawer>
          <TrainingGuide guide={p4Guide} />
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

      {/* Progress bar (visible inline when loading) */}
      {loading && (
        <div className="rounded-lg border border-border-primary bg-bg-secondary p-3 space-y-2">
          <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-text-muted text-center font-mono">
            {progressMessage || "Initialising pipeline..."}
          </p>
        </div>
      )}

      {/* Full-width dashboard */}
      {analysisRun ? (
        <ForecastDashboard />
      ) : (
        <div className="flex items-center justify-center h-96 rounded-lg border border-border-primary bg-bg-secondary shadow-lg shadow-black/20">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                <Brain size={24} className="text-accent" />
              </div>
            </div>
            <p className="text-text-secondary text-base mb-2">
              Configure parameters and run forecast analysis
            </p>
            <p className="text-text-muted text-sm">
              Select turbine, forecast horizon, and ramp threshold,
              then click &quot;Run Forecast Analysis&quot;
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
