/**
 * Where the losses of the selected load-flow case go (LoadFlowResult.loss_breakdown_mw):
 * export cable, array cables, the three transformer stages, reactors, STATCOM, filter
 * and the OSS auxiliary load. One stacked bar (shares of the total) and the table.
 * Total = WTG output − POC export [MW].
 */

import { scenarioLabels } from "../../constants/gridScenarios";
import { useChartPalette } from "../../hooks/useChartPalette";
import { useGridStore, useNetwork } from "../../store/gridStore";
import type { LossComponent } from "../../types/grid";

const LOSS_LABEL: Record<LossComponent, string> = {
  export_cable: "Export cables",
  array_cables: "Array cables",
  oss_transformers: "OSS transformers",
  onshore_transformers: "Onshore transformers",
  wtg_transformers: "WTG transformers",
  shunt_reactors: "Shunt reactors",
  statcom: "STATCOM",
  harmonic_filter: "Harmonic filter",
  auxiliary: "OSS auxiliary load",
};

export default function LossBreakdownPanel() {
  const { loadFlowResults, activeScenario } = useGridStore();
  const n = useNetwork();
  const c = useChartPalette();
  const r = loadFlowResults?.find((x) => x.scenario === activeScenario);
  const b = r?.loss_breakdown_mw;
  if (!r || !b) return null;

  const rows = (Object.entries(b) as [LossComponent, number][]).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
  const total = r.total_loss_mw;
  const colors = [c.blue, c.orange, c.aqua, c.yellow, c.red, ...c.seq.slice(3)];
  const share = (v: number) => (total > 0 ? (v / total) * 100 : 0);

  return (
    <div className="rounded-lg border border-border-primary bg-bg-secondary p-4 space-y-2" aria-label="Loss breakdown">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-text-primary">Where the losses go</h4>
        <p className="text-xs text-text-muted">
          <span>{scenarioLabels(n)[activeScenario]}</span> ·{" "}
          <span translate="no" className="font-mono text-text-primary">
            {total.toFixed(2)} MW ({r.total_generation_mw > 0 ? ((total / r.total_generation_mw) * 100).toFixed(2) : "—"} %)
          </span>
        </p>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded" role="img" aria-label="Loss shares">
        {rows.map(([k, v], i) => (
          <span key={k} title={`${LOSS_LABEL[k] ?? k}: ${v.toFixed(2)} MW`} style={{ width: `${share(v)}%`, background: colors[i % colors.length] }} />
        ))}
      </div>
      <table className="w-full text-xs">
        <tbody>
          {rows.map(([k, v], i) => (
            <tr key={k} className="border-t border-border-primary text-text-secondary">
              <td className="py-0.5 pr-2">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: colors[i % colors.length] }} />
                {LOSS_LABEL[k] ?? k}
              </td>
              <td className="py-0.5 pr-2 text-right font-mono text-text-primary">{v.toFixed(2)} MW</td>
              <td className="py-0.5 text-right font-mono">{share(v).toFixed(0)} %</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-text-muted">pandapower Newton-Raphson; total = WTG output − POC export, OSS auxiliary load included.</p>
    </div>
  );
}
