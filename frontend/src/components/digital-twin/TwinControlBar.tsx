/**
 * Run controls: fault scenario, analysis window, seed — and what the scenario injects.
 */

import { Play, RotateCw } from "lucide-react";

import { useDigitalTwinStore } from "../../store/digitalTwinStore";
import type { ScenarioName } from "../../services/digitalTwinApi";
import { Button } from "../ui/Button";
import { DURATIONS, SCENARIO_ORDER, SCENARIO_TITLE, formatSeverity } from "./twinFormat";

export default function TwinControlBar() {
  const scenario = useDigitalTwinStore((s) => s.scenario);
  const durationDays = useDigitalTwinStore((s) => s.durationDays);
  const seed = useDigitalTwinStore((s) => s.seed);
  const loading = useDigitalTwinStore((s) => s.loading);
  const analysis = useDigitalTwinStore((s) => s.analysis);
  const modelCard = useDigitalTwinStore((s) => s.modelCard);
  const setScenario = useDigitalTwinStore((s) => s.setScenario);
  const setDurationDays = useDigitalTwinStore((s) => s.setDurationDays);
  const setSeed = useDigitalTwinStore((s) => s.setSeed);
  const runAnalysis = useDigitalTwinStore((s) => s.runAnalysis);

  const info = modelCard?.scenarios.find((s) => s.name === scenario);
  const stale =
    analysis != null &&
    (analysis.scenario !== scenario ||
      analysis.duration_days !== durationDays ||
      analysis.seed !== seed);

  return (
    <div
      className="rounded-lg border border-border-primary bg-bg-secondary p-3 space-y-2.5"
      data-tour="twin-controls"
    >
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <label className="flex flex-col gap-1 min-w-[12rem] flex-1 sm:flex-none">
          <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
            Fault scenario
          </span>
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value as ScenarioName)}
            className="bg-bg-tertiary border border-border-secondary rounded-md px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {SCENARIO_ORDER.map((s) => (
              <option key={s} value={s}>
                {SCENARIO_TITLE[s]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
            Window
          </span>
          <div
            role="radiogroup"
            aria-label="Analysis window"
            className="flex rounded-md border border-border-secondary overflow-hidden"
          >
            {DURATIONS.map((d) => (
              <button
                key={d}
                role="radio"
                aria-checked={durationDays === d}
                onClick={() => setDurationDays(d)}
                className={`px-2.5 py-1.5 text-xs font-mono tabular-nums transition-colors ${
                  durationDays === d
                    ? "bg-accent text-white"
                    : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
                }`}
              >
                {d} d
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1 w-24">
          <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
            Seed
          </span>
          <input
            type="number"
            min={0}
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            className="bg-bg-tertiary border border-border-secondary rounded-md px-2 py-1.5 text-sm font-mono text-right text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </label>

        <Button onClick={runAnalysis} disabled={loading} size="sm" className="h-[34px] px-4">
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Running twin…
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              {analysis ? <RotateCw size={14} /> : <Play size={14} />}
              {analysis ? (stale ? "Run new case" : "Re-run") : "Run twin"}
            </span>
          )}
        </Button>
        {stale && !loading && (
          <span className="text-[11px] text-status-warning">
            Settings changed — results show the previous run.
          </span>
        )}
      </div>

      {info && (
        <div className="text-xs text-text-secondary leading-relaxed">
          <p>{info.description}</p>
          {info.injections.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {info.injections.flatMap((inj) =>
                inj.turbines.map((t, i) => (
                  <li
                    key={`${inj.kind}-${t}`}
                    className="rounded border border-border-secondary bg-bg-tertiary px-1.5 py-0.5 font-mono text-[10px] text-text-secondary"
                  >
                    {t} · {formatSeverity(inj.kind, inj.severity[i])} · from{" "}
                    {Math.round(inj.onset_fraction * 100)} %
                  </li>
                )),
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
