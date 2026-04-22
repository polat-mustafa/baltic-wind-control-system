/**
 * AnomalyClassificationPanel — Donut chart + anomaly list table.
 *
 * Donut chart shows anomaly category breakdown (aerodynamic, mechanical,
 * electrical, control, sensor_drift). Table lists individual anomaly
 * records with severity, turbine, and description.
 */

import Plot from "react-plotly.js";

import { ChartWrapper } from "../ui/ChartWrapper";
import { useDigitalTwinStore } from "../../store/digitalTwinStore";

const CATEGORY_COLORS: Record<string, string> = {
  aerodynamic: "#3b82f6",
  mechanical: "#f59e0b",
  electrical: "#ef4444",
  control: "#8b5cf6",
  sensor_drift: "#06b6d4",
};

const SEVERITY_BADGE: Record<string, string> = {
  low: "bg-blue-500/20 text-blue-400",
  medium: "bg-amber-500/20 text-amber-400",
  high: "bg-red-500/20 text-red-400",
};

export default function AnomalyClassificationPanel() {
  const analysis = useDigitalTwinStore((s) => s.analysis);

  if (!analysis) return null;

  const { anomalies } = analysis;

  if (anomalies.length === 0) {
    return (
      <ChartWrapper title="Anomaly Classification">
        <div className="flex items-center justify-center h-40">
          <p className="text-text-muted text-sm">No anomalies detected</p>
        </div>
      </ChartWrapper>
    );
  }

  // Count by category
  const counts: Record<string, number> = {};
  for (const a of anomalies) {
    counts[a.category] = (counts[a.category] ?? 0) + 1;
  }

  const categories = Object.keys(counts);
  const values = categories.map((c) => counts[c]);
  const colors = categories.map((c) => CATEGORY_COLORS[c] ?? "#64748b");

  // Show most significant anomalies across the farm (max 8 rows).
  // Ranking by severity first, then by max EWMA magnitude — otherwise the
  // table would always land on the last turbine's records (appended in order).
  const severityRank = (s: string): number =>
    s === "high" ? 2 : s === "medium" ? 1 : 0;
  const maxMag = (x: {
    power_ewma_pct: number;
    rpm_ewma_pct: number;
    pitch_ewma_pct: number;
  }): number =>
    Math.max(
      Math.abs(x.power_ewma_pct),
      Math.abs(x.rpm_ewma_pct),
      Math.abs(x.pitch_ewma_pct),
    );
  const latestAnomalies = [...anomalies]
    .sort((a, b) => {
      const sev = severityRank(b.severity) - severityRank(a.severity);
      return sev !== 0 ? sev : maxMag(b) - maxMag(a);
    })
    .slice(0, 8);

  return (
    <ChartWrapper
      title="Anomaly Classification"
      footer={`${anomalies.length} total anomalies across ${new Set(anomalies.map((a) => a.turbine_id)).size} turbines`}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Donut chart */}
        <Plot
          data={[
            {
              values,
              labels: categories.map((c) => c.replace("_", " ")),
              type: "pie",
              hole: 0.5,
              marker: { colors },
              textinfo: "label+percent",
              textposition: "outside",
              textfont: { size: 11 },
            },
          ]}
          layout={{
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 11 },
            margin: { t: 10, r: 10, b: 10, l: 10 },
            showlegend: false,
            height: 260,
            width: 260,
          }}
          config={{ responsive: true, displayModeBar: false }}
        />

        {/* Anomaly table */}
        <div className="overflow-y-auto max-h-[200px]">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-text-muted uppercase border-b border-border-primary">
                <th className="py-1 text-left">Turbine</th>
                <th className="py-1 text-left">Type</th>
                <th className="py-1 text-left">Severity</th>
              </tr>
            </thead>
            <tbody>
              {latestAnomalies.map((a, i) => (
                <tr
                  key={`${a.turbine_id}-${a.timestep}-${i}`}
                  className="border-b border-border-primary/50"
                >
                  <td className="py-1 text-text-secondary font-mono">
                    WTG-{String(a.turbine_id + 1).padStart(2, "0")}
                  </td>
                  <td className="py-1 text-text-secondary capitalize">
                    {a.category.replace("_", " ")}
                  </td>
                  <td className="py-1">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${SEVERITY_BADGE[a.severity] ?? ""}`}
                    >
                      {a.severity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ChartWrapper>
  );
}
