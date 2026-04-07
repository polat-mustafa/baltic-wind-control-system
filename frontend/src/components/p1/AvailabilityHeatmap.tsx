/**
 * Availability heatmap — one cell per turbine coloured by TBA %.
 *
 * Displays IEC 61400-26-1 Time-Based Availability for all 34 turbines
 * as a single-row Plotly heatmap. Green >95%, amber 90-95%, red <90%.
 * Fleet-level KPI badges (TBA, EBA, best/worst turbine) shown above.
 */

import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useAvailabilityStore } from "../../store/availabilityStore";
import { Badge } from "../ui/Badge";
import { EducationButton } from "../ui/EducationButton";
import { availabilityHeatmapEducation } from "../../constants/education/p1";


export default function AvailabilityHeatmap() {
  const { fleetData } = useAvailabilityStore();

  if (!fleetData) return null;

  const { turbines, fleet_tba_pct, fleet_eba_pct, worst_turbine, best_turbine } = fleetData;

  // Build heatmap arrays — single row, all turbines as columns
  const turbineIds = turbines.map((t) => t.turbine_id);
  const tbaValues = turbines.map((t) => t.tba_pct);

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-text-primary">
            Time-Based Availability per Turbine (IEC 61400-26)
          </h3>
          <EducationButton content={availabilityHeatmapEducation} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="normal">
            Fleet TBA: {fleet_tba_pct.toFixed(1)}%
          </Badge>
          <Badge variant="info">
            EBA: {fleet_eba_pct.toFixed(1)}%
          </Badge>
          <Badge variant="alarm">
            Worst: {worst_turbine}
          </Badge>
          <Badge variant="normal">
            Best: {best_turbine}
          </Badge>
        </div>
      </div>

      {/* Heatmap — single row, 34 columns */}
      <Plot
        data={[
          {
            type: "heatmap",
            x: turbineIds,
            y: ["TBA %"],
            z: [tbaValues],
            colorscale: [
              [0, "#ef4444"],
              [0.45, "#ef4444"],
              [0.5, "#f5a623"],
              [0.525, "#f5a623"],
              [0.55, "#3ecf6e"],
              [1, "#3ecf6e"],
            ] as [number, string][],
            zmin: 80,
            zmax: 100,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            text: [tbaValues.map((v) => `${v.toFixed(1)}%`)] as any,
            texttemplate: "%{text}",
            textfont: { size: 10, color: "#0f1117" },
            showscale: true,
            colorbar: {
              title: { text: "TBA [%]", font: { color: "#9ba3b8", size: 12 } },
              tickfont: { color: "#9ba3b8", size: 11 },
              thickness: 14,
              len: 0.8,
            },
            hovertemplate: "%{x}<br>TBA: %{z:.1f}%<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: 160,
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            tickfont: { size: 9, color: "#9ba3b8", family: "'JetBrains Mono', monospace" },
            tickangle: -45,
          },
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            tickfont: { size: 11, color: "#9ba3b8", family: "'JetBrains Mono', monospace" },
          },
          margin: { t: 20, r: 80, b: 60, l: 60 },
        }}
        config={PLOTLY_CONFIG}
        className="w-full"
      />

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: "#3ecf6e" }} />
          ≥95% — Target
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: "#f5a623" }} />
          90–95% — Warning
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: "#ef4444" }} />
          &lt;90% — Below target
        </span>
      </div>
    </div>
  );
}
