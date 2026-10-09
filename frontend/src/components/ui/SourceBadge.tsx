/**
 * Provenance of a number: where it comes from and how much to trust it.
 *
 *   official      — a standard, regulator or official dataset (IEC, PSE, EMODnet)
 *   measured      — a measurement or an atlas built from measurements (NEWA, ERA5)
 *   literature    — a published report, paper or manufacturer datasheet
 *   approximation — derived from a source, or a typical value that differs from it
 *   illustrative  — a teaching assumption with no source; replace it with your own
 *
 * The badge is a native <details>: it opens on click / tap / keyboard and needs no
 * hover, so it works at 390 px.
 */

import { cn } from "../../lib/utils";

export type Quality = "official" | "measured" | "literature" | "approximation" | "illustrative";

export interface Provenance {
  source: string;
  license?: string;
  /** ISO date the source was read. */
  retrieved?: string;
  quality: Quality;
  /** How the value was derived from the source. */
  note?: string;
}

export interface Sourced extends Provenance {
  value: number;
  unit: string;
}

const TONE: Record<Quality, string> = {
  official: "border-status-normal/40 bg-status-normal/10 text-status-normal",
  measured: "border-status-info/40 bg-status-info/10 text-status-info",
  literature: "border-status-info/40 bg-status-info/10 text-status-info",
  approximation: "border-status-warning/40 bg-status-warning/10 text-status-warning",
  illustrative: "border-border-primary bg-bg-elevated text-text-muted",
};

export function SourceBadge({ p, className }: { p: Provenance; className?: string }) {
  return (
    <details className={cn("group inline-block align-middle text-xs leading-tight", className)}>
      <summary
        className={cn(
          "inline-block cursor-pointer list-none rounded border px-1 py-px font-medium [&::-webkit-details-marker]:hidden",
          TONE[p.quality],
        )}
        title={p.source}
      >
        {p.quality}
      </summary>
      <span className="mt-1 block max-w-64 rounded border border-border-primary bg-bg-elevated p-1.5 font-normal text-text-secondary">
        {p.source}
        {p.note && <span className="mt-0.5 block text-text-muted">{p.note}</span>}
        {(p.license || p.retrieved) && (
          <span className="mt-0.5 block text-text-muted">
            {[p.license, p.retrieved && `read ${p.retrieved}`].filter(Boolean).join(" · ")}
          </span>
        )}
      </span>
    </details>
  );
}
