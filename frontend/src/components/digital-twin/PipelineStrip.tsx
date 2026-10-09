/**
 * ISO 13374-1 processing blocks with what this run produced in each.
 */

import { ChevronRight } from "lucide-react";

import { useDigitalTwinStore } from "../../store/digitalTwinStore";

export default function PipelineStrip() {
  const analysis = useDigitalTwinStore((s) => s.analysis);
  if (!analysis) return null;

  const prognoses = analysis.turbines.filter((t) => t.prognosis?.status === "trend").length;
  const advisories = analysis.turbines.filter((t) => t.diagnosis?.advisory).length;
  const blocks = [
    {
      code: "DA",
      name: "Data acquisition",
      value: `${(analysis.num_samples * analysis.turbines.length).toLocaleString("en-GB")}`,
      unit: "10-min records",
    },
    { code: "DM", name: "Data manipulation", value: "5", unit: "residuals / turbine" },
    { code: "SD", name: "State detection", value: `${analysis.farm.total_events}`, unit: "EWMA events" },
    { code: "HA", name: "Health assessment", value: `${analysis.farm.diagnosed_count}`, unit: "faults identified" },
    { code: "PA", name: "Prognostics", value: `${prognoses}`, unit: "RUL estimates" },
    { code: "AG", name: "Advisory", value: `${advisories}`, unit: "actions issued" },
  ];

  return (
    <div className="rounded-lg border border-border-primary bg-bg-secondary px-3 py-2.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
          ISO 13374-1 processing chain
        </span>
        <span className="text-xs text-text-muted font-mono">
          {analysis.title} · {analysis.duration_days} d · seed {analysis.seed}
        </span>
      </div>
      <ol className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
        {blocks.map((b, i) => (
          <li key={b.code} className="relative flex items-center gap-2 rounded-md bg-bg-tertiary/60 px-2.5 py-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border-secondary font-mono text-xs font-semibold text-text-primary">
              {b.code}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs text-text-secondary">{b.name}</span>
              <span className="block truncate text-xs">
                <span className="font-mono font-semibold tabular-nums text-text-primary">{b.value}</span>{" "}
                <span className="text-text-muted">{b.unit}</span>
              </span>
            </span>
            {i < blocks.length - 1 && (
              <ChevronRight
                size={14}
                className="absolute -right-2.5 top-1/2 -translate-y-1/2 text-text-muted hidden xl:block"
                aria-hidden
              />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
