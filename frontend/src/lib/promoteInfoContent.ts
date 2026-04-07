/**
 * promoteInfoContent — adapter from legacy InfoContent → EducationContent.
 *
 * The old `InfoContent` type (components/ui/InfoButton.tsx) is shallow:
 * title, description, optional standard, parameters, interpretation.
 *
 * The new `EducationContent` is a strict superset. This adapter wraps a
 * legacy entry into an EducationContent shell so EducationButton can render
 * either type. This means dashboards that haven't been migrated to the new
 * deep authoring format keep working without code changes.
 *
 * Promoted entries deliberately have empty formulas / standards arrays —
 * they only fill the Overview tab and the Standard tab (if `standard` was
 * set). The "Maths" / "Real World" / "Code" tabs are omitted at render time.
 */

import type { InfoContent } from "../components/ui/InfoButton";
import type { EducationContent, Reference } from "../types/education";

/** Heuristic: classify a free-form standard string into a Reference type. */
function inferReferenceType(label: string): Reference["type"] {
  const lower = label.toLowerCase();
  if (
    lower.startsWith("iec ") ||
    lower.startsWith("iso ") ||
    lower.startsWith("ieee ") ||
    lower.startsWith("dnv") ||
    lower.startsWith("en ") ||
    lower.startsWith("bs ")
  ) {
    return "standard";
  }
  if (
    lower.includes("directive") ||
    lower.includes("regulation") ||
    lower.includes("nc rfg") ||
    lower.includes("iriesp") ||
    lower.includes("osha")
  ) {
    return "regulation";
  }
  if (lower.includes("doi") || lower.includes("et al")) return "paper";
  return "standard";
}

export function promoteInfoContent(
  info: InfoContent,
  idHint?: string,
): EducationContent {
  const standards: Reference[] = info.standard
    ? [{ label: info.standard, type: inferReferenceType(info.standard) }]
    : [];

  return {
    id: idHint ?? `legacy.${info.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    title: info.title,
    overview: info.description,
    simpleExplanation: info.description,
    technicalExplanation: info.interpretation ?? info.description,
    standards,
    formulas: [],
    workedExamples: [],
    realWorldCases: [],
    furtherReading: [],
    parameters: info.parameters,
    interpretation: info.interpretation,
  };
}

/** Type guard: discriminate the two shapes the EducationButton accepts. */
export function isEducationContent(
  value: EducationContent | InfoContent,
): value is EducationContent {
  return (
    typeof (value as EducationContent).id === "string" &&
    Array.isArray((value as EducationContent).formulas)
  );
}
