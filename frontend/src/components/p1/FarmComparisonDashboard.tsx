/**
 * Farm Comparison Dashboard — M04 Multi-Farm Comparison.
 *
 * Header: title, electricity price, Add design, Compare.
 * Body: 2–4 design columns (FarmConfigTable) → animated results (FarmComparisonResultsPanel).
 * Pre-loaded with three Baltic design alternatives so the user can compare immediately.
 */

import { AlertTriangle, BarChart2, PlusCircle } from "lucide-react";

import { MAX_FARMS, NEW_FARM, useFarmComparisonStore } from "../../store/farmComparisonStore";
import { Button } from "../ui/Button";
import FarmComparisonResultsPanel from "./FarmComparisonResultsPanel";
import FarmConfigTable from "./FarmConfigTable";

export default function FarmComparisonDashboard() {
  const { farms, results, loading, error, priceEurMwh, runComparison, addFarm, setPrice, clearError } =
    useFarmComparisonStore();

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-status-alarm/10 border border-status-alarm/30 rounded-lg text-sm flex justify-between gap-3">
          <span className="text-status-alarm flex items-start gap-2 min-w-0">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span className="wrap-break-word">{error}</span>
          </span>
          <Button variant="ghost" size="sm" onClick={clearError}>Dismiss</Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BarChart2 size={16} className="text-accent" />
            <span className="text-sm font-semibold text-text-primary">Design alternatives — AEP · LCOE · grid</span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Change one thing at a time (spacing, cable length, CAPEX…) and see how it moves energy and cost.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-text-muted" title="Flat electricity price used for revenue, payback and IRR">
            Price
            <input
              type="number"
              min={20}
              max={300}
              step={1}
              value={priceEurMwh}
              onChange={(e) => Number.isFinite(e.target.valueAsNumber) && setPrice(e.target.valueAsNumber)}
              className="w-16 bg-bg-tertiary border border-border-primary rounded px-1.5 py-0.5 text-xs text-text-primary font-mono focus:outline-none focus:border-accent"
            />
            €/MWh
          </label>
          {farms.length < MAX_FARMS && (
            <Button variant="ghost" size="sm" onClick={() => addFarm({ ...NEW_FARM })}>
              <PlusCircle size={13} className="mr-1" /> Add design
            </Button>
          )}
          <Button size="sm" onClick={runComparison} disabled={loading || farms.length < 2}>
            {loading ? "Comparing…" : "Compare"}
          </Button>
        </div>
      </div>

      <FarmConfigTable />

      {!results && !loading && (
        <div className="text-center py-8 text-text-muted text-sm">
          Press <strong className="text-text-primary">Compare</strong> to run the wake model, loss cascade and LCOE
          for each design.
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-32 text-text-muted text-sm">
          <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin mr-2" />
          Running PyWake wake model + loss cascade…
        </div>
      )}

      {results && !loading && <FarmComparisonResultsPanel />}
    </div>
  );
}
