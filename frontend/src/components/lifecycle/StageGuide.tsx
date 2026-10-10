/**
 * Teaching frame for the late lifecycle pages (Construction → Commissioning →
 * Hand-over → Operation → Decommissioning): where the stage sits in the farm's
 * life, the question it answers and its key facts, plus a numbered section
 * heading so each page reads as steps.
 */

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export type LifeStage = "build" | "commissioning" | "handover" | "operate" | "decom";

const STAGES: { id: LifeStage; label: string; path: string; span: string; what: string }[] = [
  { id: "build", label: "Construction", path: "/build", span: "≈ 2 years at sea", what: "Foundations, turbines, cables and substations installed" },
  { id: "commissioning", label: "Commissioning", path: "/commissioning", span: "months", what: "Each part tested, energised and proven against the grid code" },
  { id: "handover", label: "Hand-over", path: "/build/handover", span: "weeks", what: "Plant, documents and open items pass to the operator" },
  { id: "operate", label: "Operation", path: "/", span: "25–30 years", what: "Produce, monitor, maintain" },
  { id: "decom", label: "Decommissioning", path: "/decommission", span: "1–3 years", what: "Removed, recycled, seabed restored" },
];

interface Props {
  current: LifeStage;
  /** The one question this stage answers. */
  question: string;
  facts: { label: string; value: string }[];
  /** What happens, in order. */
  steps?: { title: string; text: string }[];
}

export function StageGuide({ current, question, facts, steps }: Props) {
  return (
    <section className="space-y-3 rounded-lg border border-border-primary bg-bg-secondary p-3" data-tour="stage-guide">
      <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-5" aria-label="Lifecycle of the farm">
        {STAGES.map((s, i) => {
          const here = s.id === current;
          return (
            <li key={s.id} className="relative min-w-0">
              <Link
                to={s.path}
                aria-current={here ? "step" : undefined}
                className={`block h-full rounded-md border px-2 py-1.5 text-[12px] transition-colors ${
                  here ? "border-accent bg-accent/15" : "border-border-primary hover:bg-bg-hover"
                }`}
              >
                <span className={`flex items-center gap-1 font-semibold ${here ? "text-accent" : "text-text-primary"}`}>
                  <span className="tabular-nums text-text-muted">{i + 1}</span> {s.label}
                </span>
                <span className="block text-[11px] text-text-muted">{s.span}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-text-secondary">{s.what}</span>
              </Link>
              {i < STAGES.length - 1 && (
                <ChevronRight size={12} className="absolute -right-[11px] top-1/2 hidden -translate-y-1/2 text-text-muted sm:block" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>

      <p className="text-sm text-text-primary">
        <span className="font-semibold">The question this stage answers: </span>
        {question}
      </p>

      <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {facts.map((f) => (
          <div key={f.label} className="rounded-md border border-border-primary/70 px-2.5 py-1.5">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{f.label}</dt>
            <dd className="text-[12px] text-text-primary">{f.value}</dd>
          </div>
        ))}
      </dl>

      {steps && (
        <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(0,1fr))]">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-md bg-bg-primary/60 px-2.5 py-1.5 text-[12px]">
              <span className="flex items-baseline gap-1.5 font-semibold text-text-primary">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-[11px] text-bg-primary">{i + 1}</span>
                {s.title}
              </span>
              <p className="mt-0.5 text-text-secondary">{s.text}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** "1 · Title" heading with a one-line explanation of why the section is there. */
export function StepHeading({ n, title, children }: { n: number; title: string; children?: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-accent text-[12px] text-accent">{n}</span>
        {title}
      </h2>
      {children && <p className="pl-8 text-[12px] text-text-secondary">{children}</p>}
    </div>
  );
}
