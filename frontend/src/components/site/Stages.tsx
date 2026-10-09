/**
 * Journey stages after screening: site investigation, environmental
 * studies and the permit procedure. Work runs in compressed time (a few
 * seconds per year) with a fast-forward; each task names who does it and
 * what to watch out for.
 */

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FastForward,
  Gavel,
  Hourglass,
  Play,
  RotateCcw,
} from "lucide-react";

import { cn } from "../../lib/utils";
import { useSiteStore } from "../../store/siteStore";
import { Actor, SpeechBubble } from "./Actors";
import {
  ACTORS,
  ENVIRONMENT,
  INVESTIGATION,
  OUTCOME_LABEL,
  SEASONS,
  decide,
  permitSteps,
  type Task,
} from "./journey";

/** Simulated months per real second between milestones. */
const MONTHS_PER_SECOND = 2;
/** Real time the clock holds at each milestone so its step can be read. */
const PERMIT_DWELL_MS = 3500;
const TASK_DWELL_MS = 1500;

/**
 * Simulation clock in months; runs while `running`, holds `dwellMs` at every
 * milestone month in `marks` (a procedure step starting, a task finishing),
 * fast-forward jumps to `end`.
 */
function useSimClock(end: number, marks: number[] = [], dwellMs = 0) {
  const [month, setMonth] = useState(0);
  const [running, setRunning] = useState(false);
  const last = useRef<number | null>(null);
  const holdUntil = useRef(0);
  const markKey = marks.join(",");
  useEffect(() => {
    if (!running) return;
    const stops = markKey ? markKey.split(",").map(Number) : [];
    let raf = 0;
    const tick = (t: number) => {
      if (last.current != null && t >= holdUntil.current) {
        const dt = ((t - last.current) / 1000) * MONTHS_PER_SECOND;
        setMonth((m) => {
          const next = Math.min(end, m + dt);
          const crossed = stops.find((k) => k > m && k <= next && k < end);
          if (crossed === undefined) return next;
          holdUntil.current = t + dwellMs;
          return crossed;
        });
      }
      last.current = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      last.current = null;
    };
  }, [running, end, markKey, dwellMs]);
  useEffect(() => {
    if (month >= end) setRunning(false);
  }, [month, end]);
  return {
    month,
    running,
    done: month >= end,
    play: () => {
      if (month === 0) holdUntil.current = performance.now() + dwellMs; // read the first step too
      setRunning(true);
    },
    pause: () => setRunning(false),
    finish: () => {
      setRunning(false);
      setMonth(end);
    },
    restart: () => {
      holdUntil.current = performance.now() + dwellMs;
      setMonth(0);
      setRunning(true);
    },
  };
}

