/**
 * Decommissioning (route /decommission): choose what comes out of the sea,
 * simulate the removal campaign in weather windows (backend
 * POST /api/v1/lifecycle/campaign, mode "remove"), and read the material
 * inventory, end-of-life cost and seabed restoration steps.
 *
 * Legal frame and sources: lib/lifecycle/decommissioning.ts.
 */

import { Play, Recycle } from "lucide-react";

import { useFarmPlan } from "../hooks/useFarmPlan";
import { campaignRequest } from "../lib/lifecycle/farm";
import {
  DECOM_SOURCES,
  endOfLifeCost,
  inventory,
  MASS,
  RESTORATION_STEPS,
  UNIT,
  type DecomOptions,
} from "../lib/lifecycle/decommissioning";
import { limitList, requestSignature, useLifecycleStore } from "../store/lifecycleStore";
import { Button } from "../components/ui/Button";
import { InfoTile } from "../components/ui/InfoTile";
import { WatchOut } from "../components/site/Stages";
import CampaignControls from "../components/lifecycle/CampaignControls";
import { CampaignResultPanels } from "../components/lifecycle/CampaignResults";
import FarmSource from "../components/lifecycle/FarmSource";
import { meur } from "../components/lifecycle/shared";

const kt = (t: number) => `${(t / 1000).toFixed(t < 10_000 ? 1 : 0)} kt`;

function Options({ value, onChange }: { value: DecomOptions; onChange: (o: DecomOptions) => void }) {
  const check = (k: "removeArray" | "removeExport" | "removeScour", label: string, note: string) => (
    <label className="flex items-start gap-2">
      <input type="checkbox" className="mt-0.5 accent-accent" checked={value[k]} onChange={(e) => onChange({ ...value, [k]: e.target.checked })} />
      <span>
        {label}
        <span className="block text-xs text-text-muted">{note}</span>
      </span>
    </label>
  );
  return (
    <div className="space-y-2 rounded-lg border border-border-primary bg-bg-secondary p-3 text-[12px] text-text-primary" data-tour="decom-options">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">What comes out</h3>
      <p className="text-xs text-text-muted">Turbines and the offshore substation are always removed.</p>
      <fieldset className="space-y-1">
        <legend className="text-text-secondary">Foundations</legend>
        <label className="flex items-start gap-2">
          <input type="radio" name="fnd" className="mt-0.5 accent-accent" checked={value.foundations === "cut"} onChange={() => onChange({ ...value, foundations: "cut" })} />
          <span>
            Cut below the seabed, leave the embedded pile
            <span className="block text-xs text-text-muted">Common practice; the cut depth is set in the approved programme.</span>
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input type="radio" name="fnd" className="mt-0.5 accent-accent" checked={value.foundations === "full"} onChange={() => onChange({ ...value, foundations: "full" })} />
          <span>
            Full removal (excavate or vibro-extract the pile)
            <span className="block text-xs text-text-muted">More vessel time and seabed disturbance; nothing left behind.</span>
          </span>
        </label>
      </fieldset>
      {check("removeArray", "Recover the array cables", "Otherwise cut, seal and leave buried; position published for fishers.")}
      {check("removeExport", "Recover the export cable", "Long route, burial and crossings: often left in situ where buried deep enough.")}
      {check("removeScour", "Remove the scour protection rock", "Rock is a habitat after 25 years; removing it disturbs the seabed again.")}
    </div>
  );
}

