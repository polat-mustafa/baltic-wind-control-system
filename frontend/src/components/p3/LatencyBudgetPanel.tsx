/**
 * IEC 61850-5 transfer-time budgets for three message paths.
 *
 * Transfer time = sender stack + network + receiver stack. Each bar is drawn
 * on the scale of its own requirement (100 % = the class limit), so the
 * unused part is the margin: trip GOOSE TT6 ≤ 3 ms, measurement report
 * TT3 ≤ 100 ms, operator display over the WAN TT1 ≤ 1000 ms.
 */

import { useNetworkStore } from "../../store/networkStore";
import { useChartPalette } from "../../hooks/useChartPalette";

const label = (k: string) => k.replace(/_ms$/, "").replace(/_/g, " ");

export default function LatencyBudgetPanel() {
  const budgets = useNetworkStore((s) => s.latencyBudgets);
  const c = useChartPalette();
  const colors = [c.blue, c.orange, c.aqua, c.yellow, c.red];

  if (!budgets.length) return null;

  return (
    <section className="bg-bg-secondary rounded-lg border border-border-primary p-3">
      <h3 className="text-xs font-semibold text-text-primary">Transfer-time budgets · IEC 61850-5</h3>
      <p className="text-xs text-text-muted mb-3">Each bar is scaled to its class limit; the empty part is the margin.</p>
      <div className="space-y-4">
        {budgets.map((b) => {
          const parts = Object.entries(b.budget_breakdown);
          return (
            <div key={b.performance_class}>
              <div className="flex flex-wrap items-baseline gap-x-3 text-xs mb-1">
                <span className="font-mono font-semibold text-text-primary">{b.performance_class}</span>
                <span className="text-text-secondary">{b.path_description}</span>
                <span className="ml-auto font-mono text-text-primary">
                  {b.total_latency_ms.toFixed(b.required_latency_ms < 10 ? 2 : 1)} ms
                  <span className="text-text-muted"> / {b.required_latency_ms} ms · margin {b.margin_ms.toFixed(b.required_latency_ms < 10 ? 2 : 0)} ms</span>
                  {!b.compliant && <b className="text-status-alarm"> EXCEEDED</b>}
                </span>
              </div>
              <div className="flex h-5 w-full rounded overflow-hidden border border-border-primary" role="img" aria-label={`${b.performance_class} budget`}>
                {parts.map(([k, ms], i) => (
                  <div
                    key={k}
                    style={{ width: `${(Number(ms) / b.required_latency_ms) * 100}%`, background: colors[i % colors.length] }}
                    title={`${label(k)}: ${Number(ms)} ms`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-text-muted">
                {parts.map(([k, ms], i) => (
                  <span key={k} className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: colors[i % colors.length] }} />
                    {label(k)} <span className="font-mono text-text-secondary">{Number(ms)} ms</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
