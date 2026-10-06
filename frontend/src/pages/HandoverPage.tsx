/**
 * Hand-over (route /build/handover): the learner's farm leaves the project
 * phase — as-built register (printable), energisation order per OSS feeder
 * bay, and what each operation module takes over from it.
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Download, FileCheck2, Map as MapIcon, Printer } from "lucide-react";

import { useFarmPlan } from "../hooks/useFarmPlan";
import { useLayerStore } from "../store/layerStore";
import { useLifecycleStore } from "../store/lifecycleStore";
import { Button } from "../components/ui/Button";
import { WatchOut } from "../components/site/Stages";
import AsBuiltRegister from "../components/lifecycle/AsBuiltRegister";
import FarmSource from "../components/lifecycle/FarmSource";

function save(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function HandoverPage() {
  const farm = useFarmPlan();
  const build = useLifecycleStore((s) => s.results.build);
  const setLayer = useLayerStore((s) => s.setLayer);
  const navigate = useNavigate();
  const [printing, setPrinting] = useState(false);
  const own = farm.source === "project";

  const print = () => {
    setPrinting(true);
    window.setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 50);
  };
  const csv = () =>
    save(
      "as-built-register.csv",
      ["id,lat,lon,string,bay,cable_to,section_mm2,length_km", ...farm.turbines.map((t) => [t.id, t.lat, t.lon, t.string, t.bay, t.upstream, t.section ?? "", t.cableKm.toFixed(3)].join(","))].join("\n"),
      "text/csv",
    );
  const json = () =>
    save(
      "as-built.offshoreforge.json",
      JSON.stringify(
        {
          app: "OffshoreForge",
          kind: "as-built",
          schema: 1,
          source: farm.source,
          capacity_mw: farm.capacityMW,
          oss: farm.oss,
          strings: farm.strings,
          array_km: Number(farm.arrayKm.toFixed(2)),
          export_km: farm.exportKm,
          foundation: farm.foundation,
          turbines: farm.turbines,
          construction: build ? { start: build.start_date, milestones: build.milestones } : null,
        },
        null,
        2,
      ),
      "application/json",
    );

  const modules: { name: string; to: string; takes: string; note: string; action?: { label: string; run: () => void } }[] = [
    {
      name: "Control Room",
      to: "/",
      takes: own ? "Your turbines, OSS and cable tree as the “My Project” map layer." : "The SB-510 farm it already shows.",
      note: "The live simulation (power, faults, protection) stays on SB-510: its strings, relays and alarms are engineered for that farm.",
      action: own
        ? {
            label: "Show on the map",
            run: () => {
              setLayer("myProject", true);
              navigate("/");
            },
          }
        : undefined,
    },
    {
      name: "Commissioning (P5)",
      to: "/commissioning",
      takes: `Energisation order: export cable → OSS → 66 kV busbar → ${farm.strings.length} feeder bays, one string at a time (list below).`,
      note: "The switching programme is written for circuit 1 of the SB-510 export system; the export-system steps are the same for your farm.",
    },
    {
      name: "SCADA (P3)",
      to: "/scada",
      takes: `Bay list ${farm.turbines[0]?.bay ?? ""} … ${farm.strings.length ? farm.turbines.find((t) => t.string === farm.strings.length)?.bay : ""} for the substation single-line diagram.`,
      note: "The IEC 61850 model (logical nodes, GOOSE) is the SB-510 substation; compare its bays with yours.",
    },
    {
      name: "Digital Twin",
      to: "/digital-twin",
      takes: "The turbine register (ids, positions, strings) as the asset list, exported as JSON or CSV.",
      note: "The twin's reference model is calibrated on the 34 SB-510 turbines; a new farm would need its own commissioning baseline.",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2" data-tour="page-header">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-text-primary">
            <FileCheck2 size={20} className="text-accent" aria-hidden />
            Hand-over
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            The farm leaves the project team: an as-built register, the energisation order per feeder bay, and what each operation module
            takes over.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button variant="ghost" size="sm" onClick={csv}>
            <Download size={13} className="mr-1" /> CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={json}>
            <Download size={13} className="mr-1" /> JSON
          </Button>
          <Button size="sm" onClick={print}>
            <Printer size={13} className="mr-1" /> Print / PDF
          </Button>
        </div>
      </div>

      <FarmSource farm={farm} />

      <section className="space-y-2" data-tour="handover-modules">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Who takes over what</h3>
        <div className="grid gap-2 md:grid-cols-2">
          {modules.map((m) => (
            <div key={m.name} className="rounded-lg border border-border-primary bg-bg-secondary p-3 text-[12px]">
              <div className="flex items-center justify-between gap-2">
                <Link to={m.to} className="font-semibold text-accent underline">
                  {m.name}
                </Link>
                {m.action && (
                  <Button size="sm" variant="secondary" onClick={m.action.run}>
                    <MapIcon size={13} className="mr-1" /> {m.action.label}
                  </Button>
                )}
              </div>
              <p className="mt-1 text-text-primary">{m.takes}</p>
              <p className="mt-0.5 text-[11px] text-text-muted">{m.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border-primary bg-bg-secondary p-3" data-tour="handover-energisation">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-secondary">Energisation order</h3>
        <ol className="list-decimal space-y-0.5 pl-5 text-[12px] text-text-primary">
          <li>TSO authorisation; remove the 220 kV earths; energise the export cable from shore (charging current hold point).</li>
          <li>OSS 220 kV busbar, STATCOM in voltage control, then the OSS transformer and the 66 kV busbar.</li>
          {farm.strings.map((n, s) => (
            <li key={s}>
              {farm.turbines.find((t) => t.string === s + 1)?.bay}: remove the string earth, close the feeder, connect {n} turbine{n > 1 ? "s" : ""}{" "}
              ({n * 15} MW).
            </li>
          ))}
        </ol>
        <p className="mt-1 text-[10px] text-text-muted">
          Condensed from the P5 switching programme (S-001 … S-030); practise it in the Academy energisation mission.
        </p>
      </section>

      <AsBuiltRegister farm={farm} build={build} printing={printing} />

      <WatchOut text="A hand-over is a list of open items as much as a register: punch-list items, missing test certificates and unresolved cable crossings move to the operator with the keys." />
    </div>
  );
}
