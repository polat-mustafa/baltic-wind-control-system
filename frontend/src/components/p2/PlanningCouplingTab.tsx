/**
 * P2 Grid · Planning & P2X tab.
 *
 *   Export technology vs route length (HVAC 220 kV vs VSC-HVDC)
 *   Electrolyser on the energy above a grid connection limit
 */

import { useEffect } from "react";
import { motion, MotionConfig } from "framer-motion";

import { usePlanningStore } from "../../store/planningStore";
import ExportTechSection from "./ExportTechSection";
import P2XSection from "./P2XSection";

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

export default function PlanningCouplingTab() {
  const { design_length_km, connection_mw, electrolyser_mw, capex_eur_per_kw, error, runExport, runP2X, clearError } =
    usePlanningStore();

  useEffect(() => {
    const id = setTimeout(() => void runExport(), 200);
    return () => clearTimeout(id);
  }, [design_length_km, runExport]);

  useEffect(() => {
    const id = setTimeout(() => void runP2X(), 200);
    return () => clearTimeout(id);
  }, [connection_mw, electrolyser_mw, capex_eur_per_kw, runP2X]);

  return (
    <MotionConfig reducedMotion="user">
      <motion.div className="space-y-6" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }}>
        {error && (
          <div className="p-3 bg-status-alarm/10 border border-status-alarm/30 rounded-lg text-sm flex justify-between">
            <span className="text-status-alarm">{error}</span>
            <button className="text-xs text-text-secondary" onClick={clearError}>
              Dismiss
            </button>
          </div>
        )}
        <motion.div variants={item}>
          <ExportTechSection />
        </motion.div>
        <motion.div variants={item}>
          <P2XSection />
        </motion.div>
      </motion.div>
    </MotionConfig>
  );
}