function ClockBar({
  clock,
  end,
  label,
}: {
  clock: ReturnType<typeof useSimClock>;
  end: number;
  label: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-primary bg-bg-secondary px-3 py-2">
      <Clock size={14} className="text-text-muted" aria-hidden />
      <span className="font-mono text-sm tabular-nums text-text-primary">
        Month {clock.month.toFixed(clock.month < 10 ? 1 : 0)}
      </span>
      <span className="text-[11px] text-text-muted">of {end} · {label}</span>
      <div className="ml-auto flex gap-1.5">
        {!clock.done && (
          <button
            type="button"
            onClick={clock.running ? clock.pause : clock.play}
            className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:bg-accent-hover"
          >
            <Play size={12} /> {clock.running ? "Pause" : clock.month > 0 ? "Resume" : "Start"}
          </button>
        )}
        {!clock.done && (
          <button
            type="button"
            onClick={clock.finish}
            className="flex items-center gap-1 rounded-md border border-border-primary px-2.5 py-1 text-xs text-text-secondary hover:bg-bg-hover"
          >
            <FastForward size={12} /> Fast-forward
          </button>
        )}
        {clock.done && (
          <button
            type="button"
            onClick={clock.restart}
            className="flex items-center gap-1 rounded-md border border-border-primary px-2.5 py-1 text-xs text-text-secondary hover:bg-bg-hover"
          >
            <RotateCcw size={12} /> Replay
          </button>
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, month }: { task: Task; month: number }) {
  const progress = Math.min(1, month / task.months);
  const done = progress >= 1;
  const reduced = useReducedMotion() ?? false;
  return (
    <div className="flex gap-3 rounded-lg border border-border-primary bg-bg-secondary p-3">
      <Actor id={task.actor} speaking={!done && month > 0} size={48} showLabel={false} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-text-primary">{task.title}</h4>
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[11px] font-medium",
              done ? "text-status-normal" : "text-text-muted",
            )}
          >
            {done ? <CheckCircle2 size={12} aria-hidden /> : <Hourglass size={12} aria-hidden />}
            {done ? "Done" : `${task.months} months typical`}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-bg-tertiary" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={task.title}>
          <motion.div
            className="h-full rounded-full bg-accent"
            animate={{ width: `${progress * 100}%` }}
            transition={reduced ? { duration: 0 } : { duration: 0.2 }}
          />
        </div>
        <p className="text-[12px] text-text-secondary">
          <span className="font-medium text-text-primary">What: </span>
          {task.what}
        </p>
        <p className="text-[12px] text-text-secondary">
          <span className="font-medium text-text-primary">Why: </span>
          {task.why}
        </p>
        {task.watchOut && <WatchOut text={task.watchOut} />}
        {task.reference && <p className="text-[10px] text-text-muted">{task.reference}</p>}
        <p className="text-[10px] text-text-muted">
          {ACTORS[task.actor].name} · {ACTORS[task.actor].role}
        </p>
      </div>
    </div>
  );
}

export function WatchOut({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-status-warning/40 bg-status-warning/10 px-2.5 py-1.5 text-[12px]">
      <AlertTriangle size={13} className="mt-px shrink-0 text-status-warning" aria-hidden />
      <span className="text-text-secondary">
        <span className="font-semibold text-text-primary">Watch out: </span>
        {text}
      </span>
    </div>
  );
}

function TasksStage({
  tasks,
  label,
  intro,
  onDone,
  children,
}: {
  tasks: Task[];
  label: string;
  intro: string;
  onDone: () => void;
  children?: React.ReactNode;
}) {
  const end = Math.max(...tasks.map((t) => t.months));
  const clock = useSimClock(end, tasks.map((t) => t.months), TASK_DWELL_MS);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    if (clock.done) onDoneRef.current();
  }, [clock.done]);
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">{intro}</p>
      <ClockBar clock={clock} end={end} label={label} />
      {children}
      <div className="grid gap-3 lg:grid-cols-2">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} month={clock.month} />
        ))}
      </div>
    </div>
  );
}

export function InvestigationStage() {
  const complete = useSiteStore((s) => s.completeStage);
  const report = useSiteStore((s) => s.report);
  const restricted = report?.checks.find((c) => c.id === "restricted");
  return (
    <TasksStage
      tasks={INVESTIGATION}
      label="surveys run in parallel"
      intro="Before a design or a permit application, the site has to be measured: wind, seabed, soil and sea state. Surveys run in parallel; the longest is the wind campaign."
      onDone={() => complete("investigation")}
    >
      {restricted && restricted.status !== "pass" ? <WatchOut text={restricted.detail} /> : null}
    </TasksStage>
  );
}

export function EnvironmentStage() {
  const complete = useSiteStore((s) => s.completeStage);
  const report = useSiteStore((s) => s.report);
  const natura = report?.checks.find((c) => c.id === "natura2000");
  // The learner picks the season; no automatic cycling.
  const [season, setSeason] = useState(0);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Survey seasons">
        {SEASONS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSeason(i)}
            className={cn(
              "rounded-lg border p-2.5 text-left transition-colors",
              i === season ? "border-accent bg-accent/10" : "border-border-primary bg-bg-secondary hover:bg-bg-hover",
            )}
            aria-pressed={i === season}
          >
            <div className="text-xs font-semibold text-text-primary">{s.title}</div>
            <div className="mt-0.5 text-[11px] text-text-secondary">{s.focus}</div>
          </button>
        ))}
      </div>
      {natura && natura.status !== "pass" && (
        <WatchOut
          text={`${natura.detail} Under Article 6(3) of the Habitats Directive the authority may consent only once it is certain the site's integrity is not adversely affected.`}
        />
      )}
      <TasksStage
        tasks={ENVIRONMENT}
        label="baseline surveys, all seasons"
        intro="The environmental impact assessment (EIA) needs baseline data from every season. Marine life is checked here: birds, porpoises and seals, fish and the seabed."
        onDone={() => complete("environment")}
      />
    </div>
  );
}

