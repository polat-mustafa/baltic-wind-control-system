/**
 * DigitalTwinDashboard — Layout orchestrator for all digital twin panels.
 *
 * Arranges the 6 visualization panels in a responsive grid:
 * - Row 1: KPI header (full width)
 * - Row 2: Farm health map + Twin comparison (2 columns)
 * - Row 3: Residual time series + Health trend (2 columns)
 * - Row 4: Anomaly classification (full width)
 */

import DigitalTwinKPIHeader from "./DigitalTwinKPIHeader";
import FarmHealthMapPanel from "./FarmHealthMapPanel";
import TwinComparisonPanel from "./TwinComparisonPanel";
import ResidualTimeSeriesPanel from "./ResidualTimeSeriesPanel";
import HealthTrendPanel from "./HealthTrendPanel";
import AnomalyClassificationPanel from "./AnomalyClassificationPanel";

export default function DigitalTwinDashboard() {
  return (
    <div className="space-y-4">
      {/* Row 1: KPI header */}
      <DigitalTwinKPIHeader />

      {/* Row 2: Map + Twin comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FarmHealthMapPanel />
        <TwinComparisonPanel />
      </div>

      {/* Row 3: Residual + Health trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ResidualTimeSeriesPanel />
        <HealthTrendPanel />
      </div>

      {/* Row 4: Anomaly classification */}
      <AnomalyClassificationPanel />
    </div>
  );
}
