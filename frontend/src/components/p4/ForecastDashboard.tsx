/**
 * P4 Forecast dashboard layout — composes all 6 chart panels.
 *
 * Layout:
 *   Row 1: KPI header (full width, 5 cards)
 *   Row 2: ForecastVsActual | ModelComparison
 *   Row 3: SHAP | AccuracyHeatmap
 *   Row 4: RevenueImpact (full width)
 */

import AccuracyHeatmapPanel from "./AccuracyHeatmapPanel";
import ForecastKPIHeader from "./ForecastKPIHeader";
import ForecastVsActualPanel from "./ForecastVsActualPanel";
import ModelComparisonPanel from "./ModelComparisonPanel";
import RevenueImpactPanel from "./RevenueImpactPanel";
import SHAPPanel from "./SHAPPanel";

export default function ForecastDashboard() {
  return (
    <div className="space-y-4">
      {/* Row 1: KPI cards */}
      <ForecastKPIHeader />

      {/* Row 2: Forecast vs Actual | Model Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ForecastVsActualPanel />
        <ModelComparisonPanel />
      </div>

      {/* Row 3: SHAP | Accuracy Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SHAPPanel />
        <AccuracyHeatmapPanel />
      </div>

      {/* Row 4: Revenue Impact (full width) */}
      <RevenueImpactPanel />
    </div>
  );
}
