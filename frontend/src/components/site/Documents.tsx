/**
 * Training-specimen documents produced by the journey, filled from the
 * user's own site and decision:
 *   - non-technical summary of the environmental impact assessment,
 *   - the permit decision,
 *   - a grid connection offer.
 *
 * They are deliberately marked TRAINING SPECIMEN and issued by fictional
 * bodies ("… (training)"): they imitate no real authority or company and
 * have no legal value. Each can be printed on its own (print styles in
 * index.css: only `.print-doc[data-printing]` is printed).
 */

import { useState } from "react";
import { FileText, Printer } from "lucide-react";

import { cn } from "../../lib/utils";
import type { AssessResponse } from "../../services/siteApi";
import { useSiteStore } from "../../store/siteStore";
import { decide, OUTCOME_LABEL, type Decision } from "./journey";

type DocId = "eia" | "permit" | "grid";

const DOCS: { id: DocId; title: string }[] = [
  { id: "eia", title: "EIA non-technical summary" },
  { id: "permit", title: "Permit decision" },
  { id: "grid", title: "Grid connection offer" },
];

const today = () => new Date().toISOString().slice(0, 10);
const ref = (prefix: string, site: AssessResponse) =>
  `${prefix}-${Math.abs(Math.round(site.centroid[0] * 1000 + site.centroid[1] * 100)).toString(36).toUpperCase()}`;

function Specimen({ children, title, issuer, docRef }: { children: React.ReactNode; title: string; issuer: string; docRef: string }) {
  return (
    <article className="relative overflow-hidden rounded-md border border-slate-300 bg-white p-6 font-serif text-[13px] leading-relaxed text-slate-900 shadow-md sm:p-8">
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-[34px] font-black uppercase tracking-widest sm:text-[52px]"
        // fixed colour: the document looks the same in every app palette
        style={{ transform: "rotate(-24deg)", color: "rgba(220, 38, 38, 0.09)", fontFamily: "Arial, sans-serif" }}
        aria-hidden
      >
        Training specimen
      </div>
      <header className="mb-4 flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500">{issuer}</div>
          <h3 className="mt-1 text-lg font-bold">{title}</h3>
        </div>
        <div className="text-right text-xs text-slate-600">
          <div>Ref. {docRef}</div>
          <div>Date {today()}</div>
        </div>
      </header>
      <div className="relative space-y-3">{children}</div>
      <footer className="relative mt-6 border-t border-slate-300 pt-2 text-xs text-red-700">
        TRAINING SPECIMEN — not a legal document. Produced by the OffshoreForge simulation; the issuing body is
        fictional and the content illustrative.
      </footer>
    </article>
  );
}

function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <table className="w-full text-[12px]">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b border-slate-200">
            <th className="w-44 py-1 pr-3 text-left font-semibold align-top">{k}</th>
            <td className="py-1">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const coord = (r: AssessResponse) => `${r.centroid[1].toFixed(3)}° N, ${r.centroid[0].toFixed(3)}° E`;

function EiaSummary({ r }: { r: AssessResponse }) {
  const natura = r.checks.find((c) => c.id === "natura2000");
  return (
    <Specimen title="Environmental impact assessment — non-technical summary" issuer="Developer: OffshoreForge Training Wind Ltd (fictional)" docRef={ref("EIA", r)}>
      <Facts
        rows={[
          ["Project", `Offshore wind farm, about ${r.capacity_mw.toFixed(0)} MW`],
          ["Location", `${coord(r)}; ${r.area_km2.toFixed(1)} km²`],
          ["Water depth", r.depth_m ? `${r.depth_m[0].toFixed(0)}–${r.depth_m[1].toFixed(0)} m (${r.foundation ?? "foundation to be confirmed"})` : "not surveyed"],
          ["Distance to shore", r.shore_km ? `${r.shore_km[0].toFixed(0)}–${r.shore_km[1].toFixed(0)} km` : "—"],
        ]}
      />
      <p>
        <b>Baseline.</b> Surveys covered all four seasons: seabirds and migrating birds, harbour porpoise and seals,
        fish and fisheries, and the seabed habitats of the site and the export cable route.
      </p>
      <p>
        <b>Main effects.</b> Underwater noise during pile driving; displacement of and collision risk for seabirds;
        loss of seabed habitat under foundations and scour protection; closure of fishing grounds inside safety zones.
      </p>
      <p>
        <b>Natura 2000.</b> {natura ? natura.detail : "Not assessed."}
      </p>
      <p>
        <b>Mitigation.</b> Soft start and bubble curtains during piling, seasonal restrictions where the surveys show
        sensitive periods, micro-siting around sensitive habitats, and a monitoring programme before, during and after
        construction.
      </p>
      <p className="text-xs text-slate-500">Prepared under Directive 2011/92/EU as amended by 2014/52/EU, Article 5 and Annex IV.</p>
    </Specimen>
  );
}

