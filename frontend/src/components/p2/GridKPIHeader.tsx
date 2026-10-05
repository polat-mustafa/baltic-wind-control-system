/**
 * Grid KPIs — one headline per study, each with the requirement it is judged
 * against. Status is carried by an icon + word, never colour alone.
 */

import { Activity, Gauge, ShieldCheck, Waves, Zap } from "lucide-react";

import {
  faultRideThroughEducation,
  loadFlowEducation,
  reactiveCompensationEducation,
  shortCircuitEducation,
} from "../../constants/education/p2";
import { useGridStore } from "../../store/gridStore";
import { KPICard } from "../ui/KPICard";

const ok = (pass: boolean) => (pass ? "✓" : "✗");

export default function GridKPIHeader() {
  const { loadFlowResults, shortCircuit, statcomSizing, frtResult } = useGridStore();
  if (!loadFlowResults || !shortCircuit) return null;

  const full = loadFlowResults.find((r) => r.scenario === "full_load");
  if (!full) return null;

  const energised = loadFlowResults.flatMap((r) =>
    r.buses.filter((b) => !b.name.startsWith("PSE") && b.vm_pu > 0).map((b) => b.vm_pu),
  );
  const vMin = Math.min(...energised);
  const vMax = Math.max(...energised);
  const allCompliant = loadFlowResults.every((r) => r.voltage_compliant);
  const lossPct = (full.total_loss_mw / full.total_generation_mw) * 100;

  const duty = shortCircuit.bus_results
    .filter((b) => b.breaker_ka > 0)
    .map((b) => ({ bus: b.bus_name, pct: (b.ikss_ka / b.breaker_ka) * 100 }))
    .sort((a, b) => b.pct - a.pct)[0];

  const frtPass =
    frtResult != null &&
    frtResult.stayed_connected &&
    frtResult.reactive_current_compliant &&
    frtResult.recovery_compliant;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
      <KPICard
        label="Delivered to PSE (full load)"
        value={full.poc_p_mw.toFixed(0)}
        unit="MW"
        icon={<Zap size={16} />}
        trendValue={`losses ${full.total_loss_mw.toFixed(1)} MW (${lossPct.toFixed(2)} %)`}
        education={loadFlowEducation}
      />
      <KPICard
        label="Farm bus voltages"
        value={`${vMin.toFixed(3)}–${vMax.toFixed(3)}`}
        unit="pu"
        icon={<Activity size={16} />}
        trendValue={`${ok(allCompliant)} 4 scenarios in 0.95–1.05 pu`}
        education={loadFlowEducation}
      />
      <KPICard
        label="Worst breaker duty"
        value={duty ? duty.pct.toFixed(0) : "—"}
        unit="%"
        icon={<ShieldCheck size={16} />}
        trendValue={
          duty
            ? `${ok(shortCircuit.breaker_adequate)} Ik'' ${shortCircuit.max_ikss_ka.toFixed(1)} kA · ${duty.bus.replace("_", " ")}`
            : "—"
        }
        education={shortCircuitEducation}
      />
      <KPICard
        label="Q range at POC"
        value={
          statcomSizing
            ? `+${statcomSizing.poc_q_max_mvar.toFixed(0)} / ${statcomSizing.poc_q_min_mvar.toFixed(0)}`
            : "—"
        }
        unit="MVAR"
        icon={<Waves size={16} />}
        trendValue={
          statcomSizing
            ? `${ok(statcomSizing.pse_q_range_met)} PSE needs +${statcomSizing.pse_q_max_mvar.toFixed(0)} / ${statcomSizing.pse_q_min_mvar.toFixed(0)}`
            : "—"
        }
        education={reactiveCompensationEducation}
      />
      <KPICard
        label="Fault ride-through"
        value={frtResult ? (frtPass ? "PASS" : "FAIL") : "—"}
        unit=""
        icon={<Gauge size={16} />}
        trendValue={
          frtResult
            ? `${ok(frtResult.stayed_connected)} profile · ${ok(frtResult.reactive_current_compliant)} Iq · ${ok(frtResult.recovery_compliant)} recovery`
            : "not simulated"
        }
        education={faultRideThroughEducation}
      />
    </div>
  );
}
