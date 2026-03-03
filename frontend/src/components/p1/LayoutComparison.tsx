/**
 * Layout comparison panel — side-by-side metric cards for each layout.
 *
 * Shows net AEP, wake loss, CF, revenue, and P90 for each layout.
 * Best layout highlighted with green border.
 */

import { useWindResourceStore } from "../../store/windResourceStore";
import { SCADA_COLORS } from "../../constants/scadaColors";
import { InfoButton } from "../ui/InfoButton";
import { layoutComparisonInfo } from "../../constants/panelInfo";

export default function LayoutComparison() {
  const { layoutComparison } = useWindResourceStore();

  if (!layoutComparison || layoutComparison.layouts.length === 0) return null;

  return (
    <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">
          Layout Comparison
        {layoutComparison.improvement_percent > 0 && (
          <span className="ml-2 text-xs font-normal text-emerald-400">
            Best layout improves AEP by{" "}
            {layoutComparison.improvement_percent.toFixed(2)}%
          </span>
        )}
        </h3>
        <InfoButton info={layoutComparisonInfo} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {layoutComparison.layouts.map((entry) => {
          const isBest = entry.name === layoutComparison.best_layout;
          return (
            <div
              key={entry.name}
              className={`rounded-lg p-4 border ${
                isBest
                  ? "border-emerald-500/60 bg-emerald-900/10"
                  : "border-border-secondary bg-slate-700/30"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold capitalize">
                  {entry.name}
                </h4>
                {isBest && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded font-medium"
                    style={{
                      backgroundColor: "rgba(16, 185, 129, 0.2)",
                      color: SCADA_COLORS.ENERGIZED,
                    }}
                  >
                    BEST
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-text-muted">Net AEP</span>
                  <p className="text-white font-mono">
                    {entry.net_aep_gwh.toFixed(1)} GWh
                  </p>
                </div>
                <div>
                  <span className="text-text-muted">Wake Loss</span>
                  <p className="text-white font-mono">
                    {entry.wake_loss_percent.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <span className="text-text-muted">Capacity Factor</span>
                  <p className="text-white font-mono">
                    {(entry.capacity_factor * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <span className="text-text-muted">Revenue (P50)</span>
                  <p className="text-white font-mono">
                    {entry.revenue_meur.toFixed(1)} M{"\u20AC"}
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="text-text-muted">
                    P90 (financing)
                  </span>
                  <p className="text-white font-mono">
                    {entry.p90_gwh.toFixed(1)} GWh
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
