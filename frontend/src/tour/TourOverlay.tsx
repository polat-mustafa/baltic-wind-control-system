/**
 * Guided-tour overlay: dims the page, cuts a spotlight around the step's
 * target, draws an animated "node arrow" from the target to the step card,
 * and waits for action steps to be done.
 *
 * Rendered in a portal above everything (map panes and panels included).
 * Outside the spotlight clicks are blocked; inside it the page stays
 * interactive, so action steps ("click a turbine") work. Keyboard: → / Enter
 * next, ← back, Esc leave. Honours prefers-reduced-motion.
 */

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Hand, Info, X } from "lucide-react";

import { cn } from "../lib/utils";
import { inflate, nodeArrow, placeCard, SHEET_BREAKPOINT } from "./geometry";
import { nextTour, useTourStore } from "./tourStore";
import { tourById } from "./tours";
import type { Rect, Tour, TourStep } from "./types";

/** How long to look for a step's target before showing the card without it. */
const TARGET_TIMEOUT_MS = 5000;
const POLL_MS = 200;
const SPOTLIGHT_PAD = 6;
const CARD_W = 360;
/** Target-to-card distance when a node arrow is drawn [px]. */
const ARROW_GAP = 64;
/** Pause after an action step is done before moving on. */
const ADVANCE_MS = 1100;
/** Above the landing overlays (3D viewer 1150, expanded 1300), below the tour (10000). */
const RAISED_Z = 1400;

