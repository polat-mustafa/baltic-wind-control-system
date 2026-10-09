/** Which farm the lifecycle page works on: the learner's layout project or SB-510. */

import { Link } from "react-router-dom";

import type { FarmPlan } from "../../lib/lifecycle/farm";

export default function FarmSource({ farm }: { farm: FarmPlan }) {
  const items: [string, string][] = [
    ["Turbines", `${farm.turbines.length} × 15 MW = ${farm.capacityMW} MW`],
    ["Array strings", `${farm.strings.length} (${farm.strings.join("-")})`],
    ["Array cables", `${farm.arrayKm.toFixed(1)} km`],
    ["Export cable", `${farm.exportKm} km`],
    ["Water depth", farm.depthM ? `${farm.depthM[0].toFixed(0)}–${farm.depthM[1].toFixed(0)} m` : "not assessed"],
    ["Foundations", farm.foundation === "jacket" ? "jackets (> 40 m)" : "monopiles (≤ 40 m)"],
    ["Installation port", farm.installPort ? `${farm.installPort.name}, ${farm.installPort.km.toFixed(0)} km by sea` : "not assessed"],
    ["O&M port", farm.omPort ? `${farm.omPort.name}, ${farm.omPort.km.toFixed(0)} km by sea` : "not assessed"],
  ];
  return (
    <div className="rounded-lg border border-border-primary bg-bg-secondary p-3" data-tour="farm-source">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">{farm.name}</h3>
        <span className="text-xs text-text-muted">
          {farm.source === "project" ? (
            <>
              from <Link to="/develop/layout" className="text-accent underline">Layout</Link>
            </>
          ) : (
            <>
              no layout with turbines and an OSS yet — <Link to="/develop/layout" className="text-accent underline">build one</Link>
            </>
          )}
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2 border-b border-border-primary/50 py-0.5">
            <dt className="text-text-muted">{k}</dt>
            <dd className="text-right text-text-primary">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
