/** Result panels shared by the construction and decommissioning pages. */

import { Fragment } from "react";

import type { CampaignResult } from "../../types/lifecycle";
import { InfoTile } from "../ui/InfoTile";
import CampaignGantt from "./CampaignGantt";
import { fmtDate, meur, VESSEL_COLOR } from "./shared";

export function CampaignKpis({ result, finalId, finalLabel }: { result: CampaignResult; finalId: string; finalLabel: string }) {
  const end = result.milestones.find((m) => m.id === finalId) ?? result.milestones[result.milestones.length - 1];
  const wow = result.vessels.reduce((s, v) => s + v.wow_days.p50, 0);
  const charter = result.vessels.reduce((s, v) => s + v.charter_days.p50, 0);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-tour="campaign-kpis">
      <InfoTile label={`${finalLabel} (P50)`} value={fmtDate(end.date_p50)} subtitle={`day ${end.days.p50.toFixed(0)}`} size="sm" />
      <InfoTile
        label={`${finalLabel} (P90)`}
        value={fmtDate(end.date_p90)}
        subtitle={`${(end.days.p90 - end.days.p50).toFixed(0)} days later than P50`}
        priority={end.days.p90 - end.days.p50 > 60 ? "warning" : "normal"}
        size="sm"
      />
      <InfoTile
        label="Vessel cost"
        value={meur(result.cost_meur.p50)}
        subtitle={`P90 ${meur(result.cost_meur.p90)}`}
        size="sm"
      />
      <InfoTile
        label="Waiting on weather"
        value={charter > 0 ? ((100 * wow) / charter).toFixed(0) : "—"}
        unit="%"
        subtitle={`of ${charter.toFixed(0)} vessel days (P50)`}
        size="sm"
      />
    </div>
  );
}