export function PermitStage() {
  const report = useSiteStore((s) => s.report);
  const complete = useSiteStore((s) => s.completeStage);
  const decision = decide(report);
  const steps = permitSteps(decision);
  const end = steps[steps.length - 1].month;
  const clock = useSimClock(end, steps.map((s) => s.month), PERMIT_DWELL_MS);
  const reduced = useReducedMotion() ?? false;
  const current = [...steps].reverse().find((s) => clock.month >= s.month) ?? steps[0];
  const idx = steps.indexOf(current);
  const decided = clock.done;
  useEffect(() => {
    if (decided) complete("permit");
  }, [decided, complete]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">
        A generic EU procedure: one application, one combined environmental assessment, public consultation, then a
        decision within the legal time limit. National procedures differ in detail.
      </p>
      <ClockBar clock={clock} end={end} label="months after the application" />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* The scene: who is talking now */}
        <div className="flex min-h-[220px] items-end gap-3 rounded-lg border border-border-primary bg-gradient-to-b from-bg-tertiary to-bg-secondary p-4">
          <Actor id={current.actor} speaking={clock.running} size={84} />
          <div className="mb-10 flex-1">
            <SpeechBubble text={current.say} />
          </div>
        </div>

        {/* The procedure timeline */}
        <ol className="space-y-1.5" aria-label="Permit procedure">
          {steps.map((s, i) => {
            const state = i < idx || decided ? "done" : i === idx && (clock.month > 0 || clock.running) ? "now" : "next";
            return (
              <motion.li
                key={s.id}
                layout={!reduced}
                className={cn(
                  "rounded-lg border px-3 py-2",
                  state === "now" ? "border-accent bg-accent/10" : "border-border-primary bg-bg-secondary",
                  state === "next" && "opacity-60",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-text-primary">
                    {state === "done" ? (
                      <CheckCircle2 size={13} className="text-status-normal" aria-hidden />
                    ) : (
                      <Hourglass size={13} className="text-text-muted" aria-hidden />
                    )}
                    {s.title}
                  </span>
                  <span className="font-mono text-[11px] text-text-muted">month {s.month}</span>
                </div>
                {state !== "next" && (
                  <>
                    <p className="mt-0.5 text-[12px] text-text-secondary">{s.note}</p>
                    <p className="text-[10px] text-text-muted">{s.reference}</p>
                  </>
                )}
                <span className="sr-only">{state === "done" ? "done" : state === "now" ? "in progress" : "waiting"}</span>
              </motion.li>
            );
          })}
        </ol>
      </div>

      {decided && (
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "rounded-lg border p-4",
            decision.outcome === "refused"
              ? "border-status-alarm/50 bg-status-alarm/10"
              : decision.outcome === "more_information"
                ? "border-status-warning/50 bg-status-warning/10"
                : "border-status-normal/50 bg-status-normal/10",
          )}
          role="status"
        >
          <h4 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Gavel size={15} aria-hidden /> {OUTCOME_LABEL[decision.outcome]}
          </h4>
          {decision.reasons.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] text-text-secondary">
              {decision.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          {decision.outcome === "refused" && (
            <p className="mt-2 text-[12px] text-text-secondary">
              Go back to screening and choose a site clear of the blocking constraints; the journey starts again from
              there.
            </p>
          )}
          {decision.conditions.length > 0 && (
            <>
              <p className="mt-2 text-[12px] font-medium text-text-primary">Conditions</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-[12px] text-text-secondary">
                {decision.conditions.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}
