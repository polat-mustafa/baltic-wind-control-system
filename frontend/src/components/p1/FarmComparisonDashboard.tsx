/**
 * Farm Comparison Dashboard — M04 Multi-Farm Comparison.
 *
 * Layout:
 *   Header row: title + Compare button + Add Farm button
 *   Farm config cards grid (1–6 farms, editable)
 *   Results panels (AEP/CF grouped bar + LCOE bar + summary table)
 *
 * Pre-loaded with 3 Baltic Wind default configs — user can compare immediately.
 */

import { AlertTriangle, BarChart2, PlusCircle } from "lucide-react";

import { useFarmComparisonStore } from "../../store/farmComparisonStore";
import { Button } from "../ui/Button";
import FarmConfigPanel from "./FarmConfigPanel";
import FarmComparisonResultsPanel from "./FarmComparisonResultsPanel";
import type { FarmConfig } from "../../types/farmComparison";

const DEFAULT_NEW_FARM: FarmConfig = {
  name: "New Farm",
  n_turbines: 30,
  turbine_rated_mw: 15.0,
  weibull_a: 9.5,
  weibull_k: 2.0,
  array_voltage_kv: 66,
  export_length_km: 40,
};

export default function FarmComparisonDashboard() {
  const { farms, results, loading, error, runComparison, addFarm, clearError } = useFarmComparisonStore();

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="p-3 bg-status-alarm/10 border border-status-alarm/30 rounded-lg text-sm flex justify-between">
          <span className="text-status-alarm flex items-center gap-2">
            <AlertTriangle size={14} /> {error}
          </span>
          <Button variant="ghost" size="sm" onClick={clearError}>Dismiss</Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 size={16} className="text-accent" />
          <span className="text-sm font-semibold text-text-primary">Multi-Farm Comparison — AEP / LCOE / Capacity Factor</span>
        </div>
        <div className="flex gap-2">
          {farms.length < 6 && (
            <Button variant="ghost" size="sm" onClick={() => addFarm({ ...DEFAULT_NEW_FARM })}>
              <PlusCircle size={13} className="mr-1" /> Add Farm
            </Button>
          )}
          <Button size="sm" onClick={runComparison} disabled={loading || farms.length < 2}>
            {loading ? "Comparing…" : "Compare"}
          </Button>
        </div>
      </div>

      {/* Farm config cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {farms.map((farm, i) => (
          <FarmConfigPanel key={i} index={i} config={farm} />
        ))}
      </div>

      {/* Instructions if no results yet */}
      {!results && !loading && (
        <div className="text-center py-8 text-text-muted text-sm">
          Configure your farms above and click <strong className="text-text-primary">Compare</strong> to run AEP and LCOE analysis.
        </div>
      )}

      {/* Loading spinner */}
      {loading && (
        <div className="flex items-center justify-center h-32 text-text-muted text-sm">
          <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin mr-2" />
          Running AEP / LCOE simulation…
        </div>
      )}

      {/* Results */}
      {results && !loading && <FarmComparisonResultsPanel />}
    </div>
  );
}
