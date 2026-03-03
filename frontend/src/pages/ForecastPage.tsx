/**
 * AI Forecasting page — route /forecast.
 *
 * Loads turbine spec on mount. Shows parameter controls sidebar
 * (turbine selector, horizon, ramp threshold, spot price) and
 * "Run Forecast Analysis" button. Once analysis completes, renders
 * the full ForecastDashboard with all 6 panels.
 */

import { useEffect } from "react";
import { Brain } from "lucide-react";

import ForecastDashboard from "../components/p4/ForecastDashboard";
import { useForecastStore } from "../store/forecastStore";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";

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
      <div>
        <h2 className="text-xl font-semibold text-text-primary">
          P4 · AI Forecasting
        </h2>
        <p className="text-xs text-text-muted mt-1 font-mono">
          {turbineSpec
            ? `${turbineSpec.name} · ${turbineSpec.rated_power_mw} MW · Cut-in ${turbineSpec.cut_in_speed_ms} / Rated ${turbineSpec.rated_speed_ms} / Cut-out ${turbineSpec.cut_out_speed_ms} m/s · XGBoost + LSTM + TFT`
            : "Loading turbine spec..."}
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

      {/* Main grid: charts on left, controls on right */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left: Dashboard charts (2/3 width) */}
        <div className="xl:col-span-2">
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

        {/* Right: Controls (1/3 width) */}
        <div className="space-y-4">
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
              "Re-run Forecast Analysis"
            ) : (
              "Run Forecast Analysis"
            )}
          </Button>

          {/* Reference box */}
          <div className="rounded-lg border border-border-primary bg-bg-tertiary p-3">
            <p className="text-xs text-text-muted">
              <span className="font-medium text-text-secondary">Models:</span>{" "}
              XGBoost (gradient boosting), LSTM (recurrent), TFT (attention)
            </p>
            <p className="text-xs text-text-muted mt-1">
              <span className="font-medium text-text-secondary">Note:</span>{" "}
              Spot prices are synthetic (educational). Revenue figures are illustrative.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
