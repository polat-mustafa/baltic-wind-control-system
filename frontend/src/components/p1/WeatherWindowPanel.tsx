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
import { useWeatherWindowStore } from "../../store/weatherWindowStore";
import { Badge } from "../ui/Badge";

// ── Vessel display config ─────────────────────────────────────────

const VESSEL_CONFIG: Record<string, { label: string; color: string }> = {
  CTV: { label: "CTV (Crew Transfer)", color: "#3b82f6" },
  SOV: { label: "SOV (Service Operations)", color: "#3ecf6e" },
  JACK_UP: { label: "Jack-Up", color: "#f97316" },
  HELICOPTER: { label: "Helicopter", color: "#a855f7" },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function WeatherWindowPanel() {
  const { vesselAccess } = useWeatherWindowStore();

  if (!vesselAccess) return null;

  const traces = vesselAccess.vessels.map((v) => {
    const cfg = VESSEL_CONFIG[v.vessel] ?? { label: v.vessel, color: "#9ba3b8" };
    return {
      type: "bar" as const,
      name: cfg.label,
      x: MONTHS,
      y: v.monthly_access_pct,
      marker: { color: cfg.color, opacity: 0.85 },
      hovertemplate: `${cfg.label}<br>%{x}: %{y:.1f}%<extra></extra>`,
    };
  });

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-base font-semibold text-text-primary">
          Monthly Vessel Access Probability by Type
        </h3>
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
          barmode: "group",
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            title: { text: "Month", font: { color: "#9ba3b8", size: 12 } },
          },
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            title: { text: "Access Probability [%]", font: { color: "#9ba3b8", size: 12 } },
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
    </div>
  );
}
