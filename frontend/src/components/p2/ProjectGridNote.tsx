/**
 * Own project on the HV Grid page: the electrical design the backend sized for
 * the layout (network_model.design), which tabs follow it, and the design
 * freeze that opens Construction (lib/project/progress.ts).
 */

import { useGridStore, useNetwork } from "../../store/gridStore";
import { StageDone } from "../project/StageDone";

/** Tabs that still model SB-510 (their data follow its real route, battery and market). */
const SB510_TABS = "Protection, BESS, Cable DTS and Market";

function freezeNeed(): string | null {
  const { networkSpec, loadFlowResults, analysisRun } = useGridStore.getState();
  if (networkSpec?.source !== "project") return "Your layout needs turbines and an offshore substation first.";
  const full = analysisRun ? loadFlowResults?.find((r) => r.scenario === "full_load") : undefined;
  if (!full) return "Run the grid analysis for your farm first.";
  if (!full.converged) return "The full-load load flow did not converge.";
  if (!full.voltage_compliant)
    return `Full-load voltages ${full.v_min_pu.toFixed(3)}–${full.v_max_pu.toFixed(3)} p.u. are outside 0.95–1.05 p.u.`;
  const worst = Math.max(...full.lines.map((l) => l.loading_percent), ...full.transformers.map((t) => t.loading_percent));
  if (worst > 100) return `A branch is loaded to ${worst.toFixed(0)} % at full output — above its rating.`;
  return null;
}

export default function ProjectGridNote() {
  const n = useNetwork();
  // re-render on new results; freezeNeed reads the same store
  useGridStore((s) => s.loadFlowResults);
  if (n.source !== "project") return null;
  const items = [
    `${n.num_turbines} × 15 MW = ${n.total_capacity_mw.toFixed(0)} MW on ${n.num_strings} strings (${n.string_layout.join("-")})`,
    `export ${n.num_export_cables} × 220 kV, ${n.export_length_km} km (charging ${n.cable_q_mvar.toFixed(0)} MVAR)`,
    `OSS ${n.num_oss_transformers} × ${n.oss_trafo_mva} MVA · onshore ${n.num_onshore_transformers} × ${n.onshore_trafo_mva} MVA`,
    `STATCOM ±${n.statcom_rating_mvar} MVAR · reactors ${n.num_reactors ? `${n.num_reactors} × ${n.reactor_unit_mvar} MVAR (one per circuit at each end)` : "none"}`,
  ];
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-[12px] text-text-secondary">
        <p>
          <span className="font-semibold text-text-primary">Your project — {n.name}.</span> Sized from your layout with the rules that give
          the SB-510 design (export circuits from the cable's charging current, transformers at ≤ 90 % loading, reactors at both cable ends sized for one out, checked by a
          reactor-outage load flow):
        </p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 font-mono text-xs">
          {items.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-text-muted">The {SB510_TABS} tabs still show SB-510.</p>
      </div>
      <StageDone milestone="design" title="Design freeze" need={freezeNeed()} next={{ path: "/build", label: "Construction" }} />
    </div>
  );
}
