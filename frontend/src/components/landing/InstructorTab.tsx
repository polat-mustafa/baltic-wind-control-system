/**
 * Instructor tab of the Scenario Center: inject disturbances into the live
 * farm, watch the operator's response on a timeline, debrief with response
 * times and the farm-power trace (store/instructorStore).
 */

import { useState } from "react";
import { Download, Play, Square } from "lucide-react";

import { debriefStats, useInstructorStore, type Injection, type PlantSample } from "../../store/instructorStore";
import { TURBINE_POSITIONS } from "../../constants/windFarmLayout";
import type { TurbineFaultType } from "../../types/scada";

const FAULTS: TurbineFaultType[] = [
  "PITCH_CONTROL_FAULT",
  "CONVERTER_OVERTEMP",
  "GEARBOX_OIL_TEMP",
  "HYDRAULIC_PRESSURE_LOW",
  "VIBRATION_ALARM",
  "COMMUNICATION_LOSS",
];

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const btn = "rounded border border-border-primary px-2 py-1 text-[11px] font-semibold hover:bg-bg-hover";

export default function InstructorTab() {
  const s = useInstructorStore();
  const [turbine, setTurbine] = useState("WTG-09");
  const [fault, setFault] = useState<TurbineFaultType>("PITCH_CONTROL_FAULT");
  const stats = debriefStats(s.injections);

  const download = () => {
    const url = URL.createObjectURL(new Blob([s.exportJson()], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `training-session-${new Date().toISOString().slice(0, 16).replace(":", "")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-h-[70vh] space-y-2 overflow-y-auto p-2.5 text-[12px] text-text-primary">
      <div className="flex items-center gap-2">
        {s.recording ? (
          <button type="button" onClick={s.stop} className={`${btn} flex items-center gap-1`}>
            <Square size={11} /> End session
          </button>
        ) : (
          <button type="button" onClick={s.start} className={`${btn} flex items-center gap-1`}>
            <Play size={11} /> Start session
          </button>
        )}
        <span className="font-semibold text-text-muted">
          {s.recording ? "recording…" : s.events.length ? "session ended — debrief below" : "inject to start recording"}
        </span>
      </div>

      <fieldset className="space-y-1.5 rounded border border-border-primary p-2">
        <legend className="px-1 text-[11px] font-bold uppercase tracking-wide text-text-muted">Inject</legend>
        <div className="flex flex-wrap items-center gap-1">
          <select value={turbine} onChange={(e) => setTurbine(e.target.value)} className="rounded border border-border-primary bg-bg-secondary px-1 py-0.5" aria-label="Turbine">
            {TURBINE_POSITIONS.map((t) => (
              <option key={t.id}>{t.id}</option>
            ))}
          </select>
          <select value={fault} onChange={(e) => setFault(e.target.value as TurbineFaultType)} className="min-w-0 flex-1 rounded border border-border-primary bg-bg-secondary px-1 py-0.5" aria-label="Fault type">
            {FAULTS.map((f) => (
              <option key={f} value={f}>{f.replace(/_/g, " ").toLowerCase()}</option>
            ))}
          </select>
          <button type="button" className={btn} onClick={() => s.injectTurbineFault(turbine, fault)}>Trip</button>
        </div>
        <div className="flex flex-wrap gap-1">
          <button type="button" className={btn} onClick={s.injectArrayFault}>66 kV cable fault</button>
          <button type="button" className={btn} onClick={() => s.injectGridEvent("underfrequency")}>Under-frequency</button>
          <button type="button" className={btn} onClick={() => s.injectGridEvent("overfrequency")}>Over-frequency</button>
          <button type="button" className={btn} onClick={() => s.injectGridEvent("voltage-dip")}>Voltage dip</button>
          <button type="button" className={btn} onClick={() => s.injectWindVeer(90)}>Wind veer +90°</button>
          <button type="button" className={btn} onClick={() => s.injectWindVeer(-60)}>Wind back −60°</button>
        </div>
      </fieldset>

      {s.injections.length > 0 && (
        <div className="grid grid-cols-4 gap-1 text-center">
          <Stat label="injected" value={String(stats.injected)} />
          <Stat label="cleared" value={String(stats.cleared)} />
          <Stat label="mean resp." value={stats.meanS === null ? "—" : `${stats.meanS.toFixed(0)} s`} />
          <Stat label="worst" value={stats.worstS === null ? "—" : `${stats.worstS.toFixed(0)} s`} />
        </div>
      )}

      {s.samples.length > 1 && <PowerTrace samples={s.samples} injections={s.injections} />}

      {s.events.length > 0 && (
        <ol className="space-y-0.5 border-l-2 border-border-primary pl-2">
          {s.events.map((e, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-10 shrink-0 font-mono text-text-muted tabular-nums">{mmss(e.t)}</span>
              <span className={e.kind === "operator" ? "font-semibold text-status-normal" : e.kind === "note" ? "text-text-muted" : "font-semibold text-status-warning"}>
                {e.kind === "operator" ? "✔ " : e.kind === "note" ? "" : "⚡ "}
                {e.text}
              </span>
            </li>
          ))}
        </ol>
      )}

      {!s.recording && s.events.length > 0 && (
        <button type="button" onClick={download} className={`${btn} flex items-center gap-1`}>
          <Download size={11} /> Export session (JSON)
        </button>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border-primary bg-bg-secondary px-1 py-0.5">
      <div className="font-mono text-[13px] font-bold tabular-nums">{value}</div>
      <div className="text-[10px] font-semibold text-text-muted">{label}</div>
    </div>
  );
}

/** Farm output over the session; amber ticks = injections, green = cleared. */
function PowerTrace({ samples, injections }: { samples: PlantSample[]; injections: Injection[] }) {
  const W = 290;
  const H = 70;
  const t1 = Math.max(samples[samples.length - 1].t, 1);
  const x = (t: number) => (t / t1) * W;
  const y = (mw: number) => H - (Math.min(mw, 520) / 520) * (H - 6);
  const d = samples.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.mw).toFixed(1)}`).join("");
  return (
    <figure className="bw-viz">
      <figcaption className="flex justify-between text-[11px] font-bold">
        <span>Farm output [MW]</span>
        <span className="font-mono tabular-nums">{samples[samples.length - 1].mw.toFixed(0)} MW</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Farm power during the session with injections marked">
        {[0, 255, 510].map((mw) => (
          <line key={mw} x1={0} x2={W} y1={y(mw)} y2={y(mw)} style={{ stroke: "var(--color-border-primary)" }} strokeOpacity={0.35} strokeWidth={0.6} />
        ))}
        {injections.map((i) => (
          <g key={i.id}>
            <line x1={x(i.t)} x2={x(i.t)} y1={0} y2={H} style={{ stroke: "var(--color-status-warning)" }} strokeWidth={1.2} />
            {i.clearedT !== null && (
              <line x1={x(i.clearedT)} x2={x(i.clearedT)} y1={0} y2={H} style={{ stroke: "var(--color-status-normal)" }} strokeWidth={1.2} strokeDasharray="3 2" />
            )}
            <title>{i.label}</title>
          </g>
        ))}
        <path d={d} fill="none" style={{ stroke: "var(--viz-1)" }} strokeWidth={2} />
      </svg>
    </figure>
  );
}
