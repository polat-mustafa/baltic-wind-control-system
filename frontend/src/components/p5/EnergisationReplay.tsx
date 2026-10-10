/**
 * First energisation of circuit 1, replayed step by step: the single-line
 * diagram (IEC 60617 symbols, the same CircuitSLD the switching tab uses) after
 * each breaker and disconnector the programme operates, and four traces from
 * the backend load flow after every step — 220 kV voltages against the
 * ±5 % band, export cable current against its rating, reactive power at the
 * PSE point of connection, and the output against the PPC limit.
 *
 * Frames come from GET /commissioning/energisation-trace (one load flow per
 * switching step of a fresh programme for this farm), so the numbers are the
 * ones the learner meets when running the programme; a small map shows the same
 * frame where the plant is (EnergisationMap). Steady state only:
 * inrush and switching transients are not steady-state quantities.
 *
 * Motion (as on the style board): rings ripple from the device of the step,
 * what has just come live glows in the accent, colours fade between steps,
 * the newest trace segment draws in and the cursor glides. 1× = 3.2 s a step,
 * enough to read it; reduced motion = no ripple, no autoplay.
 */

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Pause, Play, RotateCcw, SkipBack, SkipForward, X } from "lucide-react";

import { farmKey } from "../../lib/project/farmHeader";
import { cn } from "../../lib/utils";
import { getEnergisationTrace } from "../../services/commissioningApi";
import type { EnergisationTrace, ProgrammeDetail, TraceFrame } from "../../types/commissioning";
import { Button } from "../ui/Button";
import CircuitSLD from "./CircuitSLD";

// MapLibre + deck.gl: loaded with the replay only
const EnergisationMap = lazy(() => import("./EnergisationMap"));

/** One step at 1×: time to read the step and watch the diagram and traces settle. */
const STEP_MS = 3200;
const SPEEDS = [0.5, 1, 2] as const;

// Validated chart palette (Baltic Night): series, then the limit colours
const C1 = "#1a9fb1";
const C2 = "#d0712b";
const LIMIT = "#f25c54";
const BAND = "#7189a0";

let cache: { key: string; trace: Promise<EnergisationTrace> } | null = null;
/** One trace per farm per session: the first call solves ~25 load flows. */
function loadTrace(): Promise<EnergisationTrace> {
  const key = farmKey();
  if (cache?.key !== key) {
    cache = { key, trace: getEnergisationTrace() };
    cache.trace.catch(() => (cache = null));
  }
  return cache.trace;
}

/** A frame as the programme detail CircuitSLD draws (no programme behind it: nothing operable). */
function asProgramme(t: EnergisationTrace, f: TraceFrame): ProgrammeDetail {
  return {
    programme_id: "replay",
    title: "",
    pic_name: "",
    status: "completed",
    total_steps: 0,
    completed_steps: 0,
    current_step_index: 0,
    created_at: "",
    farm: t.farm,
    phases: {},
    steps: [],
    equipment_states: t.equipment.map((e) => ({ ...e, state: f.states[e.equipment_id] ?? e.state, locked: false })),
    network: f.network,
    audit_trail: [],
    emergency_log: [],
  };
}

const busPu = (f: TraceFrame, zone: string) => f.network.buses.find((b) => b.zone === zone)?.vm_pu ?? null;

/** Short names of the programme phases the replay walks through (backend switching_programme.phases). */
function phaseName(phase: number, strings: number): string {
  if (phase === 2) return "Export cable 1";
  if (phase === 3) return "OSS 220 kV";
  if (phase === 4) return "TX-OSS-01 · 66 kV A";
  if (phase === 5) return strings > 1 ? `Strings 1–${strings}` : "String 1";
  return `Phase ${phase}`;
}

interface Series {
  label: string;
  color: string;
  values: (number | null)[];
}

/**
 * Step trace: each value holds until the next switching step. Drawn up to the
 * step shown; the newest segment draws in, the cursor and the dots glide.
 */
