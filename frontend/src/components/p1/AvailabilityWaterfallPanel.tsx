/**
 * Downtime breakdown waterfall — horizontal bar chart by IEC 61400-26 category.
 *
 * Y-axis: downtime category (human-readable label)
 * X-axis: hours of downtime
 * Colour: red for uncontrollable categories, amber for controllable.
 * Shows controllable_pct as a KPI badge above the chart.
 */

import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { SCADA_COLORS } from "../../constants/scadaColors";
import { useAvailabilityStore } from "../../store/availabilityStore";
import { Badge } from "../ui/Badge";

// ── Category label mapping ────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  SCHEDULED_MAINTENANCE: "Scheduled Maintenance",
  UNSCHEDULED_MAINTENANCE: "Unscheduled Maintenance",
  GRID_OUTAGE: "Grid Outage",
  ENVIRONMENTAL_CURTAILMENT: "Environmental Curtailment",
  FORCE_MAJEURE: "Force Majeure",
  TECHNICAL_STANDBY: "Technical Standby",
  EXTERNAL_FACTORS: "External Factors",
  COMMISSIONING: "Commissioning / Testing",
  BLADE_EROSION: "Blade Erosion",
  GEARBOX: "Gearbox Fault",
  GENERATOR: "Generator Fault",
  CONTROL_SYSTEM: "Control System",
  ICING: "Blade Icing",
  CABLE_FAULT: "Cable Fault",
  TRANSFORMER: "Transformer Fault",
};

function categoryLabel(code: string): string {
  return CATEGORY_LABELS[code] ?? code.replace(/_/g, " ");
}

export default function AvailabilityWaterfallPanel() {
  const { breakdown } = useAvailabilityStore();

  if (!breakdown) return null;

  const { categories, controllable_pct, assessment } = breakdown;

  // Sort by hours descending for visual clarity
  const sorted = [...categories].sort((a, b) => b.hours - a.hours);

  const labels = sorted.map((c) => categoryLabel(c.category));
  const hours = sorted.map((c) => c.hours);
  const colors = sorted.map((c) =>
    c.controllable ? SCADA_COLORS.WARNING : SCADA_COLORS.FAULT,
  );
  const hoverTexts = sorted.map(
    (c) =>
      `${categoryLabel(c.category)}<br>Hours: ${c.hours.toFixed(1)}<br>Energy loss: ${c.energy_loss_mwh.toFixed(0)} MWh<br>Share: ${c.share_pct.toFixed(1)}%<br>${c.controllable ? "Controllable" : "Uncontrollable"}`,
  );

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-base font-semibold text-text-primary">
          Downtime Breakdown by IEC 61400-26 Category
        </h3>
        <Badge variant={controllable_pct > 50 ? "warning" : "normal"}>
          {controllable_pct.toFixed(1)}% Controllable
        </Badge>
      </div>

      {/* Horizontal bar chart */}
      <Plot
        data={[
          {
            type: "bar",
            orientation: "h",
            y: labels,
            x: hours,
            marker: { color: colors },
            text: hours.map((h) => `${h.toFixed(1)} h`),
            textposition: "outside",
            textfont: { size: 11, color: "#9ba3b8" },
            hovertemplate: hoverTexts.map((t) => `${t}<extra></extra>`),
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: Math.max(260, sorted.length * 32 + 80),
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            title: { text: "Downtime [hours]", font: { color: "#9ba3b8", size: 12 } },
          },
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            automargin: true,
            tickfont: { size: 11, color: "#9ba3b8", family: "'Inter', sans-serif" },
          },
          margin: { t: 20, r: 80, b: 56, l: 180 },
        }}
        config={PLOTLY_CONFIG}
        className="w-full"
      />

      {/* Legend + assessment */}
      <div className="flex items-center gap-4 mt-2 text-xs text-text-muted flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: SCADA_COLORS.WARNING }} />
          Controllable
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: SCADA_COLORS.FAULT }} />
          Uncontrollable
        </span>
      </div>
      {assessment && (
        <p className="mt-2 text-xs text-text-muted italic">{assessment}</p>
      )}
    </div>
  );
}
