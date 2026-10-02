/**
 * Relay settings of the scheme and the grading checks, as two compact tables.
 */

import { useProtectionStore } from "../../store/protectionStore";
import type { ProtectionRelaySchema } from "../../types/protection";

function setting(r: ProtectionRelaySchema): string {
  if (r.relay_type === "PTOC") return `${r.pickup_value} × In (CT ${r.ct_primary_a.toFixed(0)} A) · IEC ${r.curve_type} · TMS ${r.tms.toFixed(2)}`;
  if (r.relay_type === "PDIF") return `differential · ${r.description.split("— ").pop()}`;
  if (r.relay_type === "PDIS") return `${r.pickup_value} % reach · ${r.time_delay_s.toFixed(1)} s`;
  return `${r.pickup_value} ${r.pickup_unit} · ${r.time_delay_s.toFixed(1)} s`;
}

export default function RelayCoordinationTable() {
  const { relays, study } = useProtectionStore();
  if (!relays.length) return null;
  const roleOf = new Map(study?.relay_sequence.map((e) => [e.relay_id, e.role]) ?? []);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-4">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted border-b border-border-primary">
              <th className="text-left font-normal py-1.5 pr-2">Relay</th>
              <th className="text-left font-normal py-1.5 pr-2">Zone</th>
              <th className="text-left font-normal py-1.5 pr-2">Setting</th>
              <th className="text-left font-normal py-1.5">This fault</th>
            </tr>
          </thead>
          <tbody>
            {relays.map((r) => (
              <tr key={r.setting_id} className="border-b border-border-primary/50">
                <td className="py-1.5 pr-2 font-mono text-text-primary whitespace-nowrap">{r.setting_id}</td>
                <td className="py-1.5 pr-2 text-text-secondary">{r.location}</td>
                <td className="py-1.5 pr-2 text-text-secondary">{setting(r)}</td>
                <td className="py-1.5 text-text-primary">{roleOf.get(r.setting_id) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {study && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-muted border-b border-border-primary">
                <th className="text-left font-normal py-1.5 pr-2">Grading pair</th>
                <th className="text-right font-normal py-1.5 pr-2">t down / up</th>
                <th className="text-right font-normal py-1.5">Margin</th>
              </tr>
            </thead>
            <tbody>
              {study.grading_results.map((g) => (
                <tr key={g.pair_id} className="border-b border-border-primary/50">
                  <td className="py-1.5 pr-2 font-mono text-text-primary">
                    {g.downstream_id} → {g.upstream_id}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono">
                    {g.downstream_delay_s.toFixed(3)} / {g.upstream_delay_s.toFixed(3)} s
                  </td>
                  <td className="py-1.5 text-right font-mono">
                    <span className={g.selective ? "text-status-normal" : "text-status-alarm"}>{g.selective ? "✓" : "✗"}</span>{" "}
                    {g.actual_margin_ms.toFixed(0)} ≥ {g.required_margin_ms.toFixed(0)} ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-text-muted mt-2">
            Overcurrent pairs are judged at the IEC 60909 maximum and minimum 66 kV fault currents (worst case shown).
          </p>
        </div>
      )}
    </div>
  );
}
