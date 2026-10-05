/**
 * Security & Dynamics tab.
 *
 *   N-1 security — every single outage of the export system as an AC load
 *   flow: which the farm rides through as it is, which needs a PPC runback.
 *     controls · KPIs · loading | voltage · runback
 *   Dynamics — ANDES RMS simulation (WECC generic models): LFSM-O and FRT.
 */

import { useEffect } from "react";
import { motion, MotionConfig } from "framer-motion";

import { n1SecurityEducation } from "../../constants/education/p2";
import { useN1Store } from "../../store/n1SecurityStore";
import { EducationButton } from "../ui/EducationButton";
import { KPICard } from "../ui/KPICard";
import { Slider } from "../ui/Slider";
import AndesDynamicsSection from "./AndesDynamicsSection";
import N1LoadingPanel from "./N1LoadingPanel";
import N1RunbackPanel from "./N1RunbackPanel";
import N1VoltagePanel from "./N1VoltagePanel";

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

export default function AdvancedAnalysisTab() {
  const { study: s, generation_fraction, loading, error, setParams, run, clearError } = useN1Store();

  useEffect(() => {
    const id = setTimeout(() => void run(), 400);
    return () => clearTimeout(id);
  }, [generation_fraction, run]);

  const corrective = s?.contingencies.filter((r) => r.runback_mw > 0) ?? [];
  const worst = corrective.reduce<(typeof corrective)[number] | null>((w, r) => (!w || r.runback_mw > w.runback_mw ? r : w), null);
  const vMin = s ? Math.min(...s.contingencies.map((r) => r.after_action?.v_min_pu ?? 1)) : null;

  return (
    <MotionConfig reducedMotion="user">
      <motion.div className="space-y-4" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }}>
        {error && (
          <div className="p-3 bg-status-alarm/10 border border-status-alarm/30 rounded-lg text-sm flex justify-between">
            <span className="text-status-alarm">{error}</span>
            <button className="text-xs text-text-secondary" onClick={clearError}>
              Dismiss
            </button>
          </div>
        )}

        <motion.div variants={item} className="rounded-lg border border-border-primary bg-bg-secondary p-4">
          <div className="flex flex-wrap items-end gap-4">
            <Slider
              label="Available wind output"
              value={generation_fraction}
              display={`${(generation_fraction * 510).toFixed(0)} MW`}
              min={0.1}
              max={1}
              step={0.05}
              onChange={(v) => setParams({ generation_fraction: v })}
            />
            <p className="text-xs text-text-secondary max-w-md">
              9 outages × AC load flow with STATCOM re-dispatch; runback found by bisection.
              {loading && <span className="ml-1 text-accent">Solving…</span>}
            </p>
            <span className="ml-auto">
              <EducationButton content={n1SecurityEducation} />
            </span>
          </div>
        </motion.div>

        <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            label="Output (base case)"
            value={s?.base_case ? s.base_case.output_mw.toFixed(0) : "—"}
            unit="MW"
            trendValue={s?.base_case ? `${s.base_case.export_mw.toFixed(1)} MW at the POC` : ""}
          />
          <KPICard
            label="N-1 security"
            value={s ? (s.n1_secure ? "Secure" : "Not secure") : "—"}
            trendValue={s ? (corrective.length ? `${corrective.length} outages need a runback` : "no runback needed") : ""}
          />
          <KPICard
            label="Firm N-1 output"
            value={s ? s.firm_output_mw.toFixed(0) : "—"}
            unit="MW"
            trendValue={s ? (corrective.length ? "any outage, no runback" : "at least — nothing binds") : ""}
          />
          <KPICard
            label="Largest runback"
            value={worst ? worst.runback_mw.toFixed(0) : "0"}
            unit="MW"
            trendValue={worst ? `${worst.runback_s.toFixed(0)} s · lowest V ${vMin?.toFixed(3)} p.u.` : vMin ? `lowest V ${vMin.toFixed(3)} p.u.` : ""}
          />
        </motion.div>

        <motion.div variants={item} className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <N1LoadingPanel />
          <N1VoltagePanel />
        </motion.div>
        <motion.div variants={item}>
          <N1RunbackPanel />
        </motion.div>
        <motion.div variants={item}>
          <AndesDynamicsSection />
        </motion.div>
      </motion.div>
    </MotionConfig>
  );
}
