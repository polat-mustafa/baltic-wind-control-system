/**
 * Hand-over (route /build/handover): the learner's farm leaves the project
 * phase. Teaches what hand-over is (vs commissioning), what the hand-over
 * package holds and how open items are graded, then gives what each operation
 * module takes over, the energisation order per OSS feeder bay and the
 * printable as-built register.
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Download, Map as MapIcon, Printer, XCircle } from "lucide-react";

import { useFarmPlan } from "../hooks/useFarmPlan";
import { useLifecycleStore } from "../store/lifecycleStore";
import { Button } from "../components/ui/Button";
import { WatchOut } from "../components/site/Stages";
import AsBuiltRegister from "../components/lifecycle/AsBuiltRegister";
import FarmSource from "../components/lifecycle/FarmSource";
import { StageGuide, StepHeading } from "../components/lifecycle/StageGuide";
import { StageDone } from "../components/project/StageDone";
import { PageHeader } from "../components/layout/PageHeader";

function save(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Commissioning and hand-over side by side: [aspect, commissioning, hand-over]. */
const VERSUS: [string, string, string][] = [
  ["Question", "Does the equipment work, and does the plant meet the grid code?", "Who is responsible for the plant from now on, and what is still open?"],
  ["Done by", "Commissioning engineers; the grid operator witnesses the compliance tests", "Contractor, owner's project team and the operator, together"],
  ["Works on", "Equipment: breakers, cables, transformers, STATCOM, turbines", "Responsibility, documents, spare parts, open items"],
  ["Ends with", "Signed test records; grid notifications EON → ION → FON (NC RfG)", "Taking-Over Certificate; the warranty period starts"],
  ["If it is skipped", "Equipment fails in service or trips off the grid", "Nobody owns the open faults; warranty claims lapse"],
];

/** The hand-over package: what the operator should demand before signing. */
const PACKAGE: { item: string; why: string; missing: string }[] = [
  {
    item: "As-built register and drawings",
    why: "The operator maintains what was actually built, not what was designed: turbine positions, cable routes, burial depths, joints.",
    missing: "A repair crew searches for a cable fault where the design said the cable is, not where it was laid.",
  },
  {
    item: "Test certificates (FAT, SAT, energisation records)",
    why: "Proof that each item passed, and the baseline later measurements are compared with.",
    missing: "No baseline: a partial-discharge or insulation reading in year 5 cannot be called better or worse.",
  },
  {
    item: "Punch list, graded A / B / C",
    why: "Every known open item with an owner and a deadline (grades below).",
    missing: "Open items become the operator's cost and the contractor has left the site.",
  },
  {
    item: "O&M manuals, spare parts and special tools",
    why: "Maintenance intervals, procedures, the critical spares (e.g. a cable repair kit and joint) and the tools only the supplier has.",
    missing: "A failed part waits months for a spare that should have been on the shelf.",
  },
  {
    item: "Trained, authorised staff and safety rules in force",
    why: "Switching authorisations, the permit-to-work system (SCADA page), emergency and rescue plans.",
    missing: "Nobody is authorised to switch — the plant cannot be operated or isolated safely.",
  },
  {
    item: "Grid connection notification from the operator (PSE)",
    why: "Under NC RfG the plant runs on an interim notification (ION) until the compliance tests give the final one (FON).",
    missing: "The grid operator can limit or disconnect the plant.",
  },
  {
    item: "Warranties and service contracts transferred",
    why: "Warranty start date per turbine and per substation, service agreement and who calls whom.",
    missing: "A defect found in year 2 cannot be claimed from the supplier.",
  },
];

/** Punch-list grades: a common convention — each contract defines its own. */
const GRADES: [string, string, string][] = [
  ["A", "Safety or function: closed before energisation or taking over.", "A missing earth bond, a failed protection test, an open cable seal."],
  ["B", "May stay open at taking over, with an owner and a deadline.", "A faulty temperature sensor, a missing equipment label, a door that does not latch."],
  ["C", "Minor or documentation only.", "A paint touch-up, a drawing revision, a spelling error in a manual."],
];

