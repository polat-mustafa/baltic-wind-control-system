/**
 * Digital Twin diagnosis challenge. The backend runs a week of the twin on a
 * randomly chosen scenario and seed (POST /api/v1/digital-twin/analyze);
 * the learner sees only the detection evidence — channel health and alarm
 * events — not the twin's diagnosis. Graded against the injected ground
 * truth (validation rows), then the twin's own answer is shown.
 */

import { useState } from "react";
import { Play, Send } from "lucide-react";

import { pickOne, rng, newSeed } from "../../academy/random";
import { scoreDiagnosis, type Finding, type Scored } from "../../academy/scoring";
import { cn } from "../../lib/utils";
import { postAnalyze, type AnalyzeResponse, type ChannelKey, type FaultKind, type ScenarioName } from "../../services/digitalTwinApi";
import { useAcademyStore } from "../../store/academyStore";
import { Button } from "../ui/Button";
import { WatchOut } from "../site/Stages";
import { ScoreCard } from "./MissionFrame";

const SCENARIOS: ScenarioName[] = [
  "healthy",
  "rotor_icing",
  "pitch_misalignment",
  "converter_derating",
  "generator_degradation",
  "anemometer_drift",
];
const DAYS = 7;

const CHANNELS: { key: ChannelKey; short: string }[] = [
  { key: "power", short: "P" },
  { key: "rotor_speed", short: "ω" },
  { key: "pitch", short: "β" },
  { key: "generator_temp", short: "T_gb" },
  { key: "anemometer", short: "v" },
];

/** Fault library (backend services/digital_twin) with the evidence each one leaves. */
const FAULTS: { kind: FaultKind; label: string; signature: string }[] = [
  {
    kind: "aero_efficiency",
    label: "Aerodynamic efficiency loss (icing)",
    signature: "Less power and rotor speed at the same wind; cold, humid weather; often several turbines at once.",
  },
  {
    kind: "pitch_offset",
    label: "Pitch angle misalignment",
    signature: "Pitch angle away from the controller's schedule; power and rotor speed low below rated.",
  },
  {
    kind: "power_limit",
    label: "Uncommanded power limitation",
    signature: "Power capped at high wind; the turbine pitches out (pitch high) to shed the surplus.",
  },
  {
    kind: "generator_loss",
    label: "Generator loss increase",
    signature: "Generator winding temperature high for the load; power barely changes.",
  },
  {
    kind: "anemometer_gain",
    label: "Nacelle anemometer drift",
    signature: "The anemometer reads high: every other channel looks low against the measured wind.",
  },
];
const faultLabel = (k: FaultKind | null) => FAULTS.find((f) => f.kind === k)?.label ?? "—";

function healthTone(h: number) {
  return h >= 80 ? "bg-status-normal/20 text-status-normal" : h >= 50 ? "bg-status-warning/20 text-status-warning" : "bg-status-alarm/20 text-status-alarm";
}

