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
 * ones the learner meets when running the programme. Steady state only:
 * inrush and switching transients are not steady-state quantities.
 */

import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, X } from "lucide-react";

import { farmKey } from "../../lib/project/farmHeader";
import { getEnergisationTrace } from "../../services/commissioningApi";
import type { EnergisationTrace, ProgrammeDetail, TraceFrame } from "../../types/commissioning";
import { Button } from "../ui/Button";
import CircuitSLD from "./CircuitSLD";

const FRAME_MS = 1600;

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

interface Series {
  label: string;
  color: string;
  values: (number | null)[];
}

/** Step trace: each value holds until the next switching step; the cursor marks the step shown. */
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
  const W = 320;
  const H = 120;
  const L = 34;
  const n = series[0].values.length;
  const x = (i: number) => L + ((W - L - 6) * i) / Math.max(1, n - 1);
  const y = (v: number) => 8 + (H - 26) * (1 - (v - domain[0]) / (domain[1] - domain[0]));
  const path = (vals: (number | null)[]) => {
    let d = "";
    let pen = false;
    for (let i = 0; i <= index && i < vals.length; i++) {
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
    <figure className="rounded-md border border-border-primary bg-bg-secondary p-2.5">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">{title}</span>
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
        {[domain[0], (domain[0] + domain[1]) / 2, domain[1]].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - 6} y1={y(v)} y2={y(v)} stroke="var(--color-border-primary)" />
            <text x={L - 4} y={y(v) + 4} textAnchor="end" fontSize={10} className="fill-text-muted font-mono">
              {unit === "pu" ? v.toFixed(2) : v.toFixed(0)}
            </text>
          </g>
        ))}
        {limits.map((l) => (
          <g key={l.label}>
            <line x1={L} x2={W - 6} y1={y(l.value)} y2={y(l.value)} stroke={l.color} strokeDasharray="4 3" />
            <text x={W - 8} y={y(l.value) - 3} textAnchor="end" fontSize={10} fill={l.color}>
              {l.label}
            </text>
          </g>
        ))}
        <line x1={x(index)} x2={x(index)} y1={6} y2={H - 18} stroke="var(--color-text-muted)" strokeDasharray="2 3" />
        {series.map((s) => (
          <path key={s.label} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} />
        ))}
        <text x={L} y={H - 4} fontSize={10} className="fill-text-muted">
          as built
        </text>
        <text x={W - 6} y={H - 4} textAnchor="end" fontSize={10} className="fill-text-muted">
          switching step →
        </text>
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

  useEffect(() => {
    let alive = true;
    loadTrace()
      .then((t) => alive && setTrace(t))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const last = (trace?.frames.length ?? 1) - 1;
  useEffect(() => {
    if (!playing || !trace) return;
    if (index >= last) return setPlaying(false);
    const id = setTimeout(() => setIndex((i) => i + 1), FRAME_MS);
    return () => clearTimeout(id);
  }, [playing, trace, index, last]);

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

  return (
    <section aria-label="Energisation replay" className="space-y-3 rounded-md border border-border-secondary bg-bg-primary p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">First energisation of circuit 1, replayed</h2>
          <p className="text-xs text-text-muted">
            {trace.farm.name}: the load flow after each of the programme's {last} switching steps (steady state; inrush and transients are not shown).
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} aria-label="Previous step">
            <ChevronLeft size={14} />
          </Button>
          {index >= last ? (
            <Button size="sm" variant="secondary" onClick={() => (setIndex(0), setPlaying(true))}>
              <RotateCcw size={14} /> Replay
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setPlaying((p) => !p)}>
              {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? "Pause" : "Play"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setIndex((i) => Math.min(last, i + 1))} disabled={index >= last} aria-label="Next step">
            <ChevronRight size={14} />
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close the replay">
            <X size={14} />
          </Button>
        </div>
      </div>

      <div>
        <input
          type="range"
          min={0}
          max={last}
          value={index}
          onChange={(e) => (setPlaying(false), setIndex(Number(e.target.value)))}
          aria-label="Switching step"
          className="w-full accent-accent"
        />
        <p role="status" aria-live="polite" className="mt-1 min-h-[2.75rem] text-sm text-text-primary">
          <span className="mr-2 font-mono text-text-muted">{index === 0 ? "as built" : `step ${frame.step_id}`}</span>
          {frame.action}
          {facts.length > 0 && <span className="block font-mono text-xs text-text-secondary">{facts.join(" · ")}</span>}
        </p>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="rounded-md border border-border-primary bg-bg-secondary p-2">
          <CircuitSLD programme={asProgramme(trace, frame)} focus={frame.equipment_id} />
        </div>
        <div className="grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-1">
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
    </section>
  );
}
