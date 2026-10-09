/**
 * Grid-code tab — operational notification to PSE (NC RfG Art. 34–36).
 *
 *   EON  energise the internal network (protection settings agreed)
 *   ION  generate for at most 24 months while compliance is shown
 *   FON  normal operation after the compliance tests and simulations
 *
 * Each stage: record a verdict per item, submit to PSE, PSE issues (simulated).
 */

import { ArrowRight, FileText, FlaskConical, Gauge } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import { InfoButton } from "../ui/InfoButton";
import { cn } from "../../lib/utils";
import { useCommissioningStore } from "../../store/commissioningStore";
import type { ComplianceVerdict, GridCodeTest, NotificationStage, ProgrammeDetail } from "../../types/commissioning";
import { p5GridCodeInfo } from "../../constants/panelInfo";

const STAGES: { id: NotificationStage; name: string; allows: string; article: string }[] = [
  { id: "eon", name: "EON", allows: "Energise the internal network and auxiliaries", article: "Art. 34" },
  { id: "ion", name: "ION", allows: "Generate for a limited period (≤ 24 months)", article: "Art. 35" },
  { id: "fon", name: "FON", allows: "Operate normally — commercial operation", article: "Art. 36" },
];

const KIND_ICON = {
  document: <FileText size={12} />,
  test: <Gauge size={12} />,
  simulation: <FlaskConical size={12} />,
};

const VERDICT_STYLE: Record<ComplianceVerdict, string> = {
  pending: "text-text-muted",
  compliant: "text-status-normal",
  non_compliant: "text-status-alarm",
};

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "");

function Item({ t, editable }: { t: GridCodeTest; editable: boolean }) {
  const { busy, recordCompliance } = useCommissioningStore();
  return (
    <li className="border-t border-border-primary/50 px-4 py-2 text-xs">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-text-muted" title={t.kind}>{KIND_ICON[t.kind]}</span>
        <div className="min-w-0 flex-1">
          <p className="text-text-primary">
            <span className="mr-1.5 font-mono text-text-muted">{t.test_id}</span>
            {t.name}
          </p>
          <p className="text-xs text-text-muted">{t.standard} · {t.description}</p>
          <p className="text-xs text-text-secondary">Criterion: {t.acceptance_criteria}</p>
        </div>
        {editable ? (
          <select
            aria-label={`${t.test_id} verdict`}
            value={t.verdict}
            disabled={busy}
            onChange={(e) => recordCompliance(t.test_id, e.target.value as ComplianceVerdict, "")}
            className={cn("rounded border border-border-secondary bg-bg-tertiary px-1.5 py-1 text-xs", VERDICT_STYLE[t.verdict])}
          >
            <option value="pending">pending</option>
            <option value="compliant">compliant</option>
            <option value="non_compliant">non-compliant</option>
          </select>
        ) : (
          <span className={cn("text-xs font-semibold", VERDICT_STYLE[t.verdict])}>{t.verdict.replace("_", "-")}</span>
        )}
      </div>
    </li>
  );
}

export default function GridCodeTab({ programme }: { programme: ProgrammeDetail }) {
  const { compliance, busy, createCompliance, stageAction, markStageCompliant } = useCommissioningStore();

  if (!compliance) {
    return (
      <Card>
        <CardHeader action={<InfoButton info={p5GridCodeInfo} />}>
          <CardTitle>Operational notification — PSE</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-text-secondary">
            The connection point is PSE's onshore 400 kV busbar, so under NC RfG Art. 23(1) the
            farm is notified as an onshore type D power park module: EON → ION → FON.
          </p>
          <Button size="sm" disabled={busy} onClick={createCompliance}>Open compliance campaign</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {compliance.cod_achieved && (
        <div className="rounded-lg border border-status-normal/40 bg-status-normal/10 px-4 py-3 text-sm text-text-primary">
          FON issued {date(compliance.cod_date)} — the farm may operate normally under its connection agreement.
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {STAGES.map(({ id, name, allows, article }, i) => {
          const app = compliance.stages[id];
          const prev = i > 0 ? compliance.stages[STAGES[i - 1].id] : null;
          const allOk = app.tests.every((t) => t.verdict === "compliant");
          const prevOk = !prev || prev.status === "issued";
          const needsProgramme = id === "fon" && programme.status !== "completed";
          return (
            <Card key={id} className="flex flex-col">
              <CardHeader action={i === 0 ? <InfoButton info={p5GridCodeInfo} /> : undefined}>
                <CardTitle>{name}</CardTitle>
                <span className="text-xs text-text-muted">NC RfG {article}</span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-xs font-semibold uppercase",
                    app.status === "issued" ? "bg-status-normal/15 text-status-normal"
                      : app.status === "submitted" ? "bg-status-warning/15 text-status-warning"
                      : "bg-bg-tertiary text-text-secondary",
                  )}
                >
                  {app.status}
                </span>
              </CardHeader>
              <div className="px-4 py-2 text-xs text-text-secondary">
                <ArrowRight size={11} className="mr-1 inline" />
                {allows}
                {app.approved_at && <span className="block text-xs text-text-muted">Issued {date(app.approved_at)}{app.valid_until && ` · valid until ${date(app.valid_until)}`}</span>}
              </div>
              <ul className="flex-1">
                {app.tests.map((t) => (
                  <Item key={t.test_id} t={t} editable={app.status === "open"} />
                ))}
              </ul>
              {app.status !== "issued" && (
                <div className="flex flex-wrap items-center gap-2 border-t border-border-primary px-4 py-3">
                  {app.status === "open" && (
                    <>
                      {!allOk && (
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => markStageCompliant(id)} title="Record every item as compliant (demonstration)">
                          Mark all compliant
                        </Button>
                      )}
                      <Button size="sm" disabled={busy || !allOk || !prevOk || needsProgramme} onClick={() => stageAction(id, "submit")}>
                        Submit to PSE
                      </Button>
                    </>
                  )}
                  {app.status === "submitted" && (
                    <Button size="sm" disabled={busy} onClick={() => stageAction(id, "approve")}>PSE issues {name}</Button>
                  )}
                  <span className="text-xs text-text-muted">
                    {!prevOk ? `${STAGES[i - 1].name} must be issued first` : needsProgramme ? "Programme must be complete" : ""}
                  </span>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
