/**
 * "Suggest moves": the screening engine (lib/layout/suggest.ts) ranks small
 * moves of the most waked turbines by LCOE; PyWake then checks the top five
 * on the backend and is the arbiter: confirmed moves (PyWake gain > 0) are
 * listed first, the others are marked. Single moves are worth tenths of a
 * percent, below the screening model's own accuracy, so on a tuned layout
 * PyWake often confirms none. Suggestions belong to one layout and are
 * dropped when it changes (applying one changes it).
 */

import { useEffect, useState } from "react";
import { Lightbulb, MoveRight } from "lucide-react";

import { layoutSuggestInfo } from "../../constants/panelInfo";
import { compass } from "../../lib/layout/evaluate";
import type { MoveSuggestion } from "../../lib/layout/suggest";
import type { WakeMoveResult } from "../../services/windResourceApi";
import { Button } from "../ui/Button";
import { InfoButton } from "../ui/InfoButton";

const signed = (v: number, digits: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}`;

/** Display order: screening rank until PyWake answers, then confirmed moves first by PyWake gain. */
const order = (n: number, checked: WakeMoveResult[] | null) =>
  Array.from({ length: n }, (_, k) => k).sort((a, b) =>
    checked ? Number(checked[b].delta_gwh > 0) - Number(checked[a].delta_gwh > 0) || checked[b].delta_gwh - checked[a].delta_gwh : 0,
  );

export default function MoveSuggestions({
  sig,
  disabled,
  suggest,
  validate,
  apply,
}: {
  /** Layout signature: suggestions are reset when it changes. */
  sig: string;
  disabled: boolean;
  suggest: () => MoveSuggestion[];
  validate: (moves: MoveSuggestion[]) => Promise<WakeMoveResult[]>;
  apply: (m: MoveSuggestion) => void;
}) {
  const [list, setList] = useState<MoveSuggestion[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<WakeMoveResult[] | null>(null);
  const [checkError, setCheckError] = useState(false);

  useEffect(() => {
    setList(null);
    setChecked(null);
    setCheckError(false);
  }, [sig]);

  const run = () => {
    setBusy(true);
    setChecked(null);
    setCheckError(false);
    // Let the button show "Searching…" before the ~0.5 s search blocks the thread.
    setTimeout(() => {
      const found = suggest();
      setList(found);
      setBusy(false);
      if (found.length)
        validate(found)
          .then(setChecked)
          .catch(() => setCheckError(true));
    }, 30);
  };

  return (
    <div className="space-y-2 rounded-lg border border-border-primary bg-bg-secondary p-3" data-tour="layout-suggest">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-secondary">
          <Lightbulb size={13} aria-hidden /> Move suggestions
        </h3>
        <span className="flex items-center gap-1">
          <InfoButton info={layoutSuggestInfo} />
          <Button size="sm" variant="secondary" onClick={run} disabled={disabled || busy}>
            {busy ? "Searching…" : list ? "Search again" : "Suggest moves"}
          </Button>
        </span>
      </div>
      {list == null ? (
        <p className="text-[11px] text-text-muted">
          Tries moving the ten most waked turbines by ½, 1 and 2 D in eight directions, keeps the moves that stay allowed and lower the
          LCOE, and checks the best five with PyWake.
        </p>
      ) : list.length === 0 ? (
        <p className="text-[12px] text-text-secondary">No single move of ≤ 2 D lowers the LCOE: this layout is locally tuned.</p>
      ) : (
        <ul className="space-y-1.5 text-[12px]">
          {checked && !checked.some((c) => c.delta_gwh > 0) && (
            <li className="rounded-md border border-status-warning/40 bg-status-warning/10 p-2 text-text-secondary">
              PyWake confirms none of these moves. Their screening gains (≤ {Math.max(...list.map((m) => m.deltaPct)).toFixed(2)} %) are
              below the fast model&apos;s accuracy, which does not model the extra mixing deep in the array: the layout is close to a local
              optimum for single moves. Try a different grid instead.
            </li>
          )}
          {order(list.length, checked).map((k) => {
            const m = list[k];
            const pw = checked?.[k];
            return (
              <li key={`${m.id}-${m.bearingDeg}-${m.distM}`} className="flex items-start gap-2 rounded-md border border-border-primary/60 p-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-text-primary">
                    Move <b>{m.id}</b> ~{Math.round(m.distM / 10) * 10} m towards {m.bearingDeg}° ({compass(m.bearingDeg)})
                    <MoveRight size={12} className="mx-1 inline" aria-hidden />
                    AEP {signed(m.deltaPct, 2)} %
                  </span>
                  <span className="block text-[11px] text-text-muted">
                    {signed(m.deltaGWh, 1)} GWh/yr · cables {signed(m.deltaCableKm, 2)} km · LCOE {signed(m.deltaLcoe, 2)} €/MWh ·{" "}
                    {pw ? (
                      <span className={pw.delta_gwh > 0 ? "text-status-normal" : "text-status-warning"}>
                        PyWake {signed(pw.delta_percent, 2)} % · {pw.delta_gwh > 0 ? "confirmed" : "not confirmed"}
                      </span>
                    ) : checkError ? (
                      "PyWake check unavailable"
                    ) : (
                      "PyWake checking…"
                    )}
                  </span>
                </span>
                <Button size="sm" variant="ghost" onClick={() => apply(m)}>
                  Apply
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
