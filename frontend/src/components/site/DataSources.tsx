/**
 * Where the screening data come from (layer source, licence, retrieval
 * date — all from /api/v1/site/layers) and the standing reminder that a
 * screening is not a permit check.
 */

import { Database, ExternalLink, Scale } from "lucide-react";

import { useSiteStore } from "../../store/siteStore";

/** Official sources to verify a screening against (checked 2026-10-06). */
const OFFICIAL_LINKS = [
  { label: "SIPAM — maritime spatial plan geoportal", href: "https://sipam.gov.pl/" },
  { label: "Plan regulation, Dz.U. 2021 poz. 935", href: "https://eli.gov.pl/eli/DU/2021/935/ogl" },
];

export function ScreeningDisclaimer() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/10 px-3 py-2 text-[12px]">
      <Scale size={14} className="mt-px shrink-0 text-status-info" aria-hidden />
      <div className="space-y-1 text-text-secondary">
        <p>
          <span className="font-semibold text-text-primary">Preliminary screening only. </span>
          Verify against the official maritime spatial plan (SIPAM), the plan regulation Dz.U. 2021 poz. 935 and the
          competent maritime authority before relying on any result.
        </p>
        <p className="flex flex-wrap gap-x-3 gap-y-0.5">
          {OFFICIAL_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              {l.label} <ExternalLink size={10} aria-hidden />
            </a>
          ))}
        </p>
      </div>
    </div>
  );
}

export default function DataSources() {
  const layers = useSiteStore((s) => s.layers);
  if (!layers) return null;
  return (
    <details className="group rounded-lg border border-border-primary bg-bg-secondary" data-tour="site-sources">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
        <span className="flex items-center gap-1.5">
          <Database size={13} aria-hidden /> Data &amp; sources
        </span>
        <span className="text-[10px] font-normal normal-case tracking-normal text-text-muted">
          {layers.layers.length} layers · {layers.region.title}
        </span>
      </summary>
      <ul className="max-h-72 divide-y divide-border-primary overflow-y-auto border-t border-border-primary">
        {layers.layers.map((l) => (
          <li key={l.id} className="px-3 py-1.5 text-[11px]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-text-primary">{l.title}</span>
              <span className="shrink-0 text-[10px] text-text-muted">retrieved {l.retrieved}</span>
            </div>
            <div className="text-text-secondary">{l.source}</div>
            <div className="text-[10px] text-text-muted">Licence: {l.license}</div>
          </li>
        ))}
        {layers.missing.map((m) => (
          <li key={`missing-${m.role}`} className="px-3 py-1.5 text-[11px]">
            <span className="font-medium text-status-warning">Missing: {m.role}</span>
            <span className="block text-text-secondary">{m.effect}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
