/**
 * First energisation: pick the next safe step from the remaining cards.
 * Scored like the control-room drills (store/trainingStore scoreOf).
 */

import { useMemo, useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";

import { newSeed, rng, shuffle } from "../../academy/random";
import { ENERGISATION, SEQUENCE_PAR_S } from "../../academy/sequence";
import { cn } from "../../lib/utils";
import { useAcademyStore } from "../../store/academyStore";
import { scoreOf } from "../../store/trainingStore";
import { Button } from "../ui/Button";
import { WatchOut } from "../site/Stages";
import { ScoreCard } from "./MissionFrame";

export default function SequenceMission() {
  const [seed, setSeed] = useState(newSeed);
  const cards = useMemo(() => shuffle(rng(seed), ENERGISATION), [seed]);
  const [done, setDone] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [why, setWhy] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [result, setResult] = useState<{ score: number; timeS: number } | null>(null);
  const record = useAcademyStore((s) => s.record);

  const pick = (id: string) => {
    if (result) return;
    const next = ENERGISATION[done.length];
    if (id !== next.id) {
      setMistakes((m) => m + 1);
      setWhy(ENERGISATION.find((s) => s.id === id)!.needs);
      return;
    }
    setWhy(null);
    const now = [...done, id];
    setDone(now);
    if (now.length === ENERGISATION.length) {
      const timeS = (Date.now() - startedAt) / 1000;
      const score = scoreOf(mistakes, timeS, SEQUENCE_PAR_S);
      setResult({ score, timeS });
      record({ mission: "energisation-sequence", score, detail: `${mistakes} wrong step(s) in ${Math.round(timeS)} s`, seed });
    }
  };

  const restart = () => {
    setSeed(newSeed());
    setDone([]);
    setMistakes(0);
    setWhy(null);
    setResult(null);
    setStartedAt(Date.now());
  };

  const remaining = cards.filter((c) => !done.includes(c.id));

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-text-secondary">
        The export cable, offshore substation and array strings are built, tested and earthed. Energise them for the first time: pick
        the next step each time.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Programme so far</h4>
          {done.length === 0 ? (
            <p className="text-[12px] text-text-muted">No step yet.</p>
          ) : (
            <ol className="space-y-1">
              {done.map((id, i) => {
                const s = ENERGISATION.find((x) => x.id === id)!;
                return (
                  <li key={id} className="flex items-start gap-2 text-[12px] text-text-primary">
                    <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-status-normal" aria-hidden />
                    <span>
                      {i + 1}. {s.title} <span className="text-text-muted">({s.steps})</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        <div>
          <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            {remaining.length ? `Next step? (${mistakes} mistake${mistakes === 1 ? "" : "s"})` : "Done"}
          </h4>
          <div className="space-y-1.5">
            {remaining.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pick(c.id)}
                className={cn(
                  "block w-full rounded-md border border-border-primary bg-bg-secondary px-2.5 py-1.5 text-left text-[12px] text-text-primary",
                  "hover:border-accent hover:bg-bg-hover",
                )}
              >
                {c.title}
              </button>
            ))}
          </div>
          {why && (
            <p role="alert" className="mt-2 rounded-md border border-status-alarm/40 bg-status-alarm/10 px-2.5 py-1.5 text-[12px] text-text-primary">
              Not yet. {why}
            </p>
          )}
        </div>
      </div>
      {result && (
        <ScoreCard
          result={{
            score: result.score,
            lines: [
              { label: "Wrong steps", points: -15 * mistakes, max: 0, note: `${mistakes} × −15` },
              {
                label: "Time over par",
                points: -Math.round(Math.max(0, (result.timeS - SEQUENCE_PAR_S) / 10)),
                max: 0,
                note: `${Math.round(result.timeS)} s (par ${SEQUENCE_PAR_S} s)`,
              },
            ],
          }}
        />
      )}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={restart}>
          <RotateCcw size={13} /> {result ? "Try again" : "Restart"}
        </Button>
      </div>
      <WatchOut text="Every switching step on a real HV system follows the approved programme, under the person in charge, with LOTO and hold points. A wrong order can close a breaker onto earth or energise a busbar someone is working on." />
    </div>
  );
}
