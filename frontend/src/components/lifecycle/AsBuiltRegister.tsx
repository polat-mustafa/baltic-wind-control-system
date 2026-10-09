/**
 * Printable as-built register of the farm handed over to operation.
 * Printed with the Site & Permits rule (index.css: only
 * `.print-doc[data-printing]` is printed); marked TRAINING SPECIMEN.
 */

import type { FarmPlan } from "../../lib/lifecycle/farm";
import type { CampaignResult } from "../../types/lifecycle";
import { fmtDate } from "./shared";

export default function AsBuiltRegister({ farm, build, printing }: { farm: FarmPlan; build: CampaignResult | undefined; printing: boolean }) {
  const cod = build?.milestones.find((m) => m.id === "cod");
  const first = build?.milestones.find((m) => m.id === "first-power");
  return (
    <div className="print-doc mx-auto max-w-4xl" data-printing={printing ? "" : undefined} data-tour="handover-register">
      <article className="relative overflow-hidden rounded-md border border-slate-300 bg-white p-5 font-serif text-[12px] leading-relaxed text-slate-900 shadow-md sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-[30px] font-black uppercase tracking-widest sm:text-[48px]"
          // fixed colour: the document looks the same in every app palette
          style={{ transform: "rotate(-24deg)", color: "rgba(220, 38, 38, 0.07)", fontFamily: "Arial, sans-serif" }}
          aria-hidden
        >
          Training specimen
        </div>
        <header className="relative border-b border-slate-300 pb-3">
          <p className="font-sans text-xs font-semibold uppercase tracking-widest text-slate-500">OffshoreForge · hand-over to operation</p>
          <h3 className="text-lg font-bold">As-built register — {farm.name}</h3>
          <p className="text-xs text-slate-600">
            {farm.turbines.length} × 15 MW (IEA-15-240-RWT) = {farm.capacityMW} MW · {farm.strings.length} array strings at 66 kV · export {farm.exportKm} km
            at 220 kV · {farm.foundation === "jacket" ? "jacket" : "monopile"} foundations · printed {new Date().toISOString().slice(0, 10)}
          </p>
        </header>

        <section className="relative mt-3">
          <h4 className="font-sans text-xs font-semibold uppercase tracking-wider text-slate-500">Construction</h4>
          {build && cod && first ? (
            <p>
              Simulated campaign from {fmtDate(build.start_date)}: first power {fmtDate(first.date_p50)} (P90 {fmtDate(first.date_p90)}), full
              operation {fmtDate(cod.date_p50)} (P90 {fmtDate(cod.date_p90)}); vessel cost P50 {build.cost_meur.p50.toFixed(0)} M€.
            </p>
          ) : (
            <p className="text-slate-600">No construction campaign simulated yet (Construction page).</p>
          )}
        </section>

        <section className="relative mt-3">
          <h4 className="font-sans text-xs font-semibold uppercase tracking-wider text-slate-500">Strings and OSS feeder bays</h4>
          <table className="mt-1 w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-400 text-left font-sans text-xs uppercase tracking-wider text-slate-500">
                <th className="py-1 pr-2">String</th>
                <th className="py-1 pr-2">Feeder bay</th>
                <th className="py-1 pr-2 text-right">Turbines</th>
                <th className="py-1 pr-2 text-right">MW</th>
                <th className="py-1">Turbine ids (from the OSS outwards)</th>
              </tr>
            </thead>
            <tbody>
              {farm.strings.map((n, s) => {
                const ids = farm.turbines.filter((t) => t.string === s + 1).map((t) => t.id);
                return (
                  <tr key={s} className="border-b border-slate-200">
                    <td className="py-1 pr-2">S{s + 1}</td>
                    <td className="py-1 pr-2 font-mono text-xs">{farm.turbines.find((t) => t.string === s + 1)?.bay}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{n}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{n * 15}</td>
                    <td className="py-1">{ids.join(", ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-slate-600">
            Array cable {farm.arrayKm.toFixed(1)} km:{" "}
            {Object.entries(farm.kmBySection)
              .map(([k, v]) => `${k === "over" ? "overloaded" : `${k} mm²`} ${v.toFixed(1)} km`)
              .join(", ")}
            {farm.crossings > 0 && ` · ${farm.crossings} crossing(s) to resolve`}.
          </p>
        </section>

        <section className="relative mt-3">
          <h4 className="font-sans text-xs font-semibold uppercase tracking-wider text-slate-500">Turbine register</h4>
          <div className="overflow-x-auto">
            <table className="mt-1 w-full min-w-[520px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-400 text-left font-sans text-xs uppercase tracking-wider text-slate-500">
                  <th className="py-1 pr-2">Id</th>
                  <th className="py-1 pr-2 text-right">Lat [°N]</th>
                  <th className="py-1 pr-2 text-right">Lon [°E]</th>
                  <th className="py-1 pr-2">String</th>
                  <th className="py-1 pr-2">Cable to</th>
                  <th className="py-1 pr-2">Section</th>
                  <th className="py-1 text-right">Length [km]</th>
                </tr>
              </thead>
              <tbody>
                {farm.turbines.map((t) => (
                  <tr key={t.id} className="border-b border-slate-200">
                    <td className="py-0.5 pr-2 font-mono">{t.id}</td>
                    <td className="py-0.5 pr-2 text-right tabular-nums">{t.lat.toFixed(4)}</td>
                    <td className="py-0.5 pr-2 text-right tabular-nums">{t.lon.toFixed(4)}</td>
                    <td className="py-0.5 pr-2">S{t.string}</td>
                    <td className="py-0.5 pr-2 font-mono">{t.upstream}</td>
                    <td className="py-0.5 pr-2">{t.section ? `${t.section} mm²` : "overloaded"}</td>
                    <td className="py-0.5 text-right tabular-nums">{t.cableKm.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="relative mt-4 border-t border-slate-300 pt-2 text-xs text-slate-500">
          TRAINING SPECIMEN — produced by the OffshoreForge simulation from a screening-level layout. Positions, cable routes and dates are
          not surveyed, engineered or certified.
        </footer>
      </article>
    </div>
  );
}
