/**
 * Monthly vessel access probability — grouped bar chart.
 *
 * X-axis: months (Jan–Dec)
 * Y-axis: access probability [%]
 * One bar series per vessel type: CTV, SOV, JACK_UP, HELICOPTER.
 *
 * Access limits are derived from ERA5 Hs (significant wave height)
 * and Uw (wind speed) hindcast thresholds per vessel type.
 * CTV: Hs ≤1.5 m; SOV: Hs ≤2.5 m; Jack-up: Hs ≤1.5 m + Uw ≤10 m/s;
 * Helicopter: Uw ≤15 m/s.
 */

import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useChartPalette } from "../../hooks/useChartPalette";
import { useWeatherWindowStore } from "../../store/weatherWindowStore";
import { Badge } from "../ui/Badge";
import { EducationButton } from "../ui/EducationButton";
import { weatherWindowEducation } from "../../constants/education/p1";

// ── Vessel display config ─────────────────────────────────────────

const VESSEL_LABEL: Record<string, string> = {
  CTV: "CTV (crew transfer, Hs ≤ 1.5 m)",
  SOV: "SOV (walk-to-work gangway)",
  JACK_UP: "Jack-up (heavy lift)",
  HELICOPTER: "Helicopter",
};
const VESSEL_SLOT = ["blue", "orange", "aqua", "yellow"] as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function WeatherWindowPanel() {
  const { vesselAccess } = useWeatherWindowStore();
  const c = useChartPalette();

  if (!vesselAccess) return null;

  // Seasonality reads best as lines: one per access method, fixed colour slot
  const traces = vesselAccess.vessels.map((v, i) => {
    const label = VESSEL_LABEL[v.vessel] ?? v.vessel;
    const color = c[VESSEL_SLOT[i % VESSEL_SLOT.length]];
    return {
      type: "scatter" as const,
      mode: "lines+markers" as const,
      name: label,
      x: MONTHS,
      y: v.monthly_access_pct,
      line: { color, width: 2 },
      marker: { color, size: 8 },
      hovertemplate: `${label}<br>%{x}: %{y:.0f} % of days accessible<extra></extra>`,
    };
  });

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-text-primary">
            Monthly access probability by vessel type
          </h3>
          <EducationButton content={weatherWindowEducation} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {vesselAccess.vessels.map((v) => (
            <Badge key={v.vessel} variant="neutral">
              {v.vessel}: {v.annual_average_pct.toFixed(0)}%/yr
            </Badge>
          ))}
        </div>
      </div>

      <Plot
        data={traces}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: 340,
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            title: { text: "Month", font: { size: 12 } },
          },
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            title: { text: "Access probability [%]", font: { size: 12 } },
            range: [0, 105],
          },
          legend: {
            ...DARK_PLOTLY_LAYOUT.legend,
            orientation: "h",
            x: 0,
            y: -0.22,
          },
          margin: { t: 20, r: 24, b: 80, l: 68 },
        }}
        config={PLOTLY_CONFIG}
        className="w-full"
      />

      {/* Limiting parameters */}
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-text-muted">
        {vesselAccess.vessels.map((v) => (
          <span key={v.vessel}>
            <span className="font-medium text-text-secondary">{v.vessel}:</span>{" "}
            {v.limiting_parameter}
          </span>
        ))}
      </div>

      {/* Provenance: measured, not modelled */}
      {vesselAccess.hindcast && (
        <p className="mt-2 text-xs text-text-muted">
          Measured: share of 6-hour steps with Hs and wind inside the vessel limits — {vesselAccess.hindcast}.
        </p>
      )}
      {vesselAccess.sea_ice && (
        <p className="mt-1 text-xs text-text-muted">
          Sea ice at the site: {vesselAccess.sea_ice.winters_with_ice} of {vesselAccess.sea_ice.winters} winters,
          mean {vesselAccess.sea_ice.mean_ice_days.toFixed(1)} days a winter (max{" "}
          {Math.max(...Object.values(vesselAccess.sea_ice.ice_days_by_winter))} d) — {vesselAccess.sea_ice.source}.{" "}
          {vesselAccess.sea_ice.note}
        </p>
      )}
    </div>
  );
}