export default function DecommissioningPage() {
  const farm = useFarmPlan();
  const { decom, setDecom, setLimit, run, results, resultFor, running, error, clearError } = useLifecycleStore();
  const o = decom.options;
  const req = campaignRequest(farm, {
    mode: "remove",
    start_date: decom.start,
    alpha: decom.alpha,
    runs: decom.runs,
    limits: limitList(decom.limits),
    remove_foundations: o.foundations,
    remove_array: o.removeArray,
    remove_export: o.removeExport,
    remove_scour: o.removeScour,
  });
  const result = results.decom;
  const stale = result != null && resultFor.decom !== requestSignature(req);
  const lines = inventory({ turbines: farm.turbines.length, arrayKm: farm.arrayKm, exportKm: farm.exportKm, foundation: farm.foundation }, o);
  const eol = result && !stale ? endOfLifeCost(lines, result.cost_meur.p50, farm.capacityMW) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2" data-tour="page-header">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-text-primary">
            <Recycle size={20} className="text-accent" aria-hidden />
            Decommissioning
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            After 25–30 years the farm comes out of the sea: choose what is removed, simulate the removal campaign in weather windows, and see
            the material, the cost and how the seabed is restored.
          </p>
        </div>
      </div>

      <FarmSource farm={farm} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Options value={o} onChange={(options) => setDecom({ options })} />
        <section className="min-w-0 space-y-2 rounded-lg border border-border-primary bg-bg-secondary p-3 text-[12px]" data-tour="decom-legal">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Legal frame</h3>
          <ul className="list-disc space-y-1 pl-5 text-text-primary">
            <li>
              <b>UNCLOS Art. 60(3):</b> abandoned or disused installations shall be removed to ensure safety of navigation, with due regard to
              fishing, the marine environment and other States; the depth, position and dimensions of anything not entirely removed are
              published.
            </li>
            <li>
              <b>IMO Res. A.672(16):</b> structures placed after 1 January 1998 in less than 100 m of water and weighing less than 4,000 t in
              air (excluding deck and superstructure) should be entirely removed (§3.2); where a structure is partly removed, at least 55 m
              of clear water column stays above it (§3.6).
            </li>
            <li>
              <b>National law</b> turns this into a decommissioning programme and financial security, approved by the authority — e.g. the
              UK Energy Act 2004, ss. 105–114. In Poland the conditions come with the project's permits; read them, not this summary.
            </li>
          </ul>
        </section>
      </div>

      <CampaignControls value={decom} vessels={["CTV", "WTIV", "CLV", "HLV", "SURVEY"]} onChange={setDecom} onLimit={(v, l) => setLimit("decom", v, l)} />
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void run("decom", req)} disabled={running.decom}>
          <Play size={13} className="mr-1" /> {running.decom ? "Simulating…" : "Simulate the removal"}
        </Button>
        {stale && <span className="text-[12px] text-status-warning">Options changed since this result — run again.</span>}
      </div>
      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-status-alarm/30 bg-status-alarm/10 p-3 text-sm">
          <span className="text-status-alarm">{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="min-w-0 rounded-lg border border-border-primary bg-bg-secondary p-3" data-tour="decom-inventory">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">Material inventory (illustrative masses)</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-[12px]">
              <thead>
                <tr className="border-b border-border-primary text-left text-xs uppercase tracking-wider text-text-muted">
                  <th className="py-1 pr-2">Item</th>
                  <th className="py-1 pr-2 text-right">Mass</th>
                  <th className="py-1">Fate</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.item} className="border-b border-border-primary/60">
                    <td className="py-1 pr-2 text-text-primary">{l.item}</td>
                    <td className="py-1 pr-2 text-right tabular-nums text-text-primary">{kt(l.tonnes)}</td>
                    <td className={l.fate === "left in situ" ? "py-1 text-status-warning" : "py-1 text-text-secondary"}>{l.fate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-text-muted">
            Per turbine: blades {MASS.bladesPerTurbine} t, nacelle and hub {MASS.nacellePerTurbine} t, tower {MASS.towerPerTurbine} t,
            {farm.foundation === "jacket" ? ` jacket ${MASS.jacketPerTurbine} t` : ` monopile and TP ${MASS.monopilePerTurbine} t`}, scour rock{" "}
            {MASS.scourPerFoundation} t; cables {MASS.arrayCablePerKm} t/km (66 kV) and {MASS.exportCablePerKm} t/km (220 kV). Order of
            magnitude for a 15 MW turbine in ~35 m of water — illustrative, not vendor data. Steel and cable metals are recycled; blades are
            composite and go to processing (cement kiln co-processing, mechanical or chemical recycling): WindEurope called for a Europe-wide
            landfill ban on blades.
          </p>
        </section>

        <section className="min-w-0 space-y-2 rounded-lg border border-border-primary bg-bg-secondary p-3" data-tour="decom-cost">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">End-of-life cost</h3>
          {eol ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <InfoTile label="Net cost" value={meur(eol.totalMEUR)} subtitle={`${(eol.perMW * 1000).toFixed(0)} k€/MW`} size="sm" />
                <InfoTile label="Recovered" value={kt(eol.recoveredT)} subtitle={`${(100 * eol.recycledShare).toFixed(0)} % recycled`} size="sm" />
                <InfoTile label="Left in situ" value={kt(eol.leftT)} priority={eol.leftT > 0 ? "warning" : "normal"} size="sm" />
              </div>
              <table className="w-full text-[12px]">
                <tbody>
                  {eol.lines.map((l) => (
                    <tr key={l.label} className="border-b border-border-primary/60">
                      <td className="py-0.5 text-text-secondary">{l.label}</td>
                      <td className={`py-0.5 text-right tabular-nums ${l.meur < 0 ? "text-status-normal" : "text-text-primary"}`}>
                        {l.meur < 0 ? "−" : ""}
                        {meur(Math.abs(l.meur))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-text-muted">
                Illustrative unit values: port handling {UNIT.portHandlingEURperT} €/t, blade processing {UNIT.bladeProcessingEURperT} €/t,
                steel scrap credit {UNIT.steelScrapCreditEURperT} €/t, cable credit {UNIT.cableRecyclingCreditEURperT} €/t, management{" "}
                {100 * UNIT.managementShare} % of the vessel campaign, monitoring {UNIT.monitoringMEURperYear} M€/yr for {UNIT.monitoringYears}{" "}
                years. Scrap prices swing with the market; the security the authority asks for is set before construction.
              </p>
            </>
          ) : (
            <p className="text-[12px] text-text-secondary">Simulate the removal to price the vessel campaign; the rest follows from the inventory.</p>
          )}
        </section>
      </div>

      {result && (
        <div className={stale ? "opacity-60" : undefined}>
          <CampaignResultPanels result={result} finalId="survey" finalLabel="Site cleared" />
        </div>
      )}

      <section className="rounded-lg border border-border-primary bg-bg-secondary p-3" data-tour="decom-restoration">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">Seabed restoration</h3>
        <ol className="grid gap-2 text-[12px] sm:grid-cols-2 xl:grid-cols-5">
          {RESTORATION_STEPS.map((s, i) => (
            <li key={s.title} className="rounded-md border border-border-primary/70 p-2">
              <span className="font-semibold text-text-primary">
                {i + 1}. {s.title}
              </span>
              <p className="mt-0.5 text-text-secondary">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <WatchOut text="Removing everything is not automatically the greenest option: recovering buried cables and scour rock disturbs the seabed a second time. The choice is made case by case with the authority, and whatever stays is charted." />

      <section className="text-xs text-text-muted">
        <h3 className="mb-1 font-semibold uppercase tracking-wider">Sources</h3>
        <ul className="list-disc space-y-0.5 pl-5">
          {DECOM_SOURCES.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer" className="text-accent underline">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
