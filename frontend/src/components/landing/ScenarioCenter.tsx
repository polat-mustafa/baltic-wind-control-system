/**
 * Scenario Center — training drills and grid events on the landing map.
 *
 * Training: step-by-step drills with narration (Web Speech API), hints,
 * quizzes and a score (store/trainingStore, training/scenarios).
 * Grid events: CE 3 GW under-/over-frequency and a 400 kV voltage dip with
 * the farm's LFSM and FRT response (utils/gridEvents), plotted live.
 */

import StudyTab from "./StudyTab";
import InstructorTab from "./InstructorTab";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, Cable, Fan, GraduationCap, Volume2, VolumeX, X, Zap } from "lucide-react";
import { bestScores, drillMissionId, passed, useAcademyStore } from "../../store/academyStore";

import { useLandingStore } from "../../store/landingStore";
import { useTrainingStore } from "../../store/trainingStore";
import { SCENARIOS } from "../../training/scenarios";
import { useGridEventSample } from "../../hooks/useGridEventSample";
import { lvrtLimit, type GridEventKind, type GridSample } from "../../utils/gridEvents";

// ── Mini chart ───────────────────────────────────────────────────

function Chart({ kind, traj, tS }: { kind: GridEventKind; traj: GridSample[]; tS: number }) {
  const W = 290;
  const H = 110;
  const end = traj[traj.length - 1].t;
  const shown = traj.filter((p) => p.t <= tS);
  const x = (t: number) => (t / end) * W;
  const dip = kind === "voltage-dip";
  const [lo, hi] = dip ? [0, 1.1] : kind === "underfrequency" ? [49.6, 50.05] : [49.95, 50.4];
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const main = (p: GridSample) => (dip ? p.u : p.f);
  const pMax = Math.max(...traj.map((p) => p.pMW), 1);
  const yP = (v: number) => H - (v / (pMax * 1.15)) * H;
  const line = (pts: [number, number][]) => pts.map(([a, b], i) => `${i ? "L" : "M"}${a.toFixed(1)},${b.toFixed(1)}`).join("");
  const guides = dip
    ? [{ v: 0.9, label: "0.9 pu" }]
    : kind === "underfrequency"
      ? [{ v: 49.8, label: "49.8 Hz LFSM-U" }]
      : [{ v: 50.2, label: "50.2 Hz LFSM-O" }];
  return (
    <svg width={W} height={H + 14} className="block" role="img" aria-label="Grid event chart">
      <rect width={W} height={H} fill="var(--color-bg-secondary)" rx={3} />
      {guides.map((g) => (
        <g key={g.label}>
          <line x1={0} x2={W} y1={y(g.v)} y2={y(g.v)} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={0.8} />
          <text x={W - 2} y={y(g.v) - 2} fontSize={8} textAnchor="end" fill="#f59e0b">
            {g.label}
          </text>
        </g>
      ))}
      {dip && (
        <path
          d={line(traj.filter((_, i) => i % 5 === 0).map((p) => [x(p.t), y(lvrtLimit(p.t))]))}
          fill="none"
          stroke="#ef4444"
          strokeWidth={1}
          strokeDasharray="4 2"
        />
      )}
      <path d={line(shown.map((p) => [x(p.t), yP(p.pMW)]))} fill="none" stroke="#3ecf6e" strokeWidth={1.4} />
      {dip && (
        <path
          d={line(shown.map((p) => [x(p.t), yP(p.qMVAr + p.statcomMVAr)]))}
          fill="none"
          stroke="#22d3ee"
          strokeWidth={1.2}
        />
      )}
      <path d={line(shown.map((p) => [x(p.t), y(main(p))]))} fill="none" stroke="#60a5fa" strokeWidth={1.8} />
      <text x={2} y={H + 11} fontSize={8.5} fill="var(--color-text-muted)">
        <tspan fill="#60a5fa">{dip ? "U [pu]" : "f [Hz]"}</tspan>
        <tspan dx={8} fill="#3ecf6e">
          P farm [MW]
        </tspan>
        {dip && (
          <tspan dx={8} fill="#22d3ee">
            Q farm+STATCOM
          </tspan>
        )}
        {dip && (
          <tspan dx={8} fill="#ef4444">
            PSE LVRT
          </tspan>
        )}
        <tspan dx={8}>{end.toFixed(0)} s</tspan>
      </text>
    </svg>
  );
}