export default function DiagnosisMission() {
  const [run, setRun] = useState<AnalyzeResponse | null>(null);
  const [seed, setSeed] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, FaultKind | null>>({});
  const [result, setResult] = useState<Scored | null>(null);
  const record = useAcademyStore((s) => s.record);

  const start = async () => {
    const s = newSeed();
    const scenario = pickOne(rng(s), SCENARIOS);
    setLoading(true);
    setError(null);
    setResult(null);
    setPicks({});
    try {
      setRun(await postAnalyze({ scenario, duration_days: DAYS, seed: s }));
      setSeed(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRun(null);
    } finally {
      setLoading(false);
    }
  };

  const truth: Finding[] = run?.validation.rows.map((r) => ({ turbine: r.turbine_name, kind: r.injected_kind })) ?? [];
  const submit = () => {
    if (!run) return;
    const findings: Finding[] = Object.entries(picks).map(([turbine, kind]) => ({ turbine, kind }));
    const r = scoreDiagnosis(truth, findings);
    setResult(r);
    record({
      mission: "twin-diagnosis",
      score: r.score,
      detail: `${run.title}: flagged ${findings.map((f) => f.turbine).join(", ") || "none"}`,
      seed: seed ?? undefined,
    });
  };

  if (!run) {
    return (
      <div className="space-y-3">
        <p className="text-[13px] text-text-secondary">
          The twin will run {DAYS} days of 10-minute SCADA data for the 34 turbines with a hidden scenario: one fault type, or none.
          You get the detection evidence; the diagnosis is yours.
        </p>
        <Button size="sm" onClick={() => void start()} disabled={loading}>
          <Play size={13} /> {loading ? "Running the twin…" : "Start a case"}
        </Button>
        {error && (
          <p role="alert" className="text-[12px] text-status-alarm">
            {error} — the Digital Twin backend is needed for this mission.
          </p>
        )}
      </div>
    );
  }

  const temps = run.ambient.temperature_c;
  const hum = run.ambient.humidity_pct;
  const rows = [...run.turbines].sort((a, b) => a.health_index - b.health_index);
  const shown = result !== null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-text-secondary">
        <span>
          Weather: {Math.min(...temps).toFixed(1)} to {Math.max(...temps).toFixed(1)} °C, mean humidity{" "}
          {(hum.reduce((a, b) => a + b, 0) / hum.length).toFixed(0)} %
        </span>
        <span>
          Alarm events: {run.events.filter((e) => e.level === "alarm").length}, alerts: {run.events.filter((e) => e.level === "alert").length}
        </span>
      </div>
      <details className="rounded-md border border-border-primary bg-bg-secondary px-2.5 py-1.5 text-[12px]">
        <summary className="cursor-pointer font-medium text-text-primary">Fault signatures</summary>
        <ul className="mt-1.5 space-y-1">
          {FAULTS.map((f) => (
            <li key={f.kind}>
              <span className="font-semibold text-text-primary">{f.label}: </span>
              <span className="text-text-secondary">{f.signature}</span>
            </li>
          ))}
        </ul>
      </details>
      <div className="max-h-[420px] overflow-auto rounded-md border border-border-primary">
        <table className="w-full min-w-[760px] text-[12px]">
          <thead className="sticky top-0 bg-bg-secondary text-xs text-text-muted">
            <tr>
              <th className="px-2 py-1 text-left font-medium">Turbine</th>
              <th className="px-1 py-1 text-right font-medium">Health</th>
              {CHANNELS.map((c) => (
                <th key={c.key} className="px-1 py-1 text-center font-medium" title={c.key.replace("_", " ")}>
                  {c.short}
                </th>
              ))}
              <th className="px-2 py-1 text-left font-medium">Events (channel, direction)</th>
              <th className="px-2 py-1 text-left font-medium">Your finding</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const ev = run.events.filter((e) => e.turbine_id === t.turbine_id);
              const kinds = [...new Set(ev.map((e) => `${e.channel.replace("_", " ")} ${e.direction === "high" ? "↑" : "↓"}${e.level === "alarm" ? "!" : ""}`))];
              const flagged = t.name in picks;
              const isTruth = truth.find((x) => x.turbine === t.name);
              return (
                <tr key={t.turbine_id} className={cn("border-t border-border-primary/60", shown && isTruth && "bg-status-alarm/10")}>
                  <td className="whitespace-nowrap px-2 py-1 font-medium text-text-primary">{t.name}</td>
                  <td className="px-1 py-1 text-right tabular-nums text-text-secondary">{t.health_index.toFixed(0)}</td>
                  {CHANNELS.map((c) => (
                    <td key={c.key} className="px-1 py-1 text-center">
                      <span className={cn("inline-block min-w-[2.2rem] rounded px-1 tabular-nums", healthTone(t.channel_health[c.key]))}>
                        {t.channel_health[c.key].toFixed(0)}
                      </span>
                    </td>
                  ))}
                  <td className="min-w-[10rem] px-2 py-1 text-xs text-text-secondary">{kinds.join(", ") || "—"}</td>
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        aria-label={`Flag ${t.name}`}
                        className="accent-accent"
                        checked={flagged}
                        disabled={shown}
                        onChange={(e) =>
                          setPicks((p) => {
                            const n = { ...p };
                            if (e.target.checked) n[t.name] = null;
                            else delete n[t.name];
                            return n;
                          })
                        }
                      />
                      <select
                        aria-label={`Fault on ${t.name}`}
                        disabled={!flagged || shown}
                        value={picks[t.name] ?? ""}
                        onChange={(e) => setPicks((p) => ({ ...p, [t.name]: (e.target.value || null) as FaultKind | null }))}
                        className="max-w-[11rem] rounded border border-border-primary bg-bg-tertiary px-1 py-0.5 text-xs disabled:opacity-40"
                      >
                        <option value="">fault type…</option>
                        {FAULTS.map((f) => (
                          <option key={f.kind} value={f.kind}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {shown && (isTruth || flagged) && (
                      <p className="mt-0.5 text-xs text-text-muted">
                        truth: {isTruth ? faultLabel(isTruth.kind) : "healthy"} · twin: {t.diagnosis?.label ?? "no diagnosis"}
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-text-muted">
        Channel health 0–100 per channel (P power, ω rotor speed, β pitch, T generator winding temperature, v anemometer); rows sorted by
        health. Events: ↑ / ↓ measured above / below the twin's expectation, ! alarm level.
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => void start()} disabled={loading}>
          <Play size={13} /> {loading ? "Running…" : "New case"}
        </Button>
        <Button size="sm" onClick={submit} disabled={shown}>
          <Send size={13} /> Submit diagnosis
        </Button>
      </div>
      {result && (
        <ScoreCard result={result}>
          <p className="text-[12px] text-text-secondary">
            Scenario: <span className="font-semibold text-text-primary">{run.title}</span>
            {truth.length ? ` — injected on ${truth.map((t) => t.turbine).join(", ")}.` : " — no fault was injected."} The twin itself
            detected {run.validation.detected} of {run.validation.injected} and isolated {run.validation.isolated}, with{" "}
            {run.validation.false_events} false event(s).
          </p>
        </ScoreCard>
      )}
      <WatchOut text="A single alert on one channel is often noise; a fault leaves a consistent pattern across channels that physics can explain. Flagging a healthy turbine sends a crew offshore for nothing." />
    </div>
  );
}