/** First element of the first target id that is laid out and at least partly on screen. */
function findTarget(ids: string[]): HTMLElement | null {
  for (const id of ids) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`)) {
      const r = el.getBoundingClientRect();
      const onScreen = r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
      if (r.width > 0 && r.height > 0 && (onScreen || r.top >= window.innerHeight)) return el;
    }
  }
  return null;
}

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b ||
  (!!a && !!b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5);

/** Track the target's viewport rect; `missing` once it fails to appear in time. */
function useTargetRect(target: string | string[] | undefined) {
  const key = target === undefined ? "" : ([] as string[]).concat(target).join("|");
  const [rect, setRect] = useState<Rect | null>(null);
  const [missing, setMissing] = useState(false);
  const scrolled = useRef(false);

  useEffect(() => {
    if (!key) return;
    const ids = key.split("|");
    const started = Date.now();
    const update = () => {
      const el = findTarget(ids);
      if (!el) {
        setRect((prev) => (prev === null ? prev : null));
        if (Date.now() - started > TARGET_TIMEOUT_MS) setMissing(true);
        return;
      }
      setMissing(false);
      if (!scrolled.current) {
        scrolled.current = true;
        const r = el.getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: "center" });
      }
      const r = el.getBoundingClientRect();
      const next = { x: r.left, y: r.top, w: r.width, h: r.height };
      setRect((prev) => (sameRect(prev, next) ? prev : next));
    };
    update();
    const id = window.setInterval(update, POLL_MS);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [key]);

  return { rect, missing };
}

function useViewport() {
  const [view, setView] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setView({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return view;
}

/**
 * Poll an action step's predicate once its target is on screen. `byUser`
 * is false when the task was already satisfied as the step opened (e.g. a
 * panel left open): then the tour must not race past the step's text.
 */
function useTaskDone(step: TourStep, ready: boolean) {
  const [state, setState] = useState({ done: false, byUser: false });
  useEffect(() => {
    if (!step.task || !ready) return;
    const predicate = step.task.watch();
    let first = true;
    const check = () => {
      let ok = false;
      try {
        ok = predicate();
      } catch {
        // a predicate must never break the tour
      }
      const byUser = !first; // read now: the updater below runs later
      first = false;
      if (ok) setState((s) => (s.done ? s : { done: true, byUser }));
    };
    check();
    const id = window.setInterval(check, 250);
    return () => window.clearInterval(id);
  }, [step, ready]);
  return state;
}

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName));

export default function TourOverlay() {
  const tourId = useTourStore((s) => s.activeTourId);
  const stepIndex = useTourStore((s) => s.stepIndex);
  const tour = tourId ? tourById(tourId) : undefined;
  if (!tour) return null;
  const step = tour.steps[stepIndex];
  // Remount per step: fresh target search, task watch and entry animation.
  return createPortal(<TourStepView key={`${tour.id}:${step.id}`} tour={tour} step={step} index={stepIndex} />, document.body);
}

function TourStepView({ tour, step, index }: { tour: Tour; step: TourStep; index: number }) {
  const next = useTourStore((s) => s.next);
  const prev = useTourStore((s) => s.prev);
  const stop = useTourStore((s) => s.stop);
  const start = useTourStore((s) => s.start);
  const navigate = useNavigate();
  const location = useLocation();
  const reduced = useReducedMotion() ?? false;
  const view = useViewport();
  const maskId = useId();
  const titleId = useId();

  // Go to the step's page first.
  const onRoute = !step.route || location.pathname === step.route;
  useEffect(() => {
    if (!onRoute && step.route) navigate(step.route);
  }, [onRoute, step.route, navigate]);

  const { rect, missing } = useTargetRect(onRoute ? step.target : undefined);
  const ready = onRoute && (!step.target || rect !== null);
  const { done, byUser } = useTaskDone(step, ready);
  const blocked = !!step.task && !done;
  const last = index === tour.steps.length - 1;
  const following = last ? nextTour(tour.id) : undefined;

  // Lift a covered target above its siblings while the step is shown.
  const raised = ready && step.raise && step.target ? ([] as string[]).concat(step.target).join("|") : "";
  useEffect(() => {
    if (!raised) return;
    const el = findTarget(raised.split("|"));
    if (!el) return;
    const before = el.style.zIndex;
    el.style.zIndex = String(RAISED_Z);
    return () => {
      el.style.zIndex = before;
    };
  }, [raised]);

  // Action done by the user → move on by itself (not on the last step,
  // whose card offers the next tour).
  const autoAdvance = !!step.task && done && byUser && !last;
  useEffect(() => {
    if (!autoAdvance) return;
    const id = window.setTimeout(next, ADVANCE_MS);
    return () => window.clearTimeout(id);
  }, [autoAdvance, next]);

  // Keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        stop();
      } else if ((e.key === "ArrowRight" || e.key === "Enter") && !blocked) {
        // Enter on a focused button belongs to that button.
        if (e.key === "Enter" && e.target instanceof HTMLButtonElement) return;
        next();
      } else if (e.key === "ArrowLeft" && index > 0) {
        prev();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [blocked, index, next, prev, stop]);

  // Card size → placement.
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(240);
  useLayoutEffect(() => {
    const h = cardRef.current?.offsetHeight;
    if (h && Math.abs(h - cardH) > 1) setCardH(h);
  });
  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, []);

  const sheet = view.w < SHEET_BREAKPOINT;
  const cardW = sheet ? view.w - 24 : Math.min(CARD_W, view.w - 24);
  const hole = rect ? inflate(rect, SPOTLIGHT_PAD) : null;
  const wantArrow = hole !== null && step.arrow !== false && !sheet;
  // Leave room between target and card for the arrow to be seen.
  const place = placeCard(hole, { w: cardW, h: cardH }, view, wantArrow ? ARROW_GAP : 16);
  const cardRect: Rect = { x: place.x, y: place.y, w: cardW, h: cardH };
  const arrow = wantArrow && hole ? nodeArrow(hole, cardRect) : null;

  const onSkipTask = useCallback(() => next(), [next]);
  const dim = "rgba(3, 7, 18, 0.62)";
  const transition = reduced ? { duration: 0 } : undefined;

  return (
    // The root lets events through; only the blockers and the card catch them.
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: 10000 }} data-testid="tour-overlay">
      {/* Dim layer with the spotlight cut out */}
      <svg className="pointer-events-none absolute inset-0" width={view.w} height={view.h} aria-hidden>
        <defs>
          <mask id={maskId}>
            <rect width={view.w} height={view.h} fill="white" />
            {hole && <rect x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx={10} fill="black" />}
          </mask>
          <marker id={`${maskId}-head`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-accent)" />
          </marker>
        </defs>
        <rect width={view.w} height={view.h} fill={dim} mask={`url(#${maskId})`} />
        {hole && (
          <rect
            x={hole.x}
            y={hole.y}
            width={hole.w}
            height={hole.h}
            rx={10}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={2}
            className={reduced ? undefined : "animate-pulse"}
          />
        )}
        {arrow && (
          <g>
            <motion.path
              d={arrow.d}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={2.5}
              strokeLinecap="round"
              markerEnd={`url(#${maskId}-head)`}
              initial={reduced ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={reduced ? { duration: 0 } : { duration: 0.6, ease: "easeOut", delay: 0.15 }}
            />
            {/* The node the arrow grows out of */}
            <circle cx={arrow.start.x} cy={arrow.start.y} r={5} fill="var(--color-accent)" />
            {!reduced && (
              <circle cx={arrow.start.x} cy={arrow.start.y} r={5} fill="none" stroke="var(--color-accent)" strokeWidth={2}>
                <animate attributeName="r" values="5;14" dur="1.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.9;0" dur="1.4s" repeatCount="indefinite" />
              </circle>
            )}
          </g>
        )}
      </svg>

      {/* Click blockers around the spotlight (the spotlight itself stays live) */}
      {hole ? (
        <>
          <div className="pointer-events-auto absolute left-0 right-0 top-0" style={{ height: Math.max(0, hole.y) }} />
          <div className="pointer-events-auto absolute left-0 right-0" style={{ top: hole.y + hole.h, bottom: 0 }} />
          <div
            className="pointer-events-auto absolute left-0"
            style={{ top: hole.y, height: hole.h, width: Math.max(0, hole.x) }}
          />
          <div
            className="pointer-events-auto absolute right-0"
            style={{ top: hole.y, height: hole.h, left: hole.x + hole.w }}
          />
        </>
      ) : (
        <div className="pointer-events-auto absolute inset-0" />
      )}

      {/* Step card */}
      <AnimatePresence>
        <motion.div
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          initial={reduced ? false : { opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={transition}
          className={cn(
            "pointer-events-auto absolute rounded-xl border border-border-primary bg-bg-secondary text-text-primary shadow-2xl shadow-black/40 outline-none",
            "max-h-[80vh] overflow-y-auto",
          )}
          style={{ left: place.x, top: place.y, width: cardW }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border-primary px-4 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              {tour.title} · {index + 1} / {tour.steps.length}
            </span>
            <button
              type="button"
              onClick={stop}
              aria-label="Leave tour"
              className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-bg-hover hover:text-text-primary"
            >
              <X size={14} />
            </button>
          </div>

          <div className="space-y-3 px-4 py-3">
            <h2 id={titleId} className="flex items-center gap-2 text-sm font-semibold">
              {step.task ? (
                <Hand size={15} className="shrink-0 text-accent" aria-hidden />
              ) : (
                <Info size={15} className="shrink-0 text-accent" aria-hidden />
              )}
              {step.title}
            </h2>
            <p className="text-[13px] leading-relaxed text-text-secondary">{step.body}</p>

            {step.points && (
              <dl className="space-y-1.5 text-[12px]">
                {step.points.map((p) => (
                  <div key={p.label} className="grid grid-cols-[7.5rem_1fr] gap-2">
                    <dt className="font-semibold text-text-primary">{p.label}</dt>
                    <dd className="text-text-secondary">{p.text}</dd>
                  </div>
                ))}
              </dl>
            )}

            {missing && step.target && (
              <p className="rounded-md bg-bg-tertiary px-3 py-2 text-[12px] text-text-muted">
                This part of the screen is not visible right now. It may need the backend running or a wider
                window. You can continue.
              </p>
            )}

            {step.task && (
              <div
                className={cn(
                  "flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]",
                  done ? "border-status-normal/40 bg-status-normal/10" : "border-accent/40 bg-accent/10",
                )}
                role="status"
                aria-live="polite"
              >
                {done ? (
                  <CheckCircle2 size={15} className="mt-px shrink-0 text-status-normal" aria-hidden />
                ) : (
                  <Hand size={15} className="mt-px shrink-0 text-accent" aria-hidden />
                )}
                <span className="font-medium text-text-primary">
                  {!done
                    ? `Your turn: ${step.task.instruction}`
                    : autoAdvance
                      ? "Done. Moving on…"
                      : "Done."}
                </span>
              </div>
            )}

            {step.caution && (
              <div className="flex items-start gap-2 rounded-md border border-status-warning/40 bg-status-warning/10 px-3 py-2 text-[12px]">
                <AlertTriangle size={15} className="mt-px shrink-0 text-status-warning" aria-hidden />
                <span className="text-text-secondary">
                  <span className="font-semibold text-text-primary">Watch out: </span>
                  {step.caution}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border-primary px-4 py-2.5">
            <button
              type="button"
              onClick={prev}
              disabled={index === 0}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-bg-hover disabled:opacity-40"
            >
              <ArrowLeft size={13} /> Back
            </button>
            <div className="flex items-center gap-2">
              {blocked && (
                <button
                  type="button"
                  onClick={onSkipTask}
                  className="rounded-md px-2 py-1 text-xs text-text-muted hover:bg-bg-hover hover:text-text-primary"
                >
                  Skip task
                </button>
              )}
              {last && following ? (
                <>
                  <button
                    type="button"
                    onClick={next}
                    className="rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-bg-hover"
                  >
                    Finish
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      next();
                      start(following.id);
                    }}
                    className="flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover"
                  >
                    Next: {following.title} <ArrowRight size={13} />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={next}
                  disabled={blocked}
                  className="flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-40"
                >
                  {last ? "Finish" : "Next"} <ArrowRight size={13} />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