export function MilestoneTable({ result }: { result: CampaignResult }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-[12px]">
        <thead>
          <tr className="border-b border-border-primary text-left text-xs uppercase tracking-wider text-text-muted">
            <th className="py-1 pr-2">Milestone</th>
            <th className="py-1 pr-2 text-right">P10 [day]</th>
            <th className="py-1 pr-2 text-right">P50 [day]</th>
            <th className="py-1 pr-2 text-right">P90 [day]</th>
            <th className="py-1 text-right">P50 / P90 date</th>
          </tr>
        </thead>
        <tbody>
          {result.milestones.map((m) => (
            <tr key={m.id} className="border-b border-border-primary/60">
              <td className="py-1 pr-2 text-text-primary">{m.label}</td>
              <td className="py-1 pr-2 text-right tabular-nums text-text-secondary">{m.days.p10.toFixed(0)}</td>
              <td className="py-1 pr-2 text-right tabular-nums font-semibold text-text-primary">{m.days.p50.toFixed(0)}</td>
              <td className="py-1 pr-2 text-right tabular-nums text-text-secondary">{m.days.p90.toFixed(0)}</td>
              <td className="py-1 text-right tabular-nums text-text-secondary">
                {fmtDate(m.date_p50)} / {fmtDate(m.date_p90)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Months × vessels: chance that a window long enough for one operation starts (number in every cell). */
export function WindowHeatmap({ result }: { result: CampaignResult }) {
  return (
    <div className="overflow-x-auto" data-tour="campaign-windows">
      <table className="w-full min-w-[560px] border-separate border-spacing-[2px] text-xs">
        <thead>
          <tr className="text-text-muted">
            <th className="pr-2 text-left font-normal">Vessel · operation window</th>
            {result.months.map((m) => (
              <th key={m} className="w-[6.5%] text-center font-normal">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.vessels.map((v) => (
            <Fragment key={v.id}>
              <tr>
                <th scope="row" className="pr-2 text-left font-normal text-text-secondary">
                  <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: VESSEL_COLOR[v.id] }} aria-hidden />
                  {v.id} · {v.window_hours} h
                </th>
                {v.window_pct_by_month.map((p, i) => (
                  <td
                    key={i}
                    title={
                      p == null
                        ? "outside the simulated period"
                        : `${v.name}, ${result.months[i]}: ${p} % chance that a ${v.window_hours} h window starts at a given time; ` +
                          `${v.workable_pct_by_month[i]} % of the time is workable`
                    }
                    className="rounded-sm text-center tabular-nums"
                    style={{
                      // one hue, light → dark with the probability (sequential)
                      background: p == null ? "transparent" : `color-mix(in srgb, var(--color-accent) ${Math.round(8 + 0.8 * p)}%, transparent)`,
                      color: p != null && p > 55 ? "#fff" : "var(--color-text-primary)",
                    }}
                  >
                    {p == null ? "—" : p.toFixed(0)}
                  </td>
                ))}
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-xs text-text-muted">
        % of the time a weather window long enough for one operation (Hs and wind below α × limit for the whole duration) opens. Hover a
        cell for the workable share of single 6-hour steps — always higher.
      </p>
    </div>
  );
}

export function VesselTable({ result }: { result: CampaignResult }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-[12px]">
        <thead>
          <tr className="border-b border-border-primary text-left text-xs uppercase tracking-wider text-text-muted">
            <th className="py-1 pr-2">Vessel</th>
            <th className="py-1 pr-2 text-right">Limit Hs / wind</th>
            <th className="py-1 pr-2 text-right">Day rate</th>
            <th className="py-1 pr-2 text-right">Charter [d] P50</th>
            <th className="py-1 pr-2 text-right">WoW [d] P50</th>
            <th className="py-1 text-right">Cost P50 / P90</th>
          </tr>
        </thead>
        <tbody>
          {result.vessels.map((v) => (
            <tr key={v.id} className="border-b border-border-primary/60">
              <td className="py-1 pr-2 text-text-primary">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: VESSEL_COLOR[v.id] }} aria-hidden />
                {v.name} <span className="text-text-muted">({v.id})</span>
                <div className="text-xs text-text-muted">{v.role}</div>
              </td>
              <td className="py-1 pr-2 text-right tabular-nums text-text-secondary">
                {v.hs_limit_m} m / {v.wind_limit_ms} m/s <span className="text-text-muted">@{v.wind_reference.replace("hub height", "hub")}</span>
              </td>
              <td className="py-1 pr-2 text-right tabular-nums text-text-secondary">{v.day_rate_keur} k€</td>
              <td className="py-1 pr-2 text-right tabular-nums text-text-primary">{v.charter_days.p50.toFixed(0)}</td>
              <td className="py-1 pr-2 text-right tabular-nums text-text-primary">{v.wow_days.p50.toFixed(0)}</td>
              <td className="py-1 text-right tabular-nums text-text-primary">
                {meur(v.cost_meur.p50)} / {meur(v.cost_meur.p90)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CampaignResultPanels({ result, finalId, finalLabel }: { result: CampaignResult; finalId: string; finalLabel: string }) {
  return (
    <div className="space-y-4">
      <CampaignKpis result={result} finalId={finalId} finalLabel={finalLabel} />
      {result.unfinished_runs > 0 && (
        <p className="text-[12px] text-status-alarm">
          {result.unfinished_runs} of {result.runs} weather runs did not finish within the simulated six years: relax the limits or the α
          factor.
        </p>
      )}
      <section className="rounded-lg border border-border-primary bg-bg-secondary p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">Timeline (median weather run)</h3>
        <CampaignGantt result={result} />
      </section>
      <section className="rounded-lg border border-border-primary bg-bg-secondary p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">Milestones over {result.runs} weather runs</h3>
        <MilestoneTable result={result} />
      </section>
      <section className="rounded-lg border border-border-primary bg-bg-secondary p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">Weather windows by month</h3>
        <WindowHeatmap result={result} />
      </section>
      <section className="rounded-lg border border-border-primary bg-bg-secondary p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">Vessels</h3>
        <VesselTable result={result} />
      </section>
      <details className="rounded-lg border border-border-primary bg-bg-secondary p-3 text-[12px] text-text-secondary">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-text-secondary">Model and assumptions</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {result.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
          <li>
            Activities: {result.activities.map((a) => `${a.name} — ${a.units} × ${a.op_hours} h${a.trip_every ? `, ${a.trip_every} per port trip (${a.trip_hours.toFixed(0)} h loading and sailing)` : ""}`).join("; ")}.
          </li>
        </ul>
      </details>
    </div>
  );
}