// ── Grid events tab ──────────────────────────────────────────────

function GridEventsTab() {
  const ev = useLandingStore((s) => s.gridEvent);
  const reserve = useLandingStore((s) => s.deltaReservePct);
  const setReserve = useLandingStore((s) => s.setDeltaReserve);
  const trigger = useLandingStore((s) => s.triggerGridEvent);
  const report = useTrainingStore((s) => s.report);
  const live = useGridEventSample();

  const fire = (k: GridEventKind) => {
    trigger(k);
    report({ type: "grid-event", kind: k });
  };
  return (
    <div className="space-y-2 px-3 py-2 text-[11px]">
      <div className="grid grid-cols-3 gap-1">
        {(
          [
            ["underfrequency", "−3 GW trip", "under-frequency"],
            ["overfrequency", "−3 GW load", "over-frequency"],
            ["voltage-dip", "400 kV fault", "voltage dip / FRT"],
          ] as [GridEventKind, string, string][]
        ).map(([k, a, b]) => (
          <button
            key={k}
            type="button"
            onClick={() => fire(k)}
            className="rounded border border-border-primary bg-bg-secondary px-1.5 py-1 text-left hover:bg-bg-hover"
          >
            <div className="font-semibold text-text-primary">{a}</div>
            <div className="text-[10px] text-text-muted">{b}</div>
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-text-secondary">
        Δ-reserve
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={reserve}
          onChange={(e) => setReserve(Number(e.target.value))}
          className="flex-1"
          aria-label="Delta reserve percent"
        />
        <span className="w-9 text-right font-mono text-text-primary">{reserve} %</span>
      </label>
      {ev && live ? (
        <>
          <Chart kind={ev.kind} traj={ev.traj} tS={live.tS} />
          <div className="grid grid-cols-2 gap-x-3 font-mono text-[10.5px] tabular-nums">
            {ev.kind === "voltage-dip" ? (
              <>
                <span className="text-text-muted">U PCC</span>
                <span className="text-right">{live.s.u.toFixed(2)} pu</span>
                <span className="text-text-muted">Q farm / STATCOM</span>
                <span className="text-right">
                  {live.s.qMVAr.toFixed(0)} / {live.s.statcomMVAr.toFixed(0)} MVAr
                </span>
              </>
            ) : (
              <>
                <span className="text-text-muted">f</span>
                <span className="text-right">{live.s.f.toFixed(3)} Hz</span>
                <span className="text-text-muted">ΔP farm</span>
                <span className="text-right">{(live.s.pMW - ev.traj[0].pMW).toFixed(1)} MW</span>
              </>
            )}
            <span className="text-text-muted" title="Event model starts from the output at trigger; wind changes after that are not included">
              P farm (event model)
            </span>
            <span className="text-right">{live.s.pMW.toFixed(0)} MW</span>
            <span className="text-text-muted">time</span>
            <span className="text-right">
              {live.tS.toFixed(ev.kind === "voltage-dip" ? 2 : 0)} s{ev.slowMo > 1 ? ` (×${ev.slowMo} slow)` : ""}
            </span>
          </div>
        </>
      ) : (
        <p className="text-[10.5px] leading-snug text-text-muted">
          CE reference incident 3 GW (SOGL Art. 153): H = 5 s, 300 GW, FCR 3 GW at 200 mHz. Farm response per NC RfG
          Art. 15 (LFSM, droop 5 %) and FRT per the PSE LVRT envelope. Illustrative system parameters.
        </p>
      )}
    </div>
  );
}

// ── Training tab ─────────────────────────────────────────────────

/** Signature of each drill's event, drawn as a tiny trace on its card (x 0–100, y 0–30). */
const PREVIEW: Record<string, { label: string; d: string; tone: string; icon: typeof Zap }> = {
  "cable-fault": { label: "string power", d: "M0 6 H38 L40 26 H64 L66 15 H100", tone: "#f59e0b", icon: Cable },
  "turbine-fault": { label: "turbine power", d: "M0 8 C10 6 20 10 30 7 L34 26 H100", tone: "#ef4444", icon: Fan },
  underfrequency: { label: "frequency", d: "M0 6 H20 C26 6 30 26 38 26 C48 26 56 16 70 15 H100", tone: "#60a5fa", icon: Activity },
  "voltage-dip": { label: "PCC voltage", d: "M0 5 H24 L26 24 H34 L42 9 C60 6 80 5 100 5", tone: "#a78bfa", icon: Zap },
};

function ScenarioCard({ id, title, summary, steps, parS, best, onStart }: {
  id: string; title: string; summary: string; steps: number; parS: number; best?: number; onStart: () => void;
}) {
  const pv = PREVIEW[id];
  const Icon = pv?.icon ?? GraduationCap;
  return (
    <button
      type="button"
      onClick={onStart}
      className="group w-full rounded-lg border border-border-primary bg-bg-secondary p-2 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-lg"
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 rounded-md p-1.5" style={{ background: `${pv?.tone ?? "#60a5fa"}22` }}>
          <Icon size={14} style={{ color: pv?.tone }} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-semibold text-text-primary">{title}</span>
          <span className="block text-[10.5px] leading-snug text-text-muted">{summary}</span>
        </span>
        {pv && (
          <svg viewBox="0 0 100 30" className="h-8 w-20 shrink-0" aria-hidden>
            <path d={pv.d} fill="none" stroke={pv.tone} strokeWidth={1.6} strokeLinejoin="round" opacity={0.85} />
            <circle r={2.2} fill={pv.tone}>
              <animateMotion dur="3s" repeatCount="indefinite" path={pv.d} />
            </circle>
          </svg>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px]">
        <span className="rounded-full border border-border-primary px-1.5 py-0.5 text-text-muted">{steps} steps</span>
        <span className="rounded-full border border-border-primary px-1.5 py-0.5 text-text-muted">par {parS} s</span>
        {pv && <span className="rounded-full border border-border-primary px-1.5 py-0.5 text-text-muted">watch: {pv.label}</span>}
        <span className={`ml-auto rounded-full px-1.5 py-0.5 font-semibold ${best != null ? (passed(best) ? "bg-status-normal/15 text-status-normal" : "bg-status-warning/15 text-status-warning") : "text-text-muted"}`}>
          {best != null ? `best ${best}` : "not tried"}
        </span>
        <span className="text-accent opacity-0 transition-opacity group-hover:opacity-100">Start →</span>
      </div>
    </button>
  );
}

function TrainingTab() {
  const t = useTrainingStore();
  const best = bestScores(useAcademyStore((s) => s.attempts));
  // Re-check the active step whenever plant state changes
  const turbineMap = useLandingStore((s) => s.turbineMap);
  const arrayFault = useLandingStore((s) => s.arrayFault);
  const gridEvent = useLandingStore((s) => s.gridEvent);
  const [, tick] = useState(0);
  useEffect(() => {
    useTrainingStore.getState().evaluate();
  }, [turbineMap, arrayFault, gridEvent]);
  useEffect(() => {
    if (!t.active) return;
    const id = setInterval(() => {
      tick((n) => n + 1);
      useTrainingStore.getState().evaluate();
    }, 1000);
    return () => clearInterval(id);
  }, [t.active]);

  if (!t.active) {
    return (
      <div className="grid gap-2 px-3 py-2">
        {SCENARIOS.map((sc) => (
          <ScenarioCard key={sc.id} id={sc.id} title={sc.title} summary={sc.summary} steps={sc.steps.length} parS={sc.parS} best={best[drillMissionId(sc.id)]} onStart={() => t.start(sc.id)} />
        ))}
      </div>
    );
  }

  const sc = t.active;
  const step = sc.steps[t.stepIdx];
  const elapsed = Math.round((Date.now() - t.startedAt) / 1000);
  return (
    <div className="space-y-2 px-3 py-2 text-[11px]">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-text-primary">{sc.title}</span>
        <span className="font-mono text-text-muted">
          {t.result ? "done" : `step ${t.stepIdx + 1}/${sc.steps.length}`} · {elapsed} s · ✗ {t.mistakes}
        </span>
      </div>
      {t.result ? (
        <div className="rounded border border-border-primary bg-bg-secondary p-2">
          <div className="text-[20px] font-semibold text-text-primary">{t.result.score} / 100</div>
          <div className="text-text-muted">
            {t.result.timeS.toFixed(0)} s · {t.result.mistakes} mistake(s) · par {sc.parS} s
          </div>
          <p className="mt-1 leading-snug text-text-secondary">{sc.debrief}</p>
          <div className="mt-1 text-[10px] text-text-muted">References: {sc.refs.join(" · ")}</div>
        </div>
      ) : (
        step && (
          <div className="rounded border border-border-primary bg-bg-secondary p-2">
            <p className="leading-snug text-text-primary">{typeof step.say === "function" ? step.say() : step.say}</p>
            {step.hint && <p className="mt-1 text-[10.5px] text-text-muted">Hint: {step.hint}</p>}
            {step.kind === "quiz" && (
              <div className="mt-1.5 space-y-1">
                {step.options?.().map((o, i) => (
                  <button
                    key={o.label}
                    type="button"
                    onClick={() => t.answer(i)}
                    className="w-full rounded border border-border-primary bg-bg-primary px-2 py-1 text-left hover:bg-bg-hover"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      )}
      <div className="max-h-24 space-y-0.5 overflow-y-auto">
        {t.log
          .slice()
          .reverse()
          .map((l) => (
            <div
              key={l.t + l.text}
              className="text-[10.5px] leading-snug"
              style={{ color: l.tone === "ok" ? "#3ecf6e" : l.tone === "error" ? "#ef4444" : "var(--color-text-muted)" }}
            >
              {l.text}
            </div>
          ))}
      </div>
      <div className="flex gap-1">
        {!t.result && step?.kind === "action" && (
          <button type="button" onClick={t.skip} className="rounded border border-border-primary px-2 py-0.5 hover:bg-bg-hover">
            Skip step
          </button>
        )}
        <button type="button" onClick={t.stop} className="rounded border border-border-primary px-2 py-0.5 hover:bg-bg-hover">
          {t.result ? "Close" : "End drill"}
        </button>
      </div>
    </div>
  );
}

// ── Panel ────────────────────────────────────────────────────────

export default function ScenarioCenter() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"training" | "grid" | "instructor" | "study">("training");
  const voice = useTrainingStore((s) => s.voice);
  const setVoice = useTrainingStore((s) => s.setVoice);
  const active = useTrainingStore((s) => s.active);
  const [params, setParams] = useSearchParams();

  // Academy deep link: /?drill=<scenario id> opens the panel and starts the drill.
  const drill = params.get("drill");
  useEffect(() => {
    if (!drill) return;
    if (SCENARIOS.some((s) => s.id === drill)) {
      setOpen(true);
      setTab("training");
      useTrainingStore.getState().start(drill);
    }
    setParams({}, { replace: true });
  }, [drill, setParams]);

  return (
    <div className="absolute right-3 top-14 md:top-40 z-1000 flex flex-col items-end">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md border border-border-secondary bg-bg-primary/90 px-2.5 py-1.5 text-[11px] font-medium text-text-primary hover:bg-bg-hover"
        aria-expanded={open}
      >
        <GraduationCap size={14} />
        Scenarios{active ? " · running" : ""}
      </button>
      {open && (
        <div className="mt-1.5 w-[340px] overflow-hidden rounded-lg border border-border-primary bg-bg-primary/95 shadow-lg shadow-black/30 backdrop-blur-sm">
          <div className="flex items-center border-b border-border-primary/60 text-[11px]">
            {(
              [
                ["training", "Training"],
                ["grid", "Grid events"],
                ["instructor", "Instructor"],
                ["study", "Study"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className="px-3 py-1.5"
                style={{
                  color: tab === k ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  borderBottom: tab === k ? "2px solid var(--color-accent)" : "2px solid transparent",
                }}
              >
                {label}
              </button>
            ))}
            <div className="ml-auto flex items-center">
              <button
                type="button"
                onClick={() => setVoice(!voice)}
                className="px-2 text-text-muted hover:text-text-primary"
                aria-label={voice ? "Mute narration" : "Enable narration"}
                title={voice ? "Narration on" : "Narration off"}
              >
                {voice ? <Volume2 size={13} /> : <VolumeX size={13} />}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-2 text-text-muted hover:text-text-primary"
                aria-label="Close scenarios"
              >
                <X size={13} />
              </button>
            </div>
          </div>
          {tab === "training" ? (
            <TrainingTab />
          ) : tab === "grid" ? (
            <GridEventsTab />
          ) : tab === "instructor" ? (
            <InstructorTab />
          ) : (
            <StudyTab />
          )}
        </div>
      )}
    </div>
  );
}
