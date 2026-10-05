/**
 * Selected turbine: state, channel health, diagnosis with advisory, prognosis.
 */

import { ChevronLeft, ChevronRight, ClipboardCheck, Stethoscope, Timer } from "lucide-react";

import { cn } from "../../lib/utils";
import { useDigitalTwinStore } from "../../store/digitalTwinStore";
import type { TurbineSummary } from "../../services/digitalTwinApi";
import { StatusChip } from "./StatusChip";
import {
  CHANNEL_META,
  CHANNEL_ORDER,
  FAULT_CATEGORY,
  FAULT_LABEL,
  formatSeverity,
  formatTime,
  healthZone,
} from "./twinFormat";

const BAR = {
  normal: "bg-text-muted",
  alert: "bg-status-warning",
  alarm: "bg-status-alarm",
} as const;

function ChannelBars({ t }: { t: TurbineSummary }) {
  return (
    <ul className="space-y-1.5">
      {CHANNEL_ORDER.map((k) => {
        const hi = t.channel_health[k];
        const zone = healthZone(hi);
        return (
          <li key={k} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-2 text-[11px]">
            <span className="truncate text-text-secondary">{CHANNEL_META[k].label}</span>
            <span className="h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
              <span className={cn("block h-full rounded-full", BAR[zone])} style={{ width: `${hi}%` }} />
            </span>
            <span className="text-right font-mono tabular-nums text-text-primary">{hi.toFixed(0)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default function TurbineHeader() {
  const analysis = useDigitalTwinStore((s) => s.analysis);
  const selected = useDigitalTwinStore((s) => s.selectedTurbineId);
  const selectTurbine = useDigitalTwinStore((s) => s.selectTurbine);
  const modelCard = useDigitalTwinStore((s) => s.modelCard);
  if (!analysis || selected == null) return null;

  const t = analysis.turbines[selected];
  const d = t.diagnosis;
  const p = t.prognosis;
  const mode = d?.kind ? modelCard?.fault_library.find((m) => m.kind === d.kind) : undefined;
  const step = (delta: number) =>
    selectTurbine((selected + delta + analysis.turbines.length) % analysis.turbines.length, false);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(18rem,22rem)_1fr] gap-3">
      <div className="rounded-lg border border-border-primary bg-bg-secondary p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => step(-1)}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-tertiary"
              aria-label="Previous turbine"
            >
              <ChevronLeft size={16} />
            </button>
            <select
              value={selected}
              onChange={(e) => selectTurbine(Number(e.target.value), false)}
              aria-label="Turbine"
              className="bg-bg-tertiary border border-border-secondary rounded-md px-2 py-1 text-sm font-mono font-semibold text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {analysis.turbines.map((x) => (
                <option key={x.turbine_id} value={x.turbine_id}>
                  {x.name}
                  {x.diagnosis?.kind ? " •" : ""}
                </option>
              ))}
            </select>
            <button
              onClick={() => step(1)}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-tertiary"
              aria-label="Next turbine"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <StatusChip status={t.status} />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-3xl font-semibold tabular-nums text-text-primary">
            {t.health_index.toFixed(0)}
          </span>
          <span className="text-xs text-text-muted">health index (weakest channel, now)</span>
        </div>
        <ChannelBars t={t} />
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <dt className="text-text-muted">Events</dt>
          <dd className="text-right font-mono">
            {t.event_count} ({t.active_event_count} active)
          </dd>
          <dt className="text-text-muted">First detected</dt>
          <dd className="text-right font-mono">{formatTime(t.first_detection)}</dd>
          <dt className="text-text-muted">Last evidence</dt>
          <dd className="text-right font-mono">{formatTime(t.last_evidence)}</dd>
          <dt className="text-text-muted">Energy actual / twin</dt>
          <dd className="text-right font-mono">
            {t.actual_energy_mwh.toFixed(0)} / {t.potential_energy_mwh.toFixed(0)} MWh
          </dd>
        </dl>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3">
        <div className="rounded-lg border border-border-primary bg-bg-secondary p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-text-muted">
            <Stethoscope size={13} /> Diagnosis (HA)
          </div>
          {!d ? (
            <p className="text-sm text-text-secondary">
              No deviation from the twin in this window — all five residual charts stayed inside their
              control limits.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-base font-semibold text-text-primary">
                  {d.kind ? FAULT_LABEL[d.kind] : "Unexplained deviation"}
                </h3>
                {d.kind && (
                  <span className="text-[11px] text-text-muted">{FAULT_CATEGORY[d.kind]} fault</span>
                )}
              </div>
              {d.kind && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["Estimate", formatSeverity(d.kind, d.severity)],
                    ["Confidence", `${(d.posterior * 100).toFixed(0)} %`],
                    ["Explained", `${(d.explained * 100).toFixed(0)} %`],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-md bg-bg-tertiary/70 px-2.5 py-1.5">
                      <div className="text-[10px] uppercase tracking-wider text-text-muted">{k}</div>
                      <div className="font-mono text-sm font-semibold tabular-nums text-text-primary">{v}</div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-text-secondary">{d.cause_hint}</p>
              <p className="text-[11px] text-text-muted">
                Fitted on {d.samples_used} producing samples, {formatTime(d.window_start)} –{" "}
                {formatTime(d.window_end)} · mean ambient {d.mean_ambient_c.toFixed(1)} °C,{" "}
                {d.mean_humidity_pct.toFixed(0)} % RH · likelihood-ratio statistic{" "}
                {d.lr_statistic.toFixed(0)}
              </p>
            </>
          )}
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-border-primary bg-bg-secondary p-4 space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-text-muted">
              <ClipboardCheck size={13} /> Advisory (AG)
            </div>
            <p className="text-xs leading-relaxed text-text-secondary">
              {d?.advisory ?? (d ? "Review the raw channels; no modelled fault explains the deviation." : "No action.")}
            </p>
            {mode && (
              <ul className="space-y-0.5 text-[10px] text-text-muted">
                {mode.references.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-lg border border-border-primary bg-bg-secondary p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-text-muted">
              <Timer size={13} /> Prognosis (PA)
            </div>
            {!p ? (
              <p className="text-xs text-text-secondary">
                {d?.kind ? "Not a wear process — act on the advisory, no life projection." : "—"}
              </p>
            ) : p.status === "trend" && p.rul_days != null ? (
              <>
                <div className="font-mono text-xl font-semibold tabular-nums text-text-primary">
                  {p.rul_days.toFixed(1)} d
                  <span className="ml-2 text-xs font-normal text-text-muted">
                    90 % [{(p.rul_lower_days ?? 0).toFixed(1)} – {p.rul_upper_days?.toFixed(1) ?? "∞"}] d
                  </span>
                </div>
                <p className="text-[11px] text-text-muted">
                  to the limit {p.limit} ({p.limit_note}) · rate {p.slope_per_day.toFixed(3)} ± {p.slope_std_error.toFixed(3)}
                  /d · p = {p.p_value < 1e-4 ? "< 0.0001" : p.p_value.toFixed(4)}
                </p>
              </>
            ) : (
              <p className="text-xs text-text-secondary">
                {p.status === "limit_exceeded"
                  ? "Limit already reached — plan intervention now."
                  : p.status === "no_trend"
                    ? `No significant trend (p = ${p.p_value.toFixed(2)}) — no life projected from noise.`
                    : "Not enough windows yet for a trend."}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
