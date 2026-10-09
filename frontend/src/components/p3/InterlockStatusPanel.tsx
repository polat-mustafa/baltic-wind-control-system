/**
 * Interlock matrix — 9 bays × 7 rules (IEC 61850 CILO), live from the bay
 * controllers. A filled cell means the rule currently blocks an operation
 * in that bay (e.g. ILK-002 blocks earthing while the breaker is closed —
 * normal for a bay in service). Hover a cell for the rule text.
 */

import { useEffect } from "react";

import { useBayStore } from "../../store/bayStore";
import { useScadaStore } from "../../store/scadaStore";
import { cn } from "../../lib/utils";

const RULES: [string, string][] = [
  ["ILK-001", "CB close ⟂ earth switch closed"],
  ["ILK-002", "Earthing ⟂ CB closed"],
  ["ILK-003", "Disconnector ⟂ CB closed (no load break)"],
  ["ILK-004", "CB close ⟂ bus disconnector open"],
  ["ILK-005", "Rack-out ⟂ CB closed"],
  ["ILK-006", "Auto-reclose ⟂ PTW isolation"],
  ["ILK-007", "No parallel OSS transformers via coupler"],
];

export default function InterlockStatusPanel() {
  const allBays = useBayStore((s) => s.allBays);
  const interlocks = useBayStore((s) => s.interlocks);
  const fetchAllBays = useBayStore((s) => s.fetchAllBays);
  const fetchAllInterlocks = useBayStore((s) => s.fetchAllInterlocks);
  const breakerStates = useScadaStore((s) => s.breakerStates);

  useEffect(() => {
    void fetchAllBays().then(fetchAllInterlocks);
  }, [fetchAllBays, fetchAllInterlocks, breakerStates]);

  const bays = [...(allBays?.bays ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="bg-bg-secondary rounded-lg border border-border-primary p-3 space-y-3">
      <div>
        <h3 className="text-xs font-semibold text-text-primary">Interlock matrix · OSS 66 kV bays</h3>
        <p className="text-xs text-text-muted">
          ■ = rule currently blocking an operation in the bay. In service, ILK-002/003/005 block earthing,
          disconnector and rack-out operations because the breaker is closed — that is the interlock doing its job.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse min-w-[720px] w-full">
          <thead>
            <tr className="text-text-muted">
              <th className="text-left font-medium py-1 pr-3">Rule</th>
              {bays.map((b) => (
                <th key={b.name} className="font-mono font-medium px-1 py-1 text-center" title={b.display_name}>
                  {b.name.replace("BAY-OSS-", "")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RULES.map(([id, text]) => (
              <tr key={id} className="border-t border-border-primary/60">
                <td className="py-1 pr-3 whitespace-nowrap">
                  <span className="font-mono text-text-primary">{id}</span> <span className="text-text-muted">{text}</span>
                </td>
                {bays.map((b) => {
                  const rule = interlocks[b.name]?.rules.find((r) => r.interlock_id === id);
                  return (
                    <td key={b.name} className="px-1 py-1 text-center" title={rule?.description}>
                      <span
                        className={cn(
                          "inline-block w-4 h-4 rounded-sm border",
                          rule?.currently_active ? "bg-status-warning border-status-warning" : "border-border-secondary",
                        )}
                        aria-label={rule?.currently_active ? "blocking" : "clear"}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