function PermitDecision({ r, d }: { r: AssessResponse; d: Decision }) {
  return (
    <Specimen title={`Decision: ${OUTCOME_LABEL[d.outcome]}`} issuer="Maritime Permitting Authority (training) — single contact point" docRef={ref("PMT", r)}>
      <Facts
        rows={[
          ["Applicant", "OffshoreForge Training Wind Ltd (fictional)"],
          ["Project", `Offshore wind farm, about ${r.capacity_mw.toFixed(0)} MW, ${r.area_km2.toFixed(1)} km² at ${coord(r)}`],
          ["Procedure", "Combined permit-granting procedure with environmental impact assessment"],
        ]}
      />
      {d.reasons.length > 0 && (
        <>
          <p className="font-semibold">Grounds</p>
          <ol className="list-decimal space-y-1 pl-5">
            {d.reasons.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
        </>
      )}
      {d.conditions.length > 0 && (
        <>
          <p className="font-semibold">Conditions</p>
          <ol className="list-decimal space-y-1 pl-5">
            {d.conditions.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
        </>
      )}
      <p className="text-xs text-slate-500">
        Legal basis (generic EU): Directive (EU) 2018/2001 as amended by (EU) 2023/2413, Articles 16–16b; Directive
        2011/92/EU; Directive 92/43/EEC, Article 6(3). National law decides the actual procedure and appeal rights.
      </p>
    </Specimen>
  );
}

function GridOffer({ r }: { r: AssessResponse }) {
  return (
    <Specimen title="Grid connection offer" issuer="Transmission System Operator (training)" docRef={ref("GCO", r)}>
      <Facts
        rows={[
          ["Connection point", r.grid_node ?? "to be agreed"],
          ["Requested capacity", `${r.capacity_mw.toFixed(0)} MW`],
          ["Straight-line distance", r.grid_km != null ? `${r.grid_km.toFixed(0)} km (cable route longer)` : "—"],
          ["Grid code", "Commission Regulation (EU) 2016/631 (RfG), power park module type D"],
        ]}
      />
      <p>
        The offer is subject to: compliance with the grid code (fault ride-through, reactive power, frequency
        response), verified at commissioning; a connection agreement; and the construction programme of the reinforcement
        works at the connection point.
      </p>
      <p className="text-xs text-slate-500">
        Type D: connection at 110 kV or above (Regulation (EU) 2016/631, Article 5).
      </p>
    </Specimen>
  );
}

export default function DocumentsStage() {
  const report = useSiteStore((s) => s.report);
  const done = useSiteStore((s) => s.done);
  const [active, setActive] = useState<DocId>("eia");
  const [printing, setPrinting] = useState(false);

  if (!report) {
    return <p className="text-sm text-text-muted">Assess a site first: the documents are written from its report.</p>;
  }
  const decision = decide(report);
  const permitDone = done.includes("permit");

  const print = () => {
    setPrinting(true);
    window.setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 50);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {DOCS.map((d) => {
          const locked = d.id !== "eia" && !permitDone;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setActive(d.id)}
              disabled={locked}
              title={locked ? "Issued once the permit procedure has run" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium disabled:opacity-40",
                active === d.id ? "border-accent bg-accent/10 text-text-primary" : "border-border-primary text-text-secondary hover:bg-bg-hover",
              )}
            >
              <FileText size={13} /> {d.title}
            </button>
          );
        })}
        <button
          type="button"
          onClick={print}
          className="ml-auto flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-hover"
        >
          <Printer size={13} /> Print / save as PDF
        </button>
      </div>
      <div className="print-doc mx-auto max-w-3xl" data-printing={printing ? "" : undefined}>
        {active === "eia" && <EiaSummary r={report} />}
        {active === "permit" && <PermitDecision r={report} d={decision} />}
        {active === "grid" && <GridOffer r={report} />}
      </div>
    </div>
  );
}
