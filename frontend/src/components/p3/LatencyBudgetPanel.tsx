/**
 * Latency Budget Panel — M15 Network Architecture.
 *
 * Three IEC 61850 performance-class latency paths shown as horizontal bar breakdowns:
 *   P3: GOOSE (4 ms budget) — protection tripping
 *   P2: Sampled Values / measurement (100 ms) — metering
 *   P1: SCADA polling (1000 ms) — supervisory
 *
 * All three paths must be compliant for IEC 61850 certification.
 */

import { useNetworkStore } from "../../store/networkStore";

const CLASS_COLOR: Record<string, string> = {
  P3: "#ef4444",    // red — strictest
  P2: "#f59e0b",    // amber
  P1: "#3ecf6e",    // green — most relaxed
};

export default function LatencyBudgetPanel() {
  const { latencyBudgets } = useNetworkStore();

  if (latencyBudgets.length === 0) return null;

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
      <h3 className="text-sm font-semibold text-text-primary mb-3">
        IEC 61850 Latency Budgets
      </h3>
      <div className="space-y-4">
        {latencyBudgets.map((budget) => {
          const classLabel = budget.performance_class;
          const color = CLASS_COLOR[classLabel] ?? "#9ba3b8";
          const breakdown = Object.entries(budget.budget_breakdown);

          return (
            <div key={budget.performance_class}>
              <div className="flex items-center justify-between mb-1.5 text-xs">
                <span className="font-mono font-semibold" style={{ color }}>{classLabel}</span>
                <span className="text-text-muted">{budget.path_description}</span>
                <span className={budget.compliant ? "text-status-success" : "text-status-alarm"}>
                  {budget.total_latency_ms.toFixed(2)} / {budget.required_latency_ms} ms
                  {budget.compliant ? " ✓" : " ✗"}
                </span>
              </div>

              {/* Breakdown bars */}
              <div className="flex h-4 rounded overflow-hidden mb-1 w-full">
                {breakdown.map(([segment, ms], i) => {
                  const pct = (Number(ms) / budget.required_latency_ms) * 100;
                  const segColors = ["#3ecf6e44", "#60a5fa44", "#f59e0b44", "#a78bfa44", "#fb923c44"];
                  return (
                    <div
                      key={segment}
                      className="h-full flex items-center justify-center text-[9px] font-mono overflow-hidden"
                      style={{ width: `${Math.min(pct, 40)}%`, minWidth: 2, backgroundColor: segColors[i % segColors.length], border: `1px solid ${segColors[i % segColors.length].replace("44", "")}` }}
                      title={`${segment}: ${Number(ms).toFixed(2)} ms`}
                    >
                      {pct > 10 ? `${Number(ms).toFixed(1)}ms` : ""}
                    </div>
                  );
                })}
                {/* Margin */}
                <div
                  className="h-full flex-1 text-[9px] flex items-center pl-1"
                  style={{ backgroundColor: budget.compliant ? "#3ecf6e22" : "#ef444422" }}
                >
                  {budget.margin_ms > 0 ? `+${budget.margin_ms.toFixed(1)} ms` : ""}
                </div>
              </div>

              <div className="flex gap-3 flex-wrap text-[10px] text-text-muted">
                {breakdown.map(([segment, ms]) => (
                  <span key={segment}><span className="text-text-secondary">{segment}:</span> {Number(ms).toFixed(2)} ms</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
