/**
 * DTS Temperature Profile Panel — M10 Cable DTS.
 *
 * Plotly line chart: distance (km) vs temperature (°C) along 45 km export cable.
 * Hotspot markers (warning > 70°C, critical > 90°C) annotated with vertical lines.
 * IEC 60287 thermal model, J-tube zone factor = 1.4 (hottest section).
 */

import Plot from "react-plotly.js";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useCableDTSStore } from "../../store/cableDtsStore";
import { InfoButton } from "../ui/InfoButton";
import { dtsProfileInfo } from "../../constants/panelInfo";

export default function DTSProfilePanel() {
  const { profile } = useCableDTSStore();

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-48 text-text-muted text-sm">
        Loading DTS profile…
      </div>
    );
  }

  const distances = profile.profile.map((p) => p.distance_km);
  const temps = profile.profile.map((p) => p.temperature_c);

  // Hotspot vertical lines
  const hotspotShapes = profile.profile
    .filter((p) => p.is_hotspot)
    .map((p) => ({
      type: "line" as const,
      x0: p.distance_km,
      x1: p.distance_km,
      y0: 0,
      y1: 100,
      line: { color: p.temperature_c > 90 ? "#ef4444" : "#f59e0b", width: 1, dash: "dot" as const },
    }));

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <h3 className="text-sm font-semibold text-text-primary">DTS Temperature Profile (45 km)</h3>
          <InfoButton info={dtsProfileInfo} />
        </div>
        <div className="text-xs text-text-muted">
          Max: <span className="text-text-primary font-mono">{profile.max_temp_c.toFixed(1)}°C</span>
          {" "}@ {profile.max_temp_location_km.toFixed(1)} km
        </div>
      </div>
      <Plot
        data={[
          {
            type: "scatter",
            x: distances,
            y: temps,
            mode: "lines",
            name: "Temperature (°C)",
            line: { color: "#60a5fa", width: 2 },
            hovertemplate: "%{x:.1f} km → %{y:.1f}°C<extra></extra>",
          },
          {
            type: "scatter",
            x: [0, 45],
            y: [70, 70],
            mode: "lines",
            name: "Warning 70°C",
            line: { color: "#f59e0b", width: 1, dash: "dot" },
            hoverinfo: "none",
          },
          {
            type: "scatter",
            x: [0, 45],
            y: [90, 90],
            mode: "lines",
            name: "Critical 90°C",
            line: { color: "#ef4444", width: 1, dash: "dot" },
            hoverinfo: "none",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: 280,
          shapes: hotspotShapes,
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            title: { text: "Distance (km)", font: { color: "#9ba3b8", size: 12 } },
            range: [0, 45],
          },
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            title: { text: "Temperature (°C)", font: { color: "#9ba3b8", size: 12 } },
            range: [0, 100],
          },
          legend: { ...DARK_PLOTLY_LAYOUT.legend, orientation: "h", x: 0.5, xanchor: "center", y: 1.04, yanchor: "bottom" },
          margin: { t: 52, r: 16, b: 32, l: 60 },
        }}
        config={PLOTLY_CONFIG}
        className="w-full"
      />
      <p className="mt-1 text-xs text-text-muted">{profile.assessment}</p>
    </div>
  );
}
