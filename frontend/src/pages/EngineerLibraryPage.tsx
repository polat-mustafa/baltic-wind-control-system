/**
 * EngineerLibraryPage — route /library.
 *
 * Read-only library of educational primers covering offshore-wind topics
 * the Baltic Wind simulation does NOT implement directly but that any HV
 * control engineer must understand: foundation design, EIA, project
 * finance, NIS2, etc.
 *
 * Each card opens the same EducationPanel drawer used everywhere else in
 * the app, so the reading experience matches the dashboard primers byte
 * for byte.
 */

import { useMemo, useState } from "react";
import { BookOpen, GraduationCap } from "lucide-react";

import { EducationPanel } from "../components/ui/EducationPanel";
import { libraryEntries } from "../constants/education/library";
import { cn } from "../lib/utils";
import type { Discipline, EducationContent } from "../types/education";

// ── Discipline chip palette (matches reference type chips elsewhere) ──

const DISCIPLINE_STYLES: Record<Discipline, string> = {
  Civil: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Mechanical: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  Electrical: "bg-status-info/15 text-status-info border-status-info/30",
  Control: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  Software: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  Cyber: "bg-status-alarm/15 text-status-alarm border-status-alarm/30",
  Safety: "bg-status-warning/15 text-status-warning border-status-warning/30",
  Environment: "bg-status-normal/15 text-status-normal border-status-normal/30",
  Finance: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Operations: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  Marine: "bg-sky-500/15 text-sky-300 border-sky-500/30",
};

function DisciplineChip({ discipline }: { discipline?: Discipline }) {
  if (!discipline) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-medium uppercase tracking-wide",
        DISCIPLINE_STYLES[discipline],
      )}
    >
      {discipline}
    </span>
  );
}

// ── Card ───────────────────────────────────────────────────────

interface PrimerCardProps {
  entry: EducationContent;
  onOpen: (entry: EducationContent) => void;
}

function PrimerCard({ entry, onOpen }: PrimerCardProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      className={cn(
        "group relative flex h-full flex-col gap-3 rounded-lg border border-border-primary bg-bg-secondary",
        "p-4 text-left shadow-md shadow-black/20",
        "hover:border-accent/50 hover:bg-bg-hover hover:shadow-accent/5",
        "transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-accent",
      )}
    >
      {/* Header row: discipline + standard count */}
      <div className="flex items-center justify-between gap-2">
        <DisciplineChip discipline={entry.discipline} />
        <span className="text-[10px] font-mono text-text-muted">
          {entry.standards.length} std
          {entry.formulas.length > 0 ? ` · ${entry.formulas.length} fx` : ""}
        </span>
      </div>

      {/* Title + subtitle */}
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
          {entry.title}
        </h3>
        {entry.subtitle && (
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            {entry.subtitle}
          </p>
        )}
      </div>

      {/* Open hint */}
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-accent">
        <GraduationCap size={12} />
        <span>Open primer</span>
      </div>
    </button>
  );
}

// ── Page ───────────────────────────────────────────────────────

export default function EngineerLibraryPage() {
  const [openEntry, setOpenEntry] = useState<EducationContent | null>(null);

  // Stable count summary for the header strip
  const stats = useMemo(() => {
    const disciplines = new Set<Discipline>();
    let standards = 0;
    let formulas = 0;
    for (const entry of libraryEntries) {
      if (entry.discipline) disciplines.add(entry.discipline);
      standards += entry.standards.length;
      formulas += entry.formulas.length;
    }
    return {
      primers: libraryEntries.length,
      disciplines: disciplines.size,
      standards,
      formulas,
    };
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 h-9 w-9 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
            <BookOpen size={18} className="text-accent" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-text-primary">
              Engineer&apos;s Library
            </h2>
            <p className="text-xs text-text-muted mt-1 leading-relaxed max-w-2xl">
              Read-only primers on the offshore-wind topics the Baltic Wind
              simulation does not model directly — foundation design,
              insulation coordination, NIS2 cybersecurity, project finance and
              more. Same drawer, same depth as the dashboard primers; no
              backend, no inputs, just engineering reference material.
            </p>
          </div>
        </div>

        {/* Counters */}
        <div className="hidden md:flex items-center gap-4 shrink-0 text-xs">
          <Counter value={stats.primers} label="Primers" />
          <Counter value={stats.disciplines} label="Disciplines" />
          <Counter value={stats.standards} label="Standards" />
          <Counter value={stats.formulas} label="Formulas" />
        </div>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {libraryEntries.map((entry) => (
          <PrimerCard key={entry.id} entry={entry} onOpen={setOpenEntry} />
        ))}
      </div>

      {/* Drawer (single, shared across cards) */}
      {openEntry && (
        <EducationPanel
          content={openEntry}
          open={openEntry !== null}
          onOpenChange={(next) => {
            if (!next) setOpenEntry(null);
          }}
        />
      )}
    </div>
  );
}

// ── Header counter pill ────────────────────────────────────────

function Counter({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-base font-mono font-semibold text-text-primary">
        {value}
      </span>
      <span className="text-[10px] text-text-muted uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}
