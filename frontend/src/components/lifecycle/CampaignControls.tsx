/** Inputs of a campaign: start date, α factor, number of weather runs, vessel limits. */

import { useState } from "react";

import type { CampaignSettings } from "../../store/lifecycleStore";
import type { VesselId } from "../../types/lifecycle";
import { VESSEL_COLOR, VESSEL_DEFAULTS } from "./shared";

const input = "rounded border border-border-primary bg-bg-tertiary px-1.5 py-0.5 text-[12px] text-text-primary";

export default function CampaignControls({
  value,
  vessels,
  onChange,
  onLimit,
}: {
  value: CampaignSettings;
  vessels: VesselId[];
  onChange: (p: Partial<CampaignSettings>) => void;
  onLimit: (v: VesselId, l: { hs_m: number; wind_ms: number } | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2 rounded-lg border border-border-primary bg-bg-secondary p-3" data-tour="campaign-inputs">
      <div className="grid gap-2 text-[12px] text-text-primary sm:grid-cols-3">
        <label className="flex items-center justify-between gap-2">
          First offshore work
          <input type="date" value={value.start} onChange={(e) => e.target.value && onChange({ start: e.target.value })} className={input} />
        </label>
        <label className="flex items-center justify-between gap-2">
          <span title="DNV-ST-N001: the forecast must stay below α × the operational limit">α factor</span>
          <span className="flex items-center gap-1.5">
            <input
              type="range"
              min={0.5}
              max={1}
              step={0.05}
              value={value.alpha}
              onChange={(e) => onChange({ alpha: Number(e.target.value) })}
              className="w-24 accent-accent"
              aria-label="Alpha factor"
            />
            <span className="w-8 tabular-nums">{value.alpha.toFixed(2)}</span>
          </span>
        </label>
        <label className="flex items-center justify-between gap-2">
          Weather runs
          <select value={value.runs} onChange={(e) => onChange({ runs: Number(e.target.value) })} className={input}>
            {[50, 100, 200, 400].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="text-[12px] text-accent underline">
        {open ? "Hide" : "Edit"} vessel operational limits (illustrative)
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-[12px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-text-muted">
                <th className="py-1">Vessel</th>
                <th className="py-1 text-right">Hs limit [m]</th>
                <th className="py-1 text-right">Wind limit [m/s]</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {vessels.map((v) => {
                const d = VESSEL_DEFAULTS[v];
                const cur = value.limits[v] ?? { hs_m: d.hs_m, wind_ms: d.wind_ms };
                const changed = value.limits[v] != null;
                const set = (p: Partial<typeof cur>) => {
                  const next = { ...cur, ...p };
                  if (Number.isFinite(next.hs_m) && Number.isFinite(next.wind_ms) && next.hs_m > 0.2 && next.wind_ms > 2) onLimit(v, next);
                };
                return (
                  <tr key={v} className="border-t border-border-primary/60">
                    <td className="py-1 text-text-primary">
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: VESSEL_COLOR[v] }} aria-hidden />
                      {d.name}
                    </td>
                    <td className="py-1 text-right">
                      <input
                        type="number"
                        min={0.3}
                        max={6}
                        step={0.1}
                        value={cur.hs_m}
                        onChange={(e) => set({ hs_m: Number(e.target.value) })}
                        className={`${input} w-16 text-right`}
                        aria-label={`${d.name} Hs limit`}
                      />
                    </td>
                    <td className="py-1 text-right">
                      <input
                        type="number"
                        min={3}
                        max={30}
                        step={0.5}
                        value={cur.wind_ms}
                        onChange={(e) => set({ wind_ms: Number(e.target.value) })}
                        className={`${input} w-16 text-right`}
                        aria-label={`${d.name} wind limit`}
                      />{" "}
                      <span className="text-xs text-text-muted">@{d.windRef}</span>
                    </td>
                    <td className="py-1 pl-2 text-right">
                      {changed && (
                        <button type="button" className="text-xs text-text-muted underline" onClick={() => onLimit(v, null)}>
                          reset
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
