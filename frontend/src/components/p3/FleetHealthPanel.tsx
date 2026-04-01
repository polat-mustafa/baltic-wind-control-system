/**
 * Fleet Health Heatmap — M12 CMS.
 *
 * Plotly heatmap: 34 turbines (x) × 8 components (y), coloured by health index.
 * Green (>80), Amber (60-80), Red (<60).
 * Click on turbine column → triggers fetchTurbineDetail in CMSDashboard.
 */

import Plot from "react-plotly.js";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useCMSStore } from "../../store/cmsStore";

const COMPONENTS = ["MAIN_BEARING", "GEARBOX", "GENERATOR", "ROTOR_HUB", "PITCH_SYSTEM", "YAW_SYSTEM", "TRANSFORMER", "CONVERTER"];

export default function FleetHealthPanel() {
  const { fleetHealth, fetchTurbineDetail } = useCMSStore();

  if (!fleetHealth) return null;

  const turbineIds = fleetHealth.turbines.map((t) => t.turbine_id);
  // Build 2D matrix: rows = components, cols = turbines
  // For simplicity, use overall_health_index for all rows (backend returns per-turbine overall)
  const z = COMPONENTS.map(() => fleetHealth.turbines.map((t) => t.overall_health_index));
  const text = COMPONENTS.map(() => fleetHealth.turbines.map((t) => `${t.overall_health_index.toFixed(0)}`));

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-text-primary">Fleet Health Index — 34 WTGs</h3>
        <div className="flex gap-3 text-xs text-text-muted">
          <span className="text-status-success">{fleetHealth.fleet_average_hi.toFixed(0)} avg</span>
          <span className="text-status-warning">{fleetHealth.turbines_in_warning} warning</span>
          <span className="text-status-alarm">{fleetHealth.turbines_in_alert} alert</span>
        </div>
      </div>
      <Plot
        data={[
          {
            type: "heatmap",
            x: turbineIds,
            y: COMPONENTS.map((c) => c.replace("_", " ")),
            z,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            text: text as any,
            texttemplate: "%{text}",
            textfont: { size: 9, color: "#0f1117" },
            colorscale: [
              [0, "#ef4444"],
              [0.3, "#ef4444"],
              [0.4, "#f59e0b"],
              [0.5, "#f59e0b"],
              [0.6, "#3ecf6e"],
              [1, "#3ecf6e"],
            ] as [number, string][],
            zmin: 0,
            zmax: 100,
            showscale: true,
            colorbar: {
              title: { text: "HI", font: { color: "#9ba3b8", size: 11 } },
              tickfont: { color: "#9ba3b8", size: 10 },
              thickness: 12,
            },
            hovertemplate: "%{x} — %{y}<br>Health Index: %{z:.0f}<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: 280,
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            tickfont: { size: 8, color: "#9ba3b8", family: "'JetBrains Mono', monospace" },
            tickangle: -60,
          },
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            tickfont: { size: 9, color: "#9ba3b8" },
          },
          margin: { t: 20, r: 60, b: 70, l: 110 },
        }}
        config={PLOTLY_CONFIG}
        onClick={(data) => {
          if (data.points.length > 0) {
            const turbineId = data.points[0].x as string;
            fetchTurbineDetail(turbineId);
          }
        }}
        className="w-full cursor-pointer"
      />
      <p className="text-xs text-text-muted mt-1">Click a turbine column to load component detail</p>
    </div>
  );
}
