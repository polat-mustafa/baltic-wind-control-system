/**
 * Wind Resource dashboard — the analysis read top-down, in the order an
 * energy-yield report is written:
 *
 *   KPIs
 *   1 Wind resource: Weibull distribution | wind rose
 *   2 Wake effects:  farm layout          | per-turbine wake loss
 *   3 From gross to bankable: loss cascade + exceedance curve
 *   4 Layout alternatives
 *
 * Panels fade/slide in one after another (framer-motion, honours reduced
 * motion); Plotly transitions animate later re-runs.
 */

import { motion, MotionConfig } from "framer-motion";

import { useWindResourceStore } from "../../store/windResourceStore";
import AEPCascadePanel from "./AEPCascadePanel";
import FarmLayoutMap from "./FarmLayoutMap";
import KPIHeader from "./KPIHeader";
import LayoutComparison from "./LayoutComparison";
import WakeLossPanel from "./WakeLossPanel";
import WeibullChart from "./WeibullChart";
import WindRoseChart from "./WindRoseChart";

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
};

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <motion.section variants={item} className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-mono text-white">{n}</span>
        {title}
      </h3>
      {children}
    </motion.section>
  );
}

export default function WindResourceDashboard() {
  const { aepCascade } = useWindResourceStore();
  if (!aepCascade) return null;

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className="space-y-6"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.12 } } }}
      >
        <motion.div variants={item}>
          <KPIHeader />
        </motion.div>
        <Section n={1} title="Wind resource — how often, how strong, from where">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <WeibullChart />
            <WindRoseChart />
          </div>
        </Section>
        <Section n={2} title="Wake effects — turbines shading each other">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FarmLayoutMap />
            <WakeLossPanel />
          </div>
        </Section>
        <Section n={3} title="From gross energy to a bankable number">
          <AEPCascadePanel />
        </Section>
        <Section n={4} title="Layout alternatives">
          <LayoutComparison />
        </Section>
      </motion.div>
    </MotionConfig>
  );
}
