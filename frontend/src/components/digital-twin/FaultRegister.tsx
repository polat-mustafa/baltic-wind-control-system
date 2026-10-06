/**
 * Fault register — every turbine the twin raised an event on, with the
 * identified fault, its size, the evidence and the projected life.
 */

import { useDigitalTwinStore } from "../../store/digitalTwinStore";
import type { TurbineSummary } from "../../services/digitalTwinApi";
import { ChartWrapper } from "../ui/ChartWrapper";
import { StatusChip } from "./StatusChip";
import { FAULT_CATEGORY, FAULT_LABEL, formatSeverity, formatTime } from "./twinFormat";

const RANK = { alarm: 0, alert: 1, normal: 2 } as const;

function rul(t: TurbineSummary): string {
  const p = t.prognosis;
  if (!p) return "—";
  if (p.status === "limit_exceeded") return "limit reached";
  if (p.status !== "trend" || p.rul_days == null) return "no trend";
  const hi = p.rul_upper_days != null ? p.rul_upper_days.toFixed(1) : "∞";
  return `${p.rul_days.toFixed(1)} d [${(p.rul_lower_days ?? 0).toFixed(1)}–${hi}]`;
}

export default function FaultRegister() {
  const analysis = useDigitalTwinStore((s) => s.analysis);
  const selectTurbine = useDigitalTwinStore((s) => s.selectTurbine);
  if (!analysis) return null;

  const rows = analysis.turbines
    .filter((t) => t.event_count > 0)
    .sort(
      (a, b) =>
        Number(b.diagnosis?.kind != null) - Number(a.diagnosis?.kind != null) ||
        RANK[a.status] - RANK[b.status] ||
        a.health_index - b.health_index,
    );

  return (
    <ChartWrapper
      title="Fault register"
      footer="Confidence = equal-prior posterior of the best hypothesis · explained = share of the no-fault misfit it removes · RUL with 90 % interval (ISO 13381-1)"
    >
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-text-muted">
          No deviation from the twin in this window.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-xs">
            <thead>
              <tr className="border-b border-border-primary text-left text-[10px] uppercase tracking-wider text-text-muted">
                <th className="py-2 pr-3 font-medium">Turbine</th>
                <th className="py-2 pr-3 font-medium">State</th>
                <th className="py-2 pr-3 font-medium text-right">HI</th>
                <th className="py-2 pr-3 font-medium">Identified fault</th>
                <th className="py-2 pr-3 font-medium text-right">Estimate</th>
                <th className="py-2 pr-3 font-medium text-right">Confidence</th>
                <th className="py-2 pr-3 font-medium text-right">Explained</th>
                <th className="py-2 pr-3 font-medium">First detected</th>
                <th className="py-2 pr-3 font-medium text-right">Lost</th>
                <th className="py-2 font-medium text-right">RUL</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const d = t.diagnosis;
                const kind = d?.kind ?? null;
                return (
                  <tr
                    key={t.turbine_id}
                    onClick={() => selectTurbine(t.turbine_id)}
                    className="cursor-pointer border-b border-border-primary/50 hover:bg-bg-tertiary/60"
                  >
                    <td className="py-2 pr-3 font-mono font-semibold text-text-primary">{t.name}</td>
                    <td className="py-2 pr-3">
                      <StatusChip status={t.status} compact />
                    </td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">{t.health_index.toFixed(0)}</td>
                    <td className="py-2 pr-3">
                      {kind ? (
                        <>
                          <span className="text-text-primary">{FAULT_LABEL[kind]}</span>
                          <span className="ml-1.5 text-[10px] text-text-muted">{FAULT_CATEGORY[kind]}</span>
                        </>
                      ) : (
                        <span className="text-text-muted italic">
                          {d ? "Detected — not identified" : "—"}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums text-text-primary">
                      {kind ? formatSeverity(kind, d?.severity ?? null) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">
                      {kind && d ? `${(d.posterior * 100).toFixed(0)} %` : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">
                      {d && d.explained > 0 ? `${(d.explained * 100).toFixed(0)} %` : "—"}
                    </td>
                    <td className="py-2 pr-3 font-mono text-text-secondary">{formatTime(t.first_detection)}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">
                      {kind ? `${t.lost_energy_mwh.toFixed(1)} MWh` : "—"}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">{rul(t)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </ChartWrapper>
  );
}
