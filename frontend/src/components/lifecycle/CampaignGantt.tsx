/**
 * Campaign timeline of the median weather run: one bar per activity,
 * coloured by vessel, with the waiting-on-weather share as a hatched tail
 * and the P10–P90 spread of its end date as a whisker. Built from HTML rows
 * so labels keep their size and wrap on a phone.
 */

import type { CampaignResult } from "../../types/lifecycle";
import { addDays, fmtDate, VESSEL_COLOR } from "./shared";

const HATCH = "repeating-linear-gradient(135deg, rgba(0,0,0,0.45) 0 3px, transparent 3px 6px)";

export default function CampaignGantt({ result }: { result: CampaignResult }) {
  const acts = result.activities;
  const maxDay = Math.max(...acts.map((a) => a.end_days.p90), result.total_days.p90, 1);
  const pct = (d: number) => `${Math.min(100, Math.max(0, (100 * d) / maxDay))}%`;

  const ticks: { d: number; label: string }[] = [];
  const start = new Date(`${result.start_date}T00:00:00Z`);
  for (let m = 0; m < 120; m++) {
    const t = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + m, 1));
    const d = (t.getTime() - start.getTime()) / 864e5;
    if (d < 0) continue;
    if (d > maxDay) break;
    ticks.push({ d, label: t.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }) + (t.getUTCMonth() === 0 ? ` ${t.getUTCFullYear()}` : "") });
  }
  const step = Math.ceil(ticks.length / 8);
  const grid = ticks.map((t) => (
    <span key={t.d} className="absolute inset-y-0 w-px bg-border-primary" style={{ left: pct(t.d) }} aria-hidden />
  ));

  return (
    <figure className="space-y-1" data-tour="campaign-gantt">
      <div role="img" aria-label="Campaign timeline, median weather run" className="relative">
        <ol className="space-y-1.5">
          {acts.map((a) => {
            const span = Math.max(0.1, a.end_day - a.start_day);
            const wowShare = Math.min(1, a.wow_days / span);
            return (
              <li
                key={a.id}
                title={
                  `${a.name} (${a.vessel}): day ${a.start_day.toFixed(0)}–${a.end_day.toFixed(0)}, ${a.wow_days.toFixed(0)} days waiting on weather · ` +
                  `end P10–P90 day ${a.end_days.p10.toFixed(0)}–${a.end_days.p90.toFixed(0)}`
                }
              >
                <div className="text-[11px] leading-tight text-text-secondary">
                  <span className="font-semibold text-text-primary">{a.vessel}</span> · {a.name}
                </div>
                <div className="relative h-3">
                  {grid}
                  <span
                    className="absolute top-0.5 h-2 overflow-hidden rounded-[3px]"
                    style={{ left: pct(a.start_day), width: `max(3px, ${pct(span)})`, background: VESSEL_COLOR[a.vessel] }}
                  >
                    {wowShare > 0 && <span className="absolute inset-y-0 right-0" style={{ width: `${100 * wowShare}%`, background: HATCH }} />}
                  </span>
                  <span
                    className="absolute top-[5px] h-[1.5px] bg-text-primary"
                    style={{ left: pct(a.end_days.p10), width: pct(a.end_days.p90 - a.end_days.p10) }}
                    aria-hidden
                  />
                  <span className="absolute top-0.5 h-2 w-[1.5px] bg-text-primary" style={{ left: pct(a.end_days.p90) }} aria-hidden />
                </div>
              </li>
            );
          })}
        </ol>
        <div className="relative mt-1 h-4 text-[11px] text-text-muted">
          {ticks.map((t, i) =>
            i % step === 0 ? (
              <span key={t.d} className="absolute whitespace-nowrap" style={{ left: pct(t.d) }}>
                {t.label}
              </span>
            ) : null,
          )}
        </div>
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-secondary">
        <span>
          Median run from {fmtDate(result.start_date)} to {fmtDate(addDays(result.start_date, result.total_days.p50))}.
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-5 rounded-[3px] bg-text-muted" style={{ backgroundImage: HATCH }} aria-hidden /> hatched: waiting on
          weather
        </span>
        <span className="flex items-center gap-1">
          <span className="relative inline-block h-2 w-5" aria-hidden>
            <span className="absolute left-0 right-0 top-[3px] h-[1.5px] bg-text-primary" />
            <span className="absolute right-0 top-0 h-2 w-[1.5px] bg-text-primary" />
          </span>
          end date P10–P90
        </span>
      </figcaption>
    </figure>
  );
}
