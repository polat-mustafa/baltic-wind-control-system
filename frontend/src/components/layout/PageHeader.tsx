/**
 * The one page header every page uses (style board, Components):
 * title, a plain-language line, the key facts as small mono chips, and the
 * page's actions on the right — primary action last.
 *
 *   <PageHeader
 *     title="HV Grid Integration"
 *     description="Load flow, short circuit, FRT and STATCOM sizing for the export system."
 *     meta="SB-510 · 510 MW · 66/220/400 kV · 2 × 108 km export"
 *     actions={<Button>Re-run</Button>}
 *   />
 */

import type { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  /** One or two plain sentences on what the page is for. */
  description?: ReactNode;
  /** Key facts, " · "-separated; each becomes a chip. */
  meta?: string;
  /** Buttons on the right; put the primary action last. */
  actions?: ReactNode;
  /** An extra row under the facts (design-rationale links, notes). */
  children?: ReactNode;
}

export function PageHeader({ title, description, meta, actions, children }: PageHeaderProps) {
  const chips = meta ? meta.split(" · ").filter(Boolean) : [];
  return (
    <header
      data-tour="page-header"
      className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-border-primary pb-4"
    >
      <div className="min-w-0 max-w-4xl">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{title}</h1>
        {description && <p className="mt-1 text-sm leading-relaxed text-text-secondary">{description}</p>}
        {chips.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Key facts">
            {chips.map((c) => (
              <li
                key={c}
                className="rounded border border-border-primary px-2 py-0.5 font-mono text-xs text-text-muted"
              >
                {c}
              </li>
            ))}
          </ul>
        )}
        {children && <div className="mt-2.5">{children}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