function Trace({
  title,
  unit,
  series,
  limits = [],
  domain,
  index,
}: {
  title: string;
  unit: string;
  series: Series[];
  limits?: { value: number; label: string; color: string }[];
  domain: [number, number];
  index: number;
}) {
  const W = 340;
  const H = 66;
  const L = 36;
  const n = series[0].values.length;
  const x = (i: number) => L + ((W - L - 8) * i) / Math.max(1, n - 1);
  const y = (v: number) => 6 + (H - 14) * (1 - (v - domain[0]) / (domain[1] - domain[0]));
  /** Step path over steps from…to: the value holds, then jumps. */
  const path = (vals: (number | null)[], from: number, to: number) => {
    let d = "";
    let pen = false;
    for (let i = from; i <= to && i < vals.length; i++) {
      const v = vals[i];
      if (v == null) {
        pen = false;
        continue;
      }
      d += pen ? ` H${x(i).toFixed(1)} V${y(v).toFixed(1)}` : ` M${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
      pen = true;
    }
    return d;
  };
  const now = series.map((s) => s.values[index]);
  return (
    <figure className="min-w-0 rounded-md border border-border-primary bg-bg-secondary px-2.5 py-2">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="text-xs font-medium text-text-secondary">{title}</span>
        <span className="flex gap-3 font-mono text-xs">
          {series.map((s, k) => (
            <span key={s.label} className="flex items-center gap-1 text-text-primary">
              <span className="h-0.5 w-3" style={{ background: s.color }} aria-hidden />
              {s.label} {now[k] == null ? "—" : `${now[k]!.toFixed(unit === "pu" ? 3 : 0)} ${unit}`}
            </span>
          ))}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full" role="img" aria-label={`${title} by switching step`}>
        {[domain[0], domain[1]].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - 8} y1={y(v)} y2={y(v)} stroke="var(--color-border-primary)" />
            <text x={L - 4} y={y(v) + 4} textAnchor="end" fontSize={11} className="fill-text-muted font-mono">
              {unit === "pu" ? v.toFixed(2) : v.toFixed(0)}
            </text>
          </g>
        ))}
        {limits.map((l) => (
          <g key={l.label}>
            <line x1={L} x2={W - 8} y1={y(l.value)} y2={y(l.value)} stroke={l.color} strokeDasharray="4 3" />
            <text x={W - 10} y={y(l.value) - 3} textAnchor="end" fontSize={11} fill={l.color}>
              {l.label}
            </text>
          </g>
        ))}
        <line
          x1={0}
          x2={0}
          y1={2}
          y2={H - 2}
          stroke="var(--color-accent)"
          strokeOpacity={0.6}
          className="trace-cursor"
          style={{ transform: `translateX(${x(index)}px)` }}
        />
        {series.map((s) => (
          <g key={s.label}>
            <path d={path(s.values, 0, Math.max(0, index - 1))} fill="none" stroke={s.color} strokeWidth={2} />
            {index > 0 && s.values[index - 1] != null && s.values[index] != null && (
              <path key={index} d={path(s.values, index - 1, index)} pathLength={1} fill="none" stroke={s.color} strokeWidth={2} className="trace-draw" />
            )}
            {s.values[index] != null && (
              <circle r={3.5} fill={s.color} className="trace-cursor" style={{ transform: `translate(${x(index)}px, ${y(s.values[index]!)}px)` }} />
            )}
          </g>
        ))}
      </svg>
    </figure>
  );
}

/** Axis range: the data and the reference lines, rounded out to `step` with ~10 % headroom on top. */
const bounds = (vals: (number | null)[], step: number, ...refs: number[]): [number, number] => {
  const v = [...vals.filter((x): x is number => x != null), ...refs];
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  return [Math.floor(lo / step) * step, Math.ceil((hi + 0.1 * (hi - lo)) / step) * step];
};

export default function EnergisationReplay({ onClose }: { onClose: () => void }) {
  const reduced = useReducedMotion() ?? false;
  const [trace, setTrace] = useState<EnergisationTrace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(!reduced);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    let alive = true;
    loadTrace()
      .then((t) => alive && setTrace(t))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);
  // Opened from the page header: bring the whole replay into view once it is drawn
  useEffect(() => {
    if (trace) ref.current?.scrollIntoView?.({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, [trace, reduced]);

  const last = (trace?.frames.length ?? 1) - 1;
  useEffect(() => {
    if (!playing || !trace) return;
    if (index >= last) return setPlaying(false);
    const id = setTimeout(() => setIndex((i) => i + 1), STEP_MS / speed);
    return () => clearTimeout(id);
  }, [playing, trace, index, last, speed]);

  const series = useMemo(() => {
    if (!trace) return null;
    const f = trace.frames;
    return {
      ons: f.map((x) => busPu(x, "ONS220")),
      oss: f.map((x) => busPu(x, "OSS220") ?? (x.network.zones.CABLE1 === "live" ? busPu(x, "CABLE1") : null)),
      send: f.map((x) => x.network.cable_i_send_a),
      recv: f.map((x) => x.network.cable_i_recv_a),
      q: f.map((x) => (x.network.zones.ONS220 === "live" ? x.network.poc_q_mvar : null)),
      p: f.map((x) => x.network.generation_mw),
    };
  }, [trace]);

  // Phases in programme order: first frame and number of frames of each
  const phases = useMemo(() => {
    const out: { phase: number; first: number; count: number }[] = [];
    trace?.frames.forEach((f, i) => {
      if (i === 0) return;
      const p = out.at(-1);
      if (p?.phase === f.phase) p.count++;
      else out.push({ phase: f.phase, first: i, count: 1 });
    });
    return out;
  }, [trace]);

  // Zones that came live at this step: accent + glow on the diagram and the map
  const fresh = useMemo(() => {
    if (!trace || index === 0) return new Set<string>();
    const before = trace.frames[index - 1].network.zones;
    const after = trace.frames[index].network.zones;
    return new Set(Object.keys(after).filter((z) => after[z] === "live" && before[z] !== "live"));
  }, [trace, index]);

  if (error) {
    return (
      <div role="alert" className="rounded-md border border-status-alarm/40 bg-status-alarm/10 p-3 text-sm text-status-alarm">
        Energisation replay unavailable: {error}
      </div>
    );
  }
  if (!trace || !series) {
    return (
      <div className="rounded-md border border-border-primary bg-bg-secondary p-6 text-sm text-text-muted" aria-busy="true">
        Solving the load flow after each switching step…
      </div>
    );
  }

  const frame = trace.frames[index];
  const net = frame.network;
  const rating = trace.cable_rating_a;
  const limitMw = trace.farm.output_limit_mw;
  const facts = [
    net.cable_i_send_a != null && `cable ${net.cable_i_send_a.toFixed(0)} A at the shore end (${((100 * net.cable_i_send_a) / rating).toFixed(0)} % of ${rating} A)`,
    series.oss[index] != null && `OSS end ${series.oss[index]!.toFixed(3)} pu`,
    series.q[index] != null && `${net.poc_q_mvar >= 0 ? "+" : ""}${net.poc_q_mvar.toFixed(0)} Mvar into PSE`,
    net.generation_mw > 0 && `${net.generation_mw.toFixed(0)} MW exported`,
  ].filter(Boolean);
  const go = (i: number) => {
    setPlaying(false);
    setIndex(Math.max(0, Math.min(last, i)));
  };
  const strings = trace.farm.section_a_strings;
  const square = "h-9 w-9 justify-center px-0";

  return (
    <section ref={ref} aria-label="Energisation replay" className="scroll-mt-3 space-y-3 rounded-md border border-border-secondary bg-bg-primary p-3">
      {/* Title + transport */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-text-primary">First energisation of circuit 1, replayed</h2>
          <p className="text-xs text-text-muted">
            {trace.farm.name}: the load flow after each of the programme's {last} switching steps (steady state; inrush and transients are not shown).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="ghost" className={square} onClick={() => go(0)} disabled={index === 0} aria-label="Back to the start">
            <RotateCcw size={15} />
          </Button>
          <Button size="sm" variant="ghost" className={square} onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous step">
            <SkipBack size={15} />
          </Button>
          {index >= last ? (
            <Button size="sm" className="h-9 min-w-[5.5rem]" onClick={() => (setIndex(0), setPlaying(true))}>
              <RotateCcw size={15} /> Replay
            </Button>
          ) : (
            <Button size="sm" className="h-9 min-w-[5.5rem]" onClick={() => setPlaying((p) => !p)}>
              {playing ? <Pause size={15} /> : <Play size={15} />} {playing ? "Pause" : "Play"}
            </Button>
          )}
          <Button size="sm" variant="ghost" className={square} onClick={() => go(index + 1)} disabled={index >= last} aria-label="Next step">
            <SkipForward size={15} />
          </Button>
          <div role="radiogroup" aria-label="Replay speed" className="ml-1 inline-flex h-9 overflow-hidden rounded-md border border-border-secondary">
            {SPEEDS.map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={speed === v}
                onClick={() => setSpeed(v)}
                translate="no"
                className={cn(
                  "min-w-9 px-2 font-mono text-xs transition-colors",
                  speed === v ? "bg-accent/15 text-accent" : "text-text-secondary hover:text-text-primary",
                )}
              >
                {v}×
              </button>
            ))}
          </div>
          <span className="ml-1 font-mono text-xs text-text-muted" translate="no">
            <span className="text-base text-text-primary">{index}</span> / {last}
          </span>
          <Button size="sm" variant="ghost" className={square} onClick={onClose} aria-label="Close the replay">
            <X size={15} />
          </Button>
        </div>
      </div>

      {/* Progress: the slider is the track, the phases under it in proportion */}
      <div>
        <input
          type="range"
          min={0}
          max={last}
          value={index}
          onChange={(e) => go(Number(e.target.value))}
          aria-label="Switching step"
          className="w-full accent-accent"
        />
        <div className="mt-1 grid gap-1.5" style={{ gridTemplateColumns: phases.map((p) => `${p.count}fr`).join(" ") }}>
          {phases.map((p) => {
            const done = Math.max(0, Math.min(1, (index - p.first + 1) / p.count));
            const active = done > 0 && done < 1;
            return (
              <button
                key={p.phase}
                type="button"
                onClick={() => go(p.first)}
                className={cn(
                  "flex min-w-0 flex-col gap-1 text-left text-xs",
                  active ? "text-accent" : done === 1 ? "text-text-secondary" : "text-text-muted",
                )}
              >
                <span className="h-[3px] w-full overflow-hidden rounded-full bg-border-primary">
                  <span className="block h-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${done * 100}%` }} />
                </span>
                <span className={cn("truncate", !active && "max-sm:hidden")}>
                  <span>{phaseName(p.phase, strings)}</span>
                  {done === 1 && <span aria-hidden> ✓</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
        {/* Diagram + what this step did */}
        <div className="flex min-w-0 flex-col rounded-md border border-border-primary bg-bg-secondary">
          <CircuitSLD programme={asProgramme(trace, frame)} focus={frame.equipment_id} fresh={fresh} fit />
          <p role="status" aria-live="polite" className="min-h-[3.5rem] border-t border-border-primary px-3 py-2 text-sm text-text-primary">
            <span className="mr-2 font-mono text-accent">{index === 0 ? "as built" : frame.step_id}</span>
            {frame.action}
            {facts.length > 0 && (
              <span className="flex flex-wrap gap-x-1.5 font-mono text-xs text-text-secondary">
                {/* one span per reading, so each translates on its own */}
                {facts.map((f, k) => (
                  <span key={k}>
                    {k > 0 && <span aria-hidden>· </span>}
                    <span>{f}</span>
                  </span>
                ))}
              </span>
            )}
          </p>
        </div>

        <div className="grid min-w-0 content-start gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <figure className="relative h-40 overflow-hidden rounded-md border border-border-primary sm:col-span-2 xl:col-span-1" aria-label="The plant on the map at this step">
            <Suspense fallback={<div className="h-full bg-bg-secondary" />}>
              <EnergisationMap frame={frame} fresh={fresh} />
            </Suspense>
          </figure>
          <Trace
            title="220 kV voltage"
            unit="pu"
            series={[
              { label: "onshore", color: C2, values: series.ons },
              { label: "OSS", color: C1, values: series.oss },
            ]}
            limits={[
              { value: 1.05, label: "1.05", color: BAND },
              { value: 0.95, label: "0.95", color: BAND },
            ]}
            domain={[0.92, 1.08]}
            index={index}
          />
          <Trace
            title="Export cable 1 current"
            unit="A"
            series={[
              { label: "shore", color: C1, values: series.send },
              { label: "OSS", color: C2, values: series.recv },
            ]}
            limits={[{ value: rating, label: `${rating} A rating`, color: LIMIT }]}
            domain={bounds([...series.send, ...series.recv], 100, 0, rating)}
            index={index}
          />
          <Trace
            title="Reactive power at PSE 400 kV"
            unit="Mvar"
            series={[{ label: "Q", color: C1, values: series.q }]}
            limits={[{ value: 0, label: "0", color: BAND }]}
            domain={bounds(series.q, 50, 0, 0)}
            index={index}
          />
          <Trace
            title="Output"
            unit="MW"
            series={[{ label: "P", color: C1, values: series.p }]}
            limits={[{ value: limitMw, label: `PPC limit ${limitMw.toFixed(0)} MW`, color: BAND }]}
            domain={bounds(series.p, 50, 0, limitMw)}
            index={index}
          />
        </div>
      </div>

      {/* The steps around this one: done · now · next */}
      <ol className="grid grid-cols-3 gap-2 md:grid-cols-5" aria-label="Steps around this one">
        {[-2, -1, 0, 1, 2].map((d) => {
          const i = index + d;
          const f = i >= 0 ? trace.frames[i] : undefined;
          const edge = Math.abs(d) === 2 ? "max-md:hidden" : undefined;
          if (!f) return <li key={d} aria-hidden className={edge} />;
          return (
            <li key={d} className={edge}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={d === 0 ? "step" : undefined}
                className={cn(
                  "flex h-full w-full flex-col gap-1 rounded-md border px-2.5 py-2 text-left transition-colors duration-500",
                  d === 0 ? "border-accent bg-accent/10" : "border-border-primary bg-bg-secondary hover:border-border-secondary",
                )}
              >
                <span className="flex justify-between gap-2 font-mono text-xs">
                  <span className={d === 0 ? "text-accent" : "text-text-muted"}>{i === 0 ? "0" : f.step_id}</span>
                  <span className="text-text-muted">{d < 0 ? "done" : d === 0 ? "now" : "next"}</span>
                </span>
                <span className={cn("line-clamp-2 text-xs leading-snug", d === 0 ? "text-text-primary" : "text-text-secondary")}>{f.action}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
