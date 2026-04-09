/**
 * EducationPanel — right-edge slide-out drawer with rich, multi-tab
 * educational content for any dashboard component.
 *
 * Five tabs:
 *   1. Overview      — overview, simple, technical
 *   2. Maths         — formulas (mono expression + variable table) + worked examples
 *   3. Standards     — standards list with type chips and external links
 *   4. Real World    — real-world case cards + further reading
 *   5. Code          — repo file references + linked lessons
 *
 * Accepts either an EducationContent (rich) or a legacy InfoContent (shallow,
 * auto-promoted via promoteInfoContent). Tabs whose content is empty render a
 * short hint instead of being hidden, so the layout stays consistent.
 *
 * Built on Radix Dialog (drawer) + Radix Tabs, matching ControlDrawer.tsx for
 * visual consistency. Uses ISA-101 dark theme tokens already defined in the
 * project's Tailwind config.
 */

import { type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import {
  GraduationCap,
  X,
  ExternalLink,
  BookOpen,
  Sigma,
  ScrollText,
  Globe,
  Code2,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type {
  EducationContent,
  Formula,
  Reference,
  WorkedExample,
  RealWorldCase,
  CodeReference,
} from "../../types/education";
import type { InfoContent } from "./InfoButton";
import { promoteInfoContent, isEducationContent } from "../../lib/promoteInfoContent";

// ── Tab definitions ────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "maths", label: "Maths", icon: Sigma },
  { id: "standards", label: "Standards", icon: ScrollText },
  { id: "real-world", label: "Real World", icon: Globe },
  { id: "code", label: "Code", icon: Code2 },
] as const;

// ── Subsection helpers ─────────────────────────────────────────

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">
      {children}
    </h4>
  );
}

function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border-primary px-4 py-6 text-center">
      <p className="text-xs text-text-muted leading-relaxed">{children}</p>
    </div>
  );
}

function ReferenceTypeChip({ type }: { type: Reference["type"] }) {
  const styles: Record<Reference["type"], string> = {
    standard: "bg-status-info/15 text-status-info border-status-info/30",
    paper: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    textbook: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    regulation: "bg-status-alarm/15 text-status-alarm border-status-alarm/30",
    website: "bg-status-normal/15 text-status-normal border-status-normal/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5",
        "text-[9px] font-medium uppercase tracking-wider",
        styles[type],
      )}
    >
      {type}
    </span>
  );
}

