/**
 * EducationContent — canonical schema for the educational layer.
 *
 * Used by EducationButton + EducationPanel to render rich, multi-tab
 * explanations of every dashboard component (formulas, standards, worked
 * examples, real-world cases, code references, related lessons).
 *
 * Strict superset of the legacy InfoContent in components/ui/InfoButton.tsx —
 * promoteInfoContent.ts adapts old entries on the fly so non-P1 dashboards
 * keep working without code changes.
 *
 * Authoring template: see frontend/src/constants/education/p1/weibull.ts.
 */

// ── Atomic primitives ───────────────────────────────────────────

export interface FormulaVariable {
  symbol: string;
  name: string;
  unit: string;
}

export interface Formula {
  /** Human-readable expression, e.g. "P = ½·ρ·A·V³·Cp(λ,β)" */
  expression: string;
  variables: FormulaVariable[];
  /** Why this formula matters and how to read it */
  explanation: string;
  /** Optional source reference, e.g. "IEC 61400-1 §5.2.3" */
  reference?: string;
}

export type ReferenceType =
  | "standard"
  | "paper"
  | "textbook"
  | "regulation"
  | "website";

export interface Reference {
  /** Display label, e.g. "IEC 61400-1 — Wind turbines: Design requirements" */
  label: string;
  type: ReferenceType;
  /** Optional external URL */
  url?: string;
  /** Optional formal citation (authors, year, DOI, etc.) */
  citation?: string;
}

export interface WorkedExample {
  title: string;
  /** Setup paragraph: site, parameters, conditions */
  scenario: string;
  /** Numbered calculation steps with numbers + units */
  steps: string[];
  /** Final answer with engineering interpretation */
  result: string;
}

export interface RealWorldCase {
  /** e.g. "Hornsea 2 (UK, 1.32 GW)" */
  title: string;
  /** 1-3 sentence context */
  description: string;
  /** What the student should learn from this case */
  takeaway: string;
  /** Optional attribution */
  source?: string;
}

export interface CodeReference {
  /** Repo-relative path, e.g. "backend/app/services/p1/aep_calculator.py" */
  file: string;
  /** What this file does and why it matters */
  description: string;
}

export type Discipline =
  | "Civil"
  | "Mechanical"
  | "Electrical"
  | "Control"
  | "Software"
  | "Cyber"
  | "Safety"
  | "Environment"
  | "Finance"
  | "Operations"
  | "Marine";

// ── Top-level content ──────────────────────────────────────────

export interface EducationContent {
  /** Stable identifier, e.g. "p1.weibull" or "library.foundation-design" */
  id: string;
  title: string;
  /** Optional one-line context shown under the title */
  subtitle?: string;
  /** Optional discipline tag (used by the Engineer's Library cards) */
  discipline?: Discipline;

  // ── Layer 1: Physics / what it is ────────────────────────────
  /** 2-4 sentences for any reader */
  overview: string;
  /** Plain-English paragraph for non-engineers */
  simpleExplanation: string;
  /** Technical paragraph fit for an interview answer */
  technicalExplanation: string;

  // ── Layer 2: Standards ───────────────────────────────────────
  standards: Reference[];

  // ── Layer 3: Maths ───────────────────────────────────────────
  formulas: Formula[];
  workedExamples: WorkedExample[];

  // ── Layer 4: Code (optional) ─────────────────────────────────
  codeReferences?: CodeReference[];

  // ── Real world & further reading ─────────────────────────────
  realWorldCases: RealWorldCase[];
  furtherReading: Reference[];
  /** Lesson IDs in docs/lessons/, e.g. ["lesson-004", "lesson-005"] */
  relatedLessons?: string[];

  // ── Backwards-compat passthrough (from legacy InfoContent) ───
  parameters?: { name: string; description: string }[];
  interpretation?: string;
}