function SignChecklist() {
  const [ticked, setTicked] = useState<boolean[]>(() => PACKAGE.map(() => false));
  const done = ticked.filter(Boolean).length;
  const all = done === PACKAGE.length;
  return (
    <div className="space-y-2">
      <ul className="grid gap-2 lg:grid-cols-2">
        {PACKAGE.map((p, i) => (
          <li key={p.item} className="rounded-md border border-border-primary bg-bg-secondary p-2.5 text-[12px]">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5 accent-accent"
                checked={ticked[i]}
                onChange={(e) => setTicked(ticked.map((t, j) => (j === i ? e.target.checked : t)))}
              />
              <span className="min-w-0">
                <span className="font-semibold text-text-primary">{p.item}</span>
                <span className="block text-text-secondary">{p.why}</span>
                {!ticked[i] && (
                  <span className="mt-0.5 block text-status-warning">
                    <span className="font-semibold">Without it: </span>
                    {p.missing}
                  </span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p
        role="status"
        className={`flex items-center gap-2 rounded-md border px-3 py-2 text-[12px] ${
          all ? "border-status-normal/40 bg-status-normal/10" : "border-status-warning/40 bg-status-warning/10"
        }`}
      >
        {all ? <CheckCircle2 size={15} className="shrink-0 text-status-normal" aria-hidden /> : <XCircle size={15} className="shrink-0 text-status-warning" aria-hidden />}
        <span className="text-text-primary">
          {all ? (
            <>The package is complete — the Taking-Over Certificate can be signed; grade B and C items are closed during the warranty period.</>
          ) : (
            <>
              <span translate="no">
                {done} / {PACKAGE.length}
              </span>{" "}
              <span>in the package — do not sign yet: every missing item becomes the operator's problem.</span>
            </>
          )}
        </span>
      </p>
    </div>
  );
}

export default function HandoverPage() {
  const farm = useFarmPlan();
  const build = useLifecycleStore((s) => s.results.build);
  const navigate = useNavigate();
  const [printing, setPrinting] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const own = farm.source === "project";

  const print = () => {
    setRegisterOpen(true);
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
      takes: own
        ? "Your turbines, OSS and cable tree run live: power, wakes, faults and the array-cable drill on your layout."
        : "The SB-510 farm it already shows.",
      note: own
        ? "Surveyed-route features of SB-510 (export cable route, landfall, navigation marks, O&M vessels) are not drawn for your farm; the export shows as a straight line to the grid node."
        : "The live simulation runs the farm the project modules model.",
      action: own ? { label: "Open the control room", run: () => navigate("/") } : undefined,
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
      note: "The control room runs your switchboard: single-line diagram, bay controllers and interlocks, mimic and alarms.",
    },
    {
      name: "Digital Twin",
      to: "/digital-twin",
      takes: "The turbine register (ids, positions, strings) as the asset list, exported as JSON or CSV.",
      note: "The twin's reference model is calibrated on the 34 SB-510 turbines; a new farm would need its own commissioning baseline.",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hand-over to operation"
        description={
          <>
            Commissioning proves the plant works; hand-over makes someone else responsible for it. The contractor and the project team pass
            the plant, its records and every open item to the operator, who runs it for the next 25–30 years.
          </>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={csv}>
              <Download size={13} className="mr-1" /> CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={json}>
              <Download size={13} className="mr-1" /> JSON
            </Button>
            <Button size="sm" onClick={print}>
              <Printer size={13} className="mr-1" /> Print / PDF
            </Button>
          </>
        }
      />

      <StageGuide
        current="handover"
        question="Can the operator take this plant over and run it safely — and does it know everything that is still open?"
        facts={[
          { label: "Who", value: "Contractor → owner's project team → operator (O&M)" },
          { label: "Starts when", value: "Commissioning tests passed and the reliability run completed" },
          { label: "Ends with", value: "Taking-Over Certificate signed; the warranty period starts" },
          { label: "Key output", value: "The hand-over package: as-built records, certificates, punch list, manuals" },
        ]}
        steps={[
          { title: "Mechanical completion", text: "Everything installed; walk-downs list what is left (the punch list)." },
          { title: "Commissioning", text: "Cold tests, then energisation and hot tests — the Commissioning page." },
          { title: "Reliability run", text: "Each turbine runs a contract period without a fault, often 120–240 h." },
          { title: "Taking over", text: "Certificate signed per turbine and for the substation; risk and insurance pass to the owner." },
          { title: "Warranty period", text: "The supplier fixes defects, often 2–5 years for turbines; then final acceptance." },
        ]}
      />

      <FarmSource farm={farm} />
      <StageDone
        milestone="handover"
        title="Hand-over"
        need={own ? null : "Your layout needs turbines and an offshore substation first."}
        next={{ path: "/scada", label: "SCADA and the other operation modules" }}
      />

      <section className="space-y-2" data-tour="handover-versus">
        <StepHeading n={1} title="Commissioning or hand-over?">
          Two stages that overlap in time but answer different questions.
        </StepHeading>
        <div className="overflow-x-auto rounded-lg border border-border-primary bg-bg-secondary">
          <table className="w-full min-w-[560px] text-[12px]">
            <thead>
              <tr className="border-b border-border-primary text-left text-xs uppercase tracking-wider text-text-muted">
                <th className="w-[18%] px-3 py-2" />
                <th className="px-3 py-2">
                  <Link to="/commissioning" className="text-accent underline">
                    Commissioning
                  </Link>
                </th>
                <th className="px-3 py-2 text-accent">Hand-over</th>
              </tr>
            </thead>
            <tbody>
              {VERSUS.map(([aspect, c, h]) => (
                <tr key={aspect} className="border-b border-border-primary/60 last:border-0 align-top">
                  <th scope="row" className="px-3 py-1.5 text-left font-semibold text-text-secondary">
                    {aspect}
                  </th>
                  <td className="px-3 py-1.5 text-text-primary">{c}</td>
                  <td className="px-3 py-1.5 text-text-primary">{h}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2" data-tour="handover-package">
        <StepHeading n={2} title="The hand-over package — would you sign?">
          You are the operator. Tick what the contractor has handed you; anything missing shows what it will cost you later.
        </StepHeading>
        <SignChecklist />
      </section>

      <section className="space-y-2" data-tour="handover-punch">
        <StepHeading n={3} title="Grading the open items">
          No plant is handed over with zero open items; the grade decides whether an item blocks the signature.
        </StepHeading>
        <div className="grid gap-2 md:grid-cols-3">
          {GRADES.map(([g, rule, eg]) => (
            <div key={g} className="rounded-md border border-border-primary bg-bg-secondary p-2.5 text-[12px]">
              <span translate="no" className={`text-lg font-bold ${g === "A" ? "text-status-alarm" : g === "B" ? "text-status-warning" : "text-text-secondary"}`}>
                {g}
              </span>
              <p className="font-semibold text-text-primary">{rule}</p>
              <p className="mt-0.5 text-text-muted">
                <span>e.g. </span>
                <span>{eg}</span>
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs text-text-muted">A common convention — each contract defines its own grades and deadlines.</p>
      </section>

      <section className="space-y-2" data-tour="handover-modules">
        <StepHeading n={4} title="Who takes over what in OffshoreForge">
          After hand-over the farm lives in the operation modules; each one picks up part of the record.
        </StepHeading>
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
              <p className="mt-0.5 text-xs text-text-muted">{m.note}</p>
            </div>
          ))}
        </div>
        <details className="rounded-lg border border-border-primary bg-bg-secondary p-3" data-tour="handover-energisation">
          <summary className="cursor-pointer text-[12px] font-semibold text-text-primary">Energisation order the operator inherits</summary>
          <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-[12px] text-text-primary">
            <li>TSO authorisation; remove the 220 kV earths; energise the export cable from shore (charging current hold point).</li>
            <li>OSS 220 kV busbar, STATCOM in voltage control, then the OSS transformer and the 66 kV busbar.</li>
            {farm.strings.map((n, s) => (
              <li key={s}>
                {farm.turbines.find((t) => t.string === s + 1)?.bay}: remove the string earth, close the feeder, connect {n} turbine{n > 1 ? "s" : ""}{" "}
                ({n * 15} MW).
              </li>
            ))}
          </ol>
          <p className="mt-1 text-xs text-text-muted">
            Condensed from the P5 switching programme (S-001 … S-030); practise it in the Academy energisation mission.
          </p>
        </details>
      </section>

      <section className="space-y-2">
        <StepHeading n={5} title="The as-built register">
          The record of what was actually built — every turbine position, string, feeder bay and cable section. Print it or download it as
          CSV / JSON for the asset system.
        </StepHeading>
        <details open={registerOpen} onToggle={(e) => setRegisterOpen(e.currentTarget.open)} className="rounded-lg border border-border-primary bg-bg-secondary p-3">
          <summary className="cursor-pointer text-[12px] font-semibold text-text-primary">
            <span>{registerOpen ? "Hide the register" : "Show the register"}</span> <span translate="no">({farm.turbines.length} WTG)</span>
          </summary>
          <div className="mt-3">
            <AsBuiltRegister farm={farm} build={build} printing={printing} />
          </div>
        </details>
      </section>

      <WatchOut text="A hand-over is a list of open items as much as a register: punch-list items, missing test certificates and unresolved cable crossings move to the operator with the keys." />
    </div>
  );
}
