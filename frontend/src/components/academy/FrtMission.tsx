/**
 * FRT compliance challenge: five generated voltage dips, each judged against
 * the PSE profile (academy/frt.ts). Answers are revealed after submitting.
 */

import { useMemo, useState } from "react";
import { RotateCcw, Send } from "lucide-react";

import {
  frtQuestions,
  FRT_POINTS,
  K_FACTOR,
  PROFILE_END_S,
  PSE_FRT_PROFILE,
  scoreFrt,
  voltageAt,
  type FrtAnswer,
  type FrtCase,
} from "../../academy/frt";
import { newSeed } from "../../academy/random";
import { cn } from "../../lib/utils";
import { useAcademyStore } from "../../store/academyStore";
import { Button } from "../ui/Button";
import { WatchOut } from "../site/Stages";
import { ScoreCard } from "./MissionFrame";

const T0 = -0.2;
const W = 320;
const H = 130;
const PAD = { l: 26, r: 6, t: 6, b: 18 };
const x = (t: number) => PAD.l + ((t - T0) / (PROFILE_END_S - T0)) * (W - PAD.l - PAD.r);
const y = (u: number) => PAD.t + (1 - u / 1.1) * (H - PAD.t - PAD.b);

/** Connection-point voltage against the PSE profile (inline SVG, theme colours). */
export function VoltageChart({ c, label }: { c: FrtCase; label: string }) {
  const pts: string[] = [];
  for (let t = T0; t <= PROFILE_END_S + 1e-9; t += 0.01) pts.push(`${x(t).toFixed(1)},${y(voltageAt(c, t)).toFixed(1)}`);
  const profile = [...PSE_FRT_PROFILE, [PROFILE_END_S, PSE_FRT_PROFILE[PSE_FRT_PROFILE.length - 1][1]]]
    .map(([t, u]) => `${x(t).toFixed(1)},${y(u).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      {[0, 0.5, 1].map((u) => (
        <g key={u}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(u)} y2={y(u)} stroke="var(--color-border-primary)" strokeWidth={0.6} />
          <text x={PAD.l - 3} y={y(u) + 3} textAnchor="end" fontSize={8} fill="var(--color-text-muted)">
            {u}
          </text>
        </g>
      ))}
      {[0, 1, 2, 3].map((t) => (
        <text key={t} x={x(t)} y={H - 5} textAnchor="middle" fontSize={8} fill="var(--color-text-muted)">
          {t} s
        </text>
      ))}
      <polyline points={profile} fill="none" stroke="var(--color-status-alarm)" strokeWidth={1.2} strokeDasharray="4 3" />
      <polyline points={pts.join(" ")} fill="none" stroke="var(--color-accent)" strokeWidth={1.8} />
    </svg>
  );
}

function Choice({ on, children, onClick, tone }: { on: boolean; children: string; onClick: () => void; tone?: "ok" | "bad" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "rounded-md border px-2 py-1 text-[12px] tabular-nums",
        on ? "border-accent bg-accent/15 text-text-primary" : "border-border-primary text-text-secondary hover:bg-bg-hover",
        tone === "ok" && "border-status-normal bg-status-normal/15 text-text-primary",
        tone === "bad" && "border-status-alarm bg-status-alarm/10",
      )}
    >
      {children}
    </button>
  );
}

export default function FrtMission() {
  const [seed, setSeed] = useState(newSeed);
  const questions = useMemo(() => frtQuestions(seed), [seed]);
  const [answers, setAnswers] = useState<FrtAnswer[]>(() => questions.map(() => ({ rideThrough: null, iq: null })));
  const [score, setScore] = useState<number | null>(null);
  const record = useAcademyStore((s) => s.record);

  const set = (i: number, patch: Partial<FrtAnswer>) => setAnswers((a) => a.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const complete = answers.every((a) => a.rideThrough !== null && a.iq !== null);
  const submit = () => {
    const s = scoreFrt(questions, answers);
    setScore(s);
    const right = questions.filter((q, i) => answers[i].rideThrough === q.rideThrough).length;
    record({ mission: "frt-compliance", score: s, detail: `${right} of ${questions.length} verdicts right`, seed });
  };
  const restart = () => {
    const s = newSeed();
    setSeed(s);
    setAnswers(frtQuestions(s).map(() => ({ rideThrough: null, iq: null })));
    setScore(null);
  };
  const shown = score !== null;

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-text-secondary">
        Blue: voltage at the connection point after a grid fault at t = 0 (pre-fault 1 pu). Red dashed: the PSE type-D profile. For each
        dip decide whether the farm must stay connected, and pick the additional reactive current the converters inject during the
        fault (K = {K_FACTOR}, dead band ±0.1 pu, capped at the rated current).
      </p>
      <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {questions.map((q, i) => {
          const a = answers[i];
          return (
            <li key={i} className="space-y-2 rounded-lg border border-border-primary bg-bg-secondary p-2.5">
              <div className="flex items-baseline justify-between text-[12px]">
                <span className="font-semibold text-text-primary">Dip {i + 1}</span>
                <span className="text-text-muted">
                  U<sub>ret</sub> {q.case.uRet.toFixed(2)} pu · {(q.case.faultS * 1000).toFixed(0)} ms
                </span>
              </div>
              <VoltageChart c={q.case} label={`Dip ${i + 1}: ${q.case.uRet} pu for ${q.case.faultS * 1000} ms, recovering to ${q.case.uEnd} pu`} />
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-text-muted">Verdict</span>
                {[true, false].map((v) => (
                  <Choice
                    key={String(v)}
                    on={a.rideThrough === v}
                    onClick={() => !shown && set(i, { rideThrough: v })}
                    tone={shown ? (q.rideThrough === v ? "ok" : a.rideThrough === v ? "bad" : undefined) : undefined}
                  >
                    {v ? "Must ride through" : "May disconnect"}
                  </Choice>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-text-muted">ΔI<sub>q</sub> [pu]</span>
                {q.iqOptions.map((v) => (
                  <Choice
                    key={v}
                    on={a.iq === v}
                    onClick={() => !shown && set(i, { iq: v })}
                    tone={shown ? (q.iq === v ? "ok" : a.iq === v ? "bad" : undefined) : undefined}
                  >
                    {v.toFixed(2)}
                  </Choice>
                ))}
              </div>
              {shown && (
                <p className="text-xs text-text-secondary">
                  {q.rideThrough
                    ? "The voltage never falls below the profile: the farm must stay connected."
                    : "The voltage falls below the profile: the farm may disconnect."}{" "}
                  ΔU = {(1 - q.case.uRet).toFixed(2)} pu →{" "}
                  {q.iq === 0 ? "inside the dead band, no additional current." : q.iq >= 1 ? `K·ΔU ≥ 1, capped at 1 pu.` : `K·ΔU = ${q.iq.toFixed(2)} pu.`}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={restart}>
          <RotateCcw size={13} /> New dips
        </Button>
        <Button size="sm" onClick={submit} disabled={!complete || shown}>
          <Send size={13} /> Submit answers
        </Button>
      </div>
      {score !== null && (
        <ScoreCard
          result={{
            score,
            lines: [
              {
                label: "Verdicts",
                points: FRT_POINTS.verdict * questions.filter((q, i) => answers[i].rideThrough === q.rideThrough).length,
                max: FRT_POINTS.verdict * questions.length,
                note: "must ride through / may disconnect",
              },
              {
                label: "Reactive current set-points",
                points: FRT_POINTS.iq * questions.filter((q, i) => answers[i].iq === q.iq).length,
                max: FRT_POINTS.iq * questions.length,
                note: `ΔIq = K·ΔU, K = ${K_FACTOR}`,
              },
            ],
          }}
        />
      )}
      <WatchOut text="The profile is a floor, not a target: above it the farm must not trip, however deep the dip looks. Below it the plant MAY disconnect — protection settings decide whether it does." />
    </div>
  );
}
