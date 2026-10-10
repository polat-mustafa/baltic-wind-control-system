/**
 * Formulas on paper: a ruled notebook sheet, ink colour and a legible handwriting
 * face (Playpen Sans — it carries every Greek letter and maths symbol the formulas
 * use, so nothing falls back to another font mid-formula).
 *
 * Formulas are written in plain text in the content files (`P_max`, `(1+r)^−n`,
 * `S_i^Sobol`); formatMath() turns `_x` into a subscript and `^x` into a superscript
 * so they read like maths, not like code. Expressions, symbols, units and sources
 * stay as written (translate="no"); prose is translated.
 */

import { formatMath } from "../../lib/formatMath";
import { useTranslate } from "../../lib/i18n";
import { cn } from "../../lib/utils";
import type { Formula, WorkedExample } from "../../types/education";

/** Maths in handwriting, never touched by the DOM translator. */
export function MathText({ text, className }: { text: string; className?: string }) {
  return (
    <span translate="no" className={cn("math-hand", className)}>
      {formatMath(text)}
    </span>
  );
}

/** One formula on a paper sheet: expression, symbols, explanation, source. */
export function FormulaPaper({ formula, compact = false }: { formula: Formula; compact?: boolean }) {
  return (
    <figure className="math-paper">
      <div className={cn("math-hand break-words text-center", compact ? "text-lg" : "text-xl")} translate="no">
        {formatMath(formula.expression)}
      </div>
      {formula.variables.length > 0 && (
        <dl className="mt-1 grid grid-cols-[auto_1fr_auto] items-baseline gap-x-3 text-sm">
          {formula.variables.map((v) => (
            <div key={`${v.symbol}-${v.name}`} className="contents">
              <dt className="math-hand text-base" translate="no">
                {formatMath(v.symbol)}
              </dt>
              <dd className="math-paper-note leading-7">{v.name}</dd>
              <dd className="math-hand text-right text-sm" translate="no">
                {formatMath(v.unit)}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {formula.explanation && <figcaption className="math-paper-note mt-2 leading-relaxed">{formula.explanation}</figcaption>}
      {formula.reference && (
        <p className="math-paper-source mt-1.5" translate="no">
          {formula.reference}
        </p>
      )}
    </figure>
  );
}

/** A worked example on paper: scenario, numbered steps in handwriting, result. */
export function WorkedExamplePaper({ example }: { example: WorkedExample }) {
  // Steps mix words and maths: translated here, then formatted (the DOM translator
  // cannot see across the <sub>/<sup> splits).
  const t = useTranslate();
  return (
    <figure className="math-paper">
      <h5 className="math-paper-title">{example.title}</h5>
      <p className="math-paper-note mt-1 italic leading-relaxed">{example.scenario}</p>
      <ol className="mt-2 space-y-1">
        {example.steps.map((step, i) => (
          <li key={i} className="grid grid-cols-[1.5rem_1fr] gap-1">
            <span className="math-hand text-right">{i + 1}.</span>
            <MathText text={t(step)} className="text-base leading-7" />
          </li>
        ))}
      </ol>
      <div className="math-paper-result mt-2">
        <span className="math-paper-label">Result</span>
        <MathText text={t(example.result)} className="block text-base leading-7" />
      </div>
    </figure>
  );
}
