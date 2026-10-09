/**
 * Availability per turbine — technical TBA (IEC 61400-26-1 time categories).
 *
 * One bar per turbine on a 90–100 % axis with the 97 % contract target as a
 * reference line; turbines below target are drawn in the loss colour.
 * Fleet KPI badges (TBA, EBA, best/worst turbine) shown above.
 */

import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useChartPalette } from "../../hooks/useChartPalette";
import { useAvailabilityStore } from "../../store/availabilityStore";
import { Badge } from "../ui/Badge";
import { EducationButton } from "../ui/EducationButton";
import { availabilityHeatmapEducation } from "../../constants/education/p1";


/** Contract-style TBA target [%] (backend TARGET_TBA_PCT). */
const TARGET = 97;

export default function AvailabilityHeatmap() {
  const { fleetData } = useAvailabilityStore();
  const c = useChartPalette();

  if (!fleetData) return null;

  const { turbines, fleet_tba_pct, fleet_eba_pct, worst_turbine, best_turbine } = fleetData;

  const turbineIds = turbines.map((t) => t.turbine_id);
  const tbaValues = turbines.map((t) => t.tba_pct);

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-text-primary">
            Availability per turbine — technical TBA
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
            type: "bar",
            x: turbineIds,
            y: tbaValues,
            marker: { color: tbaValues.map((v) => (v < TARGET ? c.red : c.blue)) },
            hovertemplate: "%{x}: TBA %{y:.2f} %<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: 260,
          showlegend: false,
          bargap: 0.25,
          xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, tickangle: -60, tickfont: { size: 9, family: "'IBM Plex Mono', monospace" } },
          yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "TBA [%]", font: { size: 12 } }, range: [Math.min(90, ...tbaValues) - 0.5, 100] },
          shapes: [
            { type: "line", xref: "paper", yref: "y", x0: 0, x1: 1, y0: TARGET, y1: TARGET, line: { color: c.ref, width: 1.5, dash: "dash" } } as const,
          ],
          annotations: [
            { xref: "paper", yref: "y", x: 1, y: TARGET, xanchor: "right", yanchor: "bottom", text: `target ${TARGET} %`, showarrow: false, font: { size: 11 } } as const,
          ],
          margin: { t: 12, r: 16, b: 64, l: 56 },
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
      />
      <p className="mt-1 text-xs text-text-muted">
        Axis starts at {Math.min(90, ...tbaValues) - 0.5} %. Bars below the dashed contract target are in the loss colour.
      </p>
    </div>
  );
}
