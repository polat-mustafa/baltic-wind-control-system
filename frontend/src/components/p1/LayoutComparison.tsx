/**
 * Layout comparison — regular vs staggered grid through the full AEP cascade.
 *
 * A table, because the point is the difference: the Δ column shows what the
 * better layout buys, in GWh and M€ per year.
 */

import { layoutComparisonEducation } from "../../constants/education/p1";
import { useWindResourceStore } from "../../store/windResourceStore";
import type { LayoutCascadeEntry } from "../../types/windResource";
import { EducationButton } from "../ui/EducationButton";

const ROWS: { label: string; get: (e: LayoutCascadeEntry) => number; unit: string; digits: number; better: "high" | "low" }[] = [
  { label: "Net AEP (P50)", get: (e) => e.net_aep_gwh, unit: "GWh/yr", digits: 1, better: "high" },
  { label: "P90 (financing)", get: (e) => e.p90_gwh, unit: "GWh/yr", digits: 1, better: "high" },
  { label: "Wake loss", get: (e) => e.wake_loss_percent, unit: "%", digits: 2, better: "low" },
  { label: "Capacity factor", get: (e) => e.capacity_factor * 100, unit: "%", digits: 2, better: "high" },
  { label: "Revenue (P50)", get: (e) => e.revenue_meur, unit: "M€/yr", digits: 2, better: "high" },
];

export default function LayoutComparison() {
  const { layoutComparison } = useWindResourceStore();
  if (!layoutComparison || layoutComparison.layouts.length < 2) return null;

  const [a, b] = layoutComparison.layouts;
  const best = layoutComparison.best_layout;

  return (
    <section className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-base font-semibold text-text-primary">Layout comparison — {a.name} vs {b.name}</h3>
          <p className="text-xs text-text-muted mt-0.5">
            Same turbines, same wind rose; only the positions change. The <span className="capitalize">{best}</span>{" "}
            layout gains {layoutComparison.improvement_percent.toFixed(2)} % net AEP.
          </p>
        </div>
        <EducationButton content={layoutComparisonEducation} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-xs text-text-muted border-b border-border-primary">
              <th className="text-left font-medium py-1.5 pr-4">Metric</th>
              {[a, b].map((e) => (
                <th key={e.name} className="text-right font-medium py-1.5 px-3 capitalize">
                  {e.name} {e.name === best && <span className="ml-1 rounded bg-accent/15 px-1.5 py-0.5 text-xs font-semibold text-accent">better</span>}
                </th>
              ))}
              <th className="text-right font-medium py-1.5 pl-3">Δ ({b.name} − {a.name})</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {ROWS.map((r) => {
              const d = r.get(b) - r.get(a);
              const good = r.better === "high" ? d > 0 : d < 0;
              return (
                <tr key={r.label} className="border-b border-border-primary/40">
                  <td className="py-1.5 pr-4 font-sans text-text-secondary">{r.label}</td>
                  <td className="py-1.5 px-3 text-right text-text-primary">{r.get(a).toFixed(r.digits)}</td>
                  <td className="py-1.5 px-3 text-right text-text-primary">{r.get(b).toFixed(r.digits)}</td>
                  <td className={`py-1.5 pl-3 text-right ${Math.abs(d) < 1e-9 ? "text-text-muted" : good ? "text-status-normal" : "text-status-alarm"}`}>
                    {d >= 0 ? "+" : "−"}{Math.abs(d).toFixed(r.digits)} <span className="text-text-muted font-sans text-xs">{r.unit}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
