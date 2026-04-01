/**
 * O&M cost breakdown — horizontal bar chart in EUR millions.
 *
 * Y-axis: cost category (Planned, Unplanned, Vessel Charter, Heavy Lift, Insurance)
 * X-axis: cost in EUR millions
 * Colour: planned=green, unplanned=red, charter=blue, heavy_lift=orange, insurance=gray.
 *
 * Rule of thumb for offshore wind: ~60-80 EUR/MWh O&M cost for first-generation
 * HVDC-connected farms. Modern direct-drive with CTV fleets target <30 EUR/MWh.
 */

import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useWeatherWindowStore } from "../../store/weatherWindowStore";
import { Badge } from "../ui/Badge";

export default function OAMCostPanel() {
  const { oamCost } = useWeatherWindowStore();

  if (!oamCost) return null;

  const toM = (v: number) => v / 1_000_000;

  const categories = [
    { label: "Planned Maintenance", value: oamCost.planned_maintenance_eur, color: "#3ecf6e" },
    { label: "Unplanned Maintenance", value: oamCost.unplanned_maintenance_eur, color: "#ef4444" },
    { label: "Vessel Charter", value: oamCost.vessel_charter_eur, color: "#3b82f6" },
    { label: "Heavy Lift", value: oamCost.heavy_lift_eur, color: "#f97316" },
    { label: "Insurance", value: oamCost.insurance_eur, color: "#6b7280" },
  ];

  const labels = categories.map((c) => c.label);
  const values = categories.map((c) => toM(c.value));
  const colors = categories.map((c) => c.color);

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
      {/* Header + KPI badges */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-base font-semibold text-text-primary">
          Annual O&amp;M Cost Breakdown
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="neutral">
            Total: {toM(oamCost.total_oam_eur).toFixed(1)} M€/yr
          </Badge>
          <Badge variant="info">
            {oamCost.per_mw_eur.toFixed(0)} €/MW/yr
          </Badge>
        </div>
      </div>

      <Plot
        data={[
          {
            type: "bar",
            orientation: "h",
            y: labels,
            x: values,
            marker: { color: colors, opacity: 0.85 },
            text: values.map((v) => `${v.toFixed(2)} M€`),
            textposition: "outside",
            textfont: { size: 11, color: "#9ba3b8" },
            hovertemplate: "%{y}<br>%{x:.2f} M€<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: 280,
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            title: { text: "Cost [M€]", font: { color: "#9ba3b8", size: 12 } },
          },
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            automargin: true,
            tickfont: { size: 11, color: "#9ba3b8", family: "'Inter', sans-serif" },
          },
          margin: { t: 20, r: 80, b: 56, l: 160 },
        }}
        config={PLOTLY_CONFIG}
        className="w-full"
      />

      {/* Assessment */}
      {oamCost.assessment && (
        <p className="mt-2 text-xs text-text-muted italic">{oamCost.assessment}</p>
      )}
    </div>
  );
}
