/**
 * Small building blocks of the compact engineering-study panels (earth fault, route
 * rating, converter stability, EMT energisation, support structure, O&M replay):
 * a headline number, a pass/fail check, a verdict badge, the method / assumptions
 * note and the error line.
 *
 * Numbers and units sit in their own translate="no" span, so the UI translator only
 * sees the static label text (src/lib/i18n). Method and assumption text comes from
 * the backend as written (citations, standard ids) and is kept in English.
 */

import type { ReactNode } from "react";

import { cn } from "../../lib/utils";
import { Badge } from "./Badge";

/** One headline number with its unit and an optional muted line under it. */
export function Stat({ label, value, unit, sub, tone }: { label: string; value: string; unit?: string; sub?: ReactNode; tone?: "ok" | "bad" }) {
  return (
    <div className="rounded-md border border-border-primary bg-bg-primary/40 px-3 py-2">
      <p className="text-xs text-text-muted">{label}</p>
      <p
        translate="no"
        className={cn("font-mono text-lg leading-tight", tone === "ok" ? "text-status-normal" : tone === "bad" ? "text-status-alarm" : "text-text-primary")}
      >
        {value}
        {unit && <span className="ml-1 text-xs text-text-secondary">{unit}</span>}
      </p>
      {sub && <p className="text-xs text-text-muted">{sub}</p>}
    </div>
  );
}

/** "label value" where only the label is translated (sub-lines of a Stat). */
export function LabelValue({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span>{label}</span> <span translate="no" className="font-mono">{value}</span>
    </>
  );
}

/** ✓ / ✗ line of a verdict list. */
export function Check({ pass, children }: { pass: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-1.5">
      <span aria-label={pass ? "pass" : "fail"} className={pass ? "text-status-normal" : "text-status-alarm"}>
        {pass ? "✓" : "✗"}
      </span>
      <span>{children}</span>
    </li>
  );
}

/** Verdict of a study: green when it holds, red when it does not. */
export function Verdict({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <Badge variant={ok ? "normal" : "alarm"} className="normal-case tracking-normal">
      {ok ? yes : no}
    </Badge>
  );
}

/** Method / assumptions the API returns, as small muted text. */
export function StudyNote({ label = "Method:", items }: { label?: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="text-xs text-text-muted">
      <span className="font-medium">{label}</span>{" "}
      {items.length === 1 ? (
        <span translate="no">{items[0]}</span>
      ) : (
        <ul translate="no" className="mt-0.5 list-disc space-y-0.5 pl-4">
          {items.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The backend could not answer: keep the panel's place and say why. */
export function StudyError({ error }: { error: string }) {
  return (
    <p role="alert" className="text-xs text-status-alarm">
      <span>Study unavailable:</span> <span>{error}</span>
    </p>
  );
}

/** Running indicator next to a panel's controls. */
export function StudyLoading({ children = "computing…" }: { children?: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-text-muted" aria-live="polite">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />
      {children}
    </span>
  );
}
