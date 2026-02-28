/**
 * AI Forecasting page — route /forecast.
 *
 * Loads turbine spec on mount. Shows parameter controls sidebar
 * (turbine selector, horizon, ramp threshold, spot price) and
 * "Run Forecast Analysis" button. Once analysis completes, renders
 * the full ForecastDashboard with all 6 panels.
 */

import { useEffect } from "react";

import ForecastDashboard from "../components/p4/ForecastDashboard";
import { useForecastStore } from "../store/forecastStore";

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

  // Generate WTG_01..WTG_34 options
  const turbineOptions = Array.from({ length: 34 }, (_, i) => ({
    value: i,
    label: `WTG_${String(i + 1).padStart(2, "0")}`,
  }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">P4 · AI Forecasting</h2>
        <p className="text-xs text-slate-400 mt-1">
          {turbineSpec
            ? `${turbineSpec.name} · ${turbineSpec.rated_power_mw} MW · Cut-in ${turbineSpec.cut_in_speed_ms} / Rated ${turbineSpec.rated_speed_ms} / Cut-out ${turbineSpec.cut_out_speed_ms} m/s · XGBoost + LSTM + TFT`
            : "Loading turbine spec..."}
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

      {/* Main grid: charts on left, controls on right */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Left: Dashboard charts (2/3 width) */}
        <div className="xl:col-span-2">
          {analysisRun ? (
            <ForecastDashboard />
          ) : (
            <div className="flex items-center justify-center h-96 bg-slate-800 rounded-lg border border-slate-700">
              <div className="text-center">
                <p className="text-slate-400 text-lg mb-2">
                  Configure parameters and run forecast analysis
                </p>
                <p className="text-slate-500 text-sm">
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
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Turbine Selector
            </h3>
            <select
              value={turbineIndex}
              onChange={(e) => setTurbineIndex(Number(e.target.value))}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {turbineOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Forecast horizon */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Forecast Horizon
            </h3>
            <div className="space-y-2">
              {HORIZON_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="horizon"
                    value={opt.value}
                    checked={horizonSteps === opt.value}
                    onChange={() => setHorizonSteps(opt.value)}
                    className="accent-blue-500"
                  />
                  <span className="text-sm text-slate-300">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Ramp threshold slider */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Ramp Threshold
            </h3>
            <input
              type="range"
              min={10}
              max={200}
              step={5}
              value={rampThresholdMwHr}
              onChange={(e) => setRampThresholdMwHr(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <p className="text-sm text-slate-300 mt-1 text-center">
              {rampThresholdMwHr} MW/hr
            </p>
          </div>

          {/* Spot price input */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Spot Price (Synthetic)
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={500}
                step={1}
                value={spotPriceEurMwh}
                onChange={(e) => setSpotPriceEurMwh(Number(e.target.value))}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-400 whitespace-nowrap">
                EUR/MWh
              </span>
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
              "Re-run Forecast Analysis"
            ) : (
              "Run Forecast Analysis"
            )}
          </button>

          {/* Reference box */}
          <div className="bg-slate-900/50 rounded-lg border border-slate-700 p-3">
            <p className="text-xs text-slate-500">
              <strong>Standards:</strong> IEC 61400-12-1 (power curve), IEC
              61400-26-1 (availability), ENTSO-E transparency reg.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              <strong>Models:</strong> XGBoost (gradient boosting), LSTM
              (recurrent), TFT (attention), Weighted Ensemble
            </p>
            <p className="text-xs text-slate-500 mt-1">
              <strong>Note:</strong> Spot prices are synthetic (educational).
              Revenue figures are illustrative only.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
