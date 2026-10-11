/**
 * "Key terms" row: the glossary terms a text uses, each a chip whose tooltip gives the
 * one-line definition (constants/glossary.ts). Chips are buttons so the definition also
 * opens on keyboard focus.
 */

import { termsIn } from "../../constants/glossary";
import { Tooltip } from "./Tooltip";

export function KeyTerms({ texts }: { texts: (string | undefined)[] }) {
  const terms = termsIn(...texts);
  if (!terms.length) return null;
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Key terms</h4>
      <ul className="flex flex-wrap gap-1.5" aria-label="Key terms">
        {terms.map((t) => (
          <li key={t.term}>
            <Tooltip content={t.definition}>
              <button
                type="button"
                className="rounded border border-border-secondary px-2 py-0.5 text-xs text-text-secondary hover:border-accent hover:text-text-primary"
              >
                {t.term}
              </button>
            </Tooltip>
          </li>
        ))}
      </ul>
    </div>
  );
}
