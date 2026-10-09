/**
 * Grid Analysis dashboard — read top-down in the order a grid-connection
 * study is written:
 *
 *   KPIs · single-line diagram (selected scenario)
 *   1 Power flow:          voltage along the connection | thermal loading
 *   2 Reactive power:      compensation + PSE Q range
 *   3 Fault level:         breaker duty (IEC 60909)
 *   4 Fault ride-through:  PSE profile, fast fault current, recovery
 *   5 Grid strength:       GFL vs GFM after a phase jump
 *
 * Panels fade/slide in one after another (framer-motion, honours reduced motion).
 */

import { motion, MotionConfig } from "framer-motion";

import { useGridStore } from "../../store/gridStore";
import CableLoadingPanel from "./CableLoadingPanel";
import ConverterComparisonPanel from "./ConverterComparisonPanel";
import FRTPanel from "./FRTPanel";
import GridConnectionDiagram from "./GridConnectionDiagram";
import GridKPIHeader from "./GridKPIHeader";
import ShortCircuitPanel from "./ShortCircuitPanel";
import STATCOMPanel from "./STATCOMPanel";
import VoltageProfilePanel from "./VoltageProfilePanel";

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
};

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <motion.section variants={item} className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-mono text-accent-ink">{n}</span>
        {title}
      </h3>
      {children}
    </motion.section>
  );
}

export default function GridDashboard() {
  const { loadFlowResults } = useGridStore();
  if (!loadFlowResults) return null;

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className="space-y-6"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.1 } } }}
      >
        <motion.div variants={item}>
          <GridKPIHeader />
        </motion.div>
        <motion.div variants={item}>
          <GridConnectionDiagram />
        </motion.div>
        <Section n={1} title="Power flow — voltages and loading in four operating cases">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <VoltageProfilePanel />
            <CableLoadingPanel />
          </div>
        </Section>
        <Section n={2} title="Reactive power — cable charging, compensation and the PSE range">
          <STATCOMPanel />
        </Section>
        <Section n={3} title="Fault level — can the switchgear clear the worst fault?">
          <ShortCircuitPanel />
        </Section>
        <Section n={4} title="Fault ride-through — stay connected, support the voltage, recover">
          <FRTPanel />
        </Section>
        <Section n={5} title="Grid strength — grid-following vs grid-forming control">
          <ConverterComparisonPanel />
        </Section>
      </motion.div>
    </MotionConfig>
  );
}