function ReferenceRow({ refItem }: { refItem: Reference }) {
  const inner = (
    <>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-text-secondary group-hover:text-text-primary leading-snug">
            {refItem.label}
          </span>
          <ReferenceTypeChip type={refItem.type} />
        </div>
        {refItem.citation && (
          <p className="mt-1 text-[11px] text-text-muted italic">
            {refItem.citation}
          </p>
        )}
      </div>
      {refItem.url && (
        <ExternalLink
          size={12}
          className="mt-1 shrink-0 text-text-muted group-hover:text-accent transition-colors"
        />
      )}
    </>
  );

  if (refItem.url) {
    return (
      <a
        href={refItem.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-start gap-2 rounded-md px-3 py-2 hover:bg-bg-hover transition-colors"
      >
        {inner}
      </a>
    );
  }
  return (
    <div className="group flex items-start gap-2 rounded-md px-3 py-2">
      {inner}
    </div>
  );
}

// ── Tab content blocks ─────────────────────────────────────────

function OverviewTab({ c }: { c: EducationContent }) {
  return (
    <div className="space-y-5">
      <div>
        <SectionLabel>Overview</SectionLabel>
        <p className="text-sm text-text-secondary leading-relaxed">{c.overview}</p>
      </div>

      {c.parameters && c.parameters.length > 0 && (
        <div>
          <SectionLabel>Key Parameters</SectionLabel>
          <div className="space-y-1.5">
            {c.parameters.map((p) => (
              <div
                key={p.name}
                className="flex items-start gap-2 text-sm"
              >
                <span className="font-mono text-accent shrink-0">{p.name}</span>
                <span className="text-text-muted">—</span>
                <span className="text-text-secondary">{p.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-md border border-status-info/20 bg-status-info/5 px-4 py-3">
        <SectionLabel>Explain Simply</SectionLabel>
        <p className="text-sm text-text-secondary leading-relaxed">
          {c.simpleExplanation}
        </p>
      </div>

      <div className="rounded-md border border-accent/20 bg-accent/5 px-4 py-3">
        <SectionLabel>Explain Technically</SectionLabel>
        <p className="text-sm text-text-secondary leading-relaxed">
          {c.technicalExplanation}
        </p>
      </div>

      {c.interpretation && (
        <div>
          <SectionLabel>How to Read</SectionLabel>
          <p className="text-sm text-text-secondary leading-relaxed">
            {c.interpretation}
          </p>
        </div>
      )}
    </div>
  );
}

function FormulaCard({ formula }: { formula: Formula }) {
  return (
    <div className="rounded-md border border-border-primary bg-bg-tertiary p-4 space-y-3">
      <div className="rounded-sm bg-black/30 border border-border-primary px-3 py-2 font-mono text-sm text-accent break-words">
        {formula.expression}
      </div>

      {formula.variables.length > 0 && (
        <div className="space-y-1">
          {formula.variables.map((v) => (
            <div
              key={`${v.symbol}-${v.name}`}
              className="grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-2 text-xs"
            >
              <span className="font-mono text-accent">{v.symbol}</span>
              <span className="text-text-secondary">{v.name}</span>
              <span className="text-text-muted font-mono">{v.unit}</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-text-secondary leading-relaxed">
        {formula.explanation}
      </p>

      {formula.reference && (
        <p className="text-[10px] text-text-muted font-mono">
          Source: {formula.reference}
        </p>
      )}
    </div>
  );
}

function WorkedExampleCard({ example }: { example: WorkedExample }) {
  return (
    <div className="rounded-md border border-border-primary bg-bg-tertiary p-4 space-y-3">
      <h5 className="text-sm font-semibold text-text-primary">{example.title}</h5>
      <p className="text-xs text-text-secondary leading-relaxed italic">
        {example.scenario}
      </p>
      <ol className="space-y-1.5">
        {example.steps.map((step, idx) => (
          <li
            key={idx}
            className="grid grid-cols-[1.25rem_1fr] gap-2 text-xs text-text-secondary"
          >
            <span className="font-mono text-text-muted">{idx + 1}.</span>
            <span className="font-mono leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>
      <div className="rounded-sm border border-status-normal/30 bg-status-normal/10 px-3 py-2">
        <span className="text-[10px] font-semibold text-status-normal uppercase tracking-wider">
          Result
        </span>
        <p className="text-xs text-text-secondary mt-1 leading-relaxed">
          {example.result}
        </p>
      </div>
    </div>
  );
}

function MathsTab({ c }: { c: EducationContent }) {
  if (c.formulas.length === 0 && c.workedExamples.length === 0) {
    return (
      <EmptyHint>
        No formulas catalogued for this component yet. Open Standards or Real
        World for related references.
      </EmptyHint>
    );
  }
  return (
    <div className="space-y-5">
      {c.formulas.length > 0 && (
        <div>
          <SectionLabel>Formulas</SectionLabel>
          <div className="space-y-3">
            {c.formulas.map((f, idx) => (
              <FormulaCard key={idx} formula={f} />
            ))}
          </div>
        </div>
      )}

      {c.workedExamples.length > 0 && (
        <div>
          <SectionLabel>Worked Examples</SectionLabel>
          <div className="space-y-3">
            {c.workedExamples.map((e, idx) => (
              <WorkedExampleCard key={idx} example={e} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StandardsTab({ c }: { c: EducationContent }) {
  if (c.standards.length === 0) {
    return (
      <EmptyHint>No standards have been linked to this component yet.</EmptyHint>
    );
  }
  return (
    <div className="space-y-1">
      {c.standards.map((r, idx) => (
        <ReferenceRow key={idx} refItem={r} />
      ))}
    </div>
  );
}

function RealWorldCard({ rwc }: { rwc: RealWorldCase }) {
  return (
    <div className="rounded-md border border-border-primary bg-bg-tertiary p-4 space-y-2">
      <h5 className="text-sm font-semibold text-text-primary">{rwc.title}</h5>
      <p className="text-xs text-text-secondary leading-relaxed">
        {rwc.description}
      </p>
      <div className="rounded-sm border-l-2 border-accent/60 bg-accent/5 px-3 py-2">
        <span className="text-[10px] font-semibold text-accent uppercase tracking-wider">
          Takeaway
        </span>
        <p className="text-xs text-text-secondary mt-1 leading-relaxed">
          {rwc.takeaway}
        </p>
      </div>
      {rwc.source && (
        <p className="text-[10px] text-text-muted font-mono">
          Source: {rwc.source}
        </p>
      )}
    </div>
  );
}

function RealWorldTab({ c }: { c: EducationContent }) {
  if (c.realWorldCases.length === 0 && c.furtherReading.length === 0) {
    return (
      <EmptyHint>
        No real-world cases or further reading have been catalogued yet.
      </EmptyHint>
    );
  }
  return (
    <div className="space-y-5">
      {c.realWorldCases.length > 0 && (
        <div>
          <SectionLabel>Real-World Cases</SectionLabel>
          <div className="space-y-3">
            {c.realWorldCases.map((rwc, idx) => (
              <RealWorldCard key={idx} rwc={rwc} />
            ))}
          </div>
        </div>
      )}

      {c.furtherReading.length > 0 && (
        <div>
          <SectionLabel>Further Reading</SectionLabel>
          <div className="space-y-1">
            {c.furtherReading.map((r, idx) => (
              <ReferenceRow key={idx} refItem={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CodeReferenceCard({ codeRef }: { codeRef: CodeReference }) {
  return (
    <div className="rounded-md border border-border-primary bg-bg-tertiary p-3 space-y-1">
      <p className="font-mono text-xs text-accent break-all">{codeRef.file}</p>
      <p className="text-xs text-text-secondary leading-relaxed">
        {codeRef.description}
      </p>
    </div>
  );
}

function CodeTab({ c }: { c: EducationContent }) {
  const hasCode = c.codeReferences && c.codeReferences.length > 0;
  const hasLessons = c.relatedLessons && c.relatedLessons.length > 0;
  if (!hasCode && !hasLessons) {
    return (
      <EmptyHint>
        No source files or lessons linked. (Engineer's Library primers
        intentionally omit code references.)
      </EmptyHint>
    );
  }
  return (
    <div className="space-y-5">
      {hasCode && (
        <div>
          <SectionLabel>Source Files</SectionLabel>
          <div className="space-y-2">
            {c.codeReferences!.map((cr, idx) => (
              <CodeReferenceCard key={idx} codeRef={cr} />
            ))}
          </div>
        </div>
      )}

      {hasLessons && (
        <div>
          <SectionLabel>Related Lessons</SectionLabel>
          <div className="space-y-1">
            {c.relatedLessons!.map((lesson) => (
              <a
                key={lesson}
                href={`https://polat-mustafa.github.io/baltic-wind-control-system/en/lessons/${lesson}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-bg-hover transition-colors group"
              >
                <BookOpen size={14} className="text-text-muted shrink-0" />
                <span className="text-sm text-text-secondary group-hover:text-text-primary">
                  {lesson}
                </span>
                <ExternalLink
                  size={12}
                  className="ml-auto text-text-muted group-hover:text-accent"
                />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────

interface EducationPanelProps {
  /** Either rich EducationContent or a legacy InfoContent (auto-promoted). */
  content: EducationContent | InfoContent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EducationPanel({
  content,
  open,
  onOpenChange,
}: EducationPanelProps) {
  const ec: EducationContent = isEducationContent(content)
    ? content
    : promoteInfoContent(content);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-[2000] bg-black/40 backdrop-blur-[2px]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <Dialog.Content
          className={cn(
            "fixed right-0 top-0 z-[2100] h-full w-[min(40rem,100vw)]",
            "border-l border-border-secondary bg-bg-secondary shadow-2xl shadow-black/50",
            "flex flex-col focus:outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
            "duration-300",
          )}
        >
          {/* Header */}
          <div className="shrink-0 px-6 pt-5 pb-4 border-b border-border-primary">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-9 w-9 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center">
                  <GraduationCap size={18} className="text-accent" />
                </div>
                <div className="min-w-0">
                  <Dialog.Title className="text-base font-semibold text-text-primary">
                    {ec.title}
                  </Dialog.Title>
                  {ec.subtitle && (
                    <Dialog.Description className="text-xs text-text-muted mt-0.5">
                      {ec.subtitle}
                    </Dialog.Description>
                  )}
                </div>
              </div>
              <Dialog.Close asChild>
                <button
                  className="rounded-md p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Tabs */}
          <Tabs.Root
            defaultValue="overview"
            className="flex-1 flex flex-col min-h-0"
          >
            <Tabs.List className="shrink-0 flex border-b border-border-primary px-2">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <Tabs.Trigger
                    key={tab.id}
                    value={tab.id}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium",
                      "text-text-muted hover:text-text-secondary",
                      "border-b-2 border-transparent",
                      "data-[state=active]:text-accent data-[state=active]:border-accent",
                      "transition-colors duration-150",
                    )}
                  >
                    <Icon size={13} />
                    {tab.label}
                  </Tabs.Trigger>
                );
              })}
            </Tabs.List>

            <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
              <Tabs.Content value="overview">
                <OverviewTab c={ec} />
              </Tabs.Content>
              <Tabs.Content value="maths">
                <MathsTab c={ec} />
              </Tabs.Content>
              <Tabs.Content value="standards">
                <StandardsTab c={ec} />
              </Tabs.Content>
              <Tabs.Content value="real-world">
                <RealWorldTab c={ec} />
              </Tabs.Content>
              <Tabs.Content value="code">
                <CodeTab c={ec} />
              </Tabs.Content>
            </div>
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
