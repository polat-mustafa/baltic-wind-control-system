/**
 * Diagnostic performance against the injected ground truth.
 *
 * Only a simulation can score itself like this: every fault was injected
 * with a known start and size, so detection delay, isolation and sizing
 * error are measured, not claimed.
 */

import { Check, X } from "lucide-react";

import { useDigitalTwinStore } from "../../store/digitalTwinStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { FAULT_LABEL, FAULT_SHORT, formatHours, formatSeverity, formatTime } from "./twinFormat";

function Mark({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-text-primary">
      <Check size={13} className="text-status-normal" aria-hidden /> yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-status-alarm">
      <X size={13} aria-hidden /> no
    </span>
  );
}

export default function ValidationPanel() {
  const analysis = useDigitalTwinStore((s) => s.analysis);
  if (!analysis) return null;
  const v = analysis.validation;

  return (
    <ChartWrapper
      title="Validation against injected faults"
      footer="Delay = first confirmed event after injection onset. Injected size = mean over the fitted window (faults that ramp are averaged the same way the estimate is)."
    >
      <div className="mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {[
          ["Injected", `${v.injected}`],
          ["Detected", `${v.detected} / ${v.injected}`],
          ["Correctly isolated", `${v.isolated} / ${v.injected}`],
          ["False events", `${v.false_events}`],
        ].map(([k, val]) => (
          <div key={k} className="rounded-md bg-bg-tertiary/70 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">{k}</div>
            <div className="font-mono text-base font-semibold tabular-nums text-text-primary">{val}</div>
          </div>
        ))}
      </div>
      {v.rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-muted">
          Fault-free scenario — the only score is the false-event count above (in-control behaviour).
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-xs">
            <thead>
              <tr className="border-b border-border-primary text-left text-[10px] uppercase tracking-wider text-text-muted">
                <th className="py-2 pr-3 font-medium">Turbine</th>
                <th className="py-2 pr-3 font-medium">Injected fault</th>
                <th className="py-2 pr-3 font-medium">Onset</th>
                <th className="py-2 pr-3 font-medium">Detected</th>
                <th className="py-2 pr-3 font-medium text-right">Delay</th>
                <th className="py-2 pr-3 font-medium">Diagnosed as</th>
                <th className="py-2 pr-3 font-medium">Correct</th>
                <th className="py-2 pr-3 font-medium text-right">Injected size</th>
                <th className="py-2 font-medium text-right">Estimated</th>
              </tr>
            </thead>
            <tbody>
              {v.rows.map((r) => (
                <tr key={`${r.turbine_id}-${r.injected_kind}`} className="border-b border-border-primary/50">
                  <td className="py-2 pr-3 font-mono font-semibold text-text-primary">{r.turbine_name}</td>
                  <td className="py-2 pr-3 text-text-secondary">{FAULT_LABEL[r.injected_kind]}</td>
                  <td className="py-2 pr-3 font-mono text-text-secondary">{formatTime(r.onset)}</td>
                  <td className="py-2 pr-3">
                    <Mark ok={r.detected} />
                  </td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">{formatHours(r.delay_hours)}</td>
                  <td className="py-2 pr-3 text-text-secondary">
                    {r.diagnosed_kind ? FAULT_SHORT[r.diagnosed_kind] : "—"}
                  </td>
                  <td className="py-2 pr-3">
                    <Mark ok={r.isolation_correct} />
                  </td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">
                    {formatSeverity(r.injected_kind, r.injected_severity)}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-text-primary">
                    {r.diagnosed_kind ? formatSeverity(r.diagnosed_kind, r.estimated_severity) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartWrapper>
  );
}
