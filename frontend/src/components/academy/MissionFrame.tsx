/**
 * Shared chrome of an Academy mission: title, how it is scored, references,
 * best score so far, and the score card shown after an attempt.
 */

import type { ReactNode } from "react";
import { Award, X } from "lucide-react";

import type { Mission } from "../../academy/courses";
import type { Scored } from "../../academy/scoring";
import { cn } from "../../lib/utils";
import { bestScores, PASS_MARK, passed, useAcademyStore } from "../../store/academyStore";

const KIND_LABEL: Record<Mission["kind"], string> = {
  work: "Graded on your project",
  challenge: "Challenge",
  drill: "Control-room drill",
};

export function ScoreBadge({ score, className }: { score: number | undefined; className?: string }) {
  if (score == null) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-px text-xs font-semibold tabular-nums",
        passed(score) ? "bg-status-normal/15 text-status-normal" : "bg-status-warning/15 text-status-warning",
        className,
      )}
    >
      {passed(score) && <Award size={10} aria-hidden />}
      {score}
    </span>
  );
}

export function ScoreCard({ result, children }: { result: Scored; children?: ReactNode }) {
  const ok = result.score >= PASS_MARK;
  return (
    <div role="status" className="space-y-2 rounded-lg border border-border-primary bg-bg-secondary p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-text-primary">
          Score <span className={cn("text-xl tabular-nums", ok ? "text-status-normal" : "text-status-warning")}>{result.score}</span>
          <span className="text-text-muted"> / 100</span>
        </span>
        <span className={cn("text-xs font-medium", ok ? "text-status-normal" : "text-status-warning")}>
          {ok ? "Passed" : `Pass mark ${PASS_MARK}: try again`}
        </span>
      </div>
      {result.lines.length > 0 && (
        <table className="w-full text-[12px]">
          <tbody>
            {result.lines.map((l) => (
              <tr key={l.label} className="border-t border-border-primary/60 align-top">
                <td className="py-1 pr-2 text-text-primary">
                  {l.label}
                  <span className="block text-xs text-text-muted">{l.note}</span>
                </td>
                <td className={cn("whitespace-nowrap py-1 text-right tabular-nums", l.points < 0 ? "text-status-alarm" : "text-text-secondary")}>
                  {l.points}
                  {l.max > 0 && <span className="text-text-muted"> / {l.max}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {children}
    </div>
  );
}

export default function MissionFrame({ mission, onClose, children }: { mission: Mission; onClose: () => void; children: ReactNode }) {
  const best = useAcademyStore((s) => bestScores(s.attempts)[mission.id]);
  const tries = useAcademyStore((s) => s.attempts.filter((a) => a.mission === mission.id).length);
  return (
    <section
      aria-labelledby="mission-title"
      className="space-y-3 rounded-lg border border-accent/40 bg-bg-primary p-3 sm:p-4"
      data-tour="academy-mission"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            {KIND_LABEL[mission.kind]} · ~{mission.minutes} min
          </p>
          <h3 id="mission-title" className="text-base font-semibold text-text-primary">
            {mission.title}
          </h3>
          <p className="mt-0.5 text-[13px] text-text-secondary">{mission.summary}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary"
          aria-label="Close mission"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
        <span>
          <span className="font-semibold text-text-secondary">Scoring: </span>
          {mission.scoring}
        </span>
        {best != null && (
          <span className="flex items-center gap-1">
            Best <ScoreBadge score={best} /> in {tries} attempt{tries === 1 ? "" : "s"}
          </span>
        )}
      </div>
      {children}
      <p className="border-t border-border-primary pt-2 text-xs text-text-muted">References: <span translate="no">{mission.refs.join(" · ")}</span></p>
    </section>
  );
}
