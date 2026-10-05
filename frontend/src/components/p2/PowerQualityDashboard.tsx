/**
 * Power Quality tab — pick the bus, the grid strength and the emission level;
 * harmonics, the frequency scan and flicker follow.
 *
 *   controls · KPIs
 *   emission → voltage (two charts)
 *   frequency scan | flicker + filter
 */

import { useEffect } from "react";
import { motion, MotionConfig } from "framer-motion";

import { powerQualityEducation } from "../../constants/education/p2";
import { type PQBus, usePowerQualityStore } from "../../store/powerQualityStore";
import { EducationButton } from "../ui/EducationButton";
import { KPICard } from "../ui/KPICard";
import FlickerFilterPanel from "./FlickerFilterPanel";
import HarmonicSpectrumPanel from "./HarmonicSpectrumPanel";
import ResonanceScanPanel from "./ResonanceScanPanel";

const BUSES: [PQBus, string][] = [
  [400, "PSE 400 kV (POC)"],
  [220, "OSS 220 kV"],
  [66, "OSS 66 kV (converters)"],
];

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

export default function PowerQualityDashboard() {
  const { harmonics, resonance, flicker, bus, gridSscMva, emissionScale, loading, error, setBus, setGridSscMva, setEmissionScale, runAll, clearError } =
    usePowerQualityStore();

  useEffect(() => {
    const t = setTimeout(() => void runAll(), 250);
    return () => clearTimeout(t);
  }, [bus, gridSscMva, emissionScale, runAll]);

  const worstPeak = resonance?.resonance_points.reduce((a, p) => (p.amplification > a.amplification ? p : a), resonance.resonance_points[0]);

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
            <div className="space-y-1">
              <p className="text-xs font-semibold text-text-secondary">Bus to assess</p>
              <div role="tablist" aria-label="Bus" className="flex flex-wrap gap-1">
                {BUSES.map(([b, l]) => (
                  <button
                    key={b}
                    role="tab"
                    aria-selected={bus === b}
                    onClick={() => setBus(b)}
                    className={`rounded px-2 py-1 text-[11px] font-medium ${bus === b ? "bg-accent text-white" : "text-text-secondary hover:bg-bg-tertiary"}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex flex-col gap-0.5 text-[11px] text-text-muted min-w-[11rem]">
              <span className="flex justify-between">
                Grid short-circuit power <span className="font-mono text-text-primary">{(gridSscMva / 1000).toFixed(1)} GVA</span>
              </span>
              <input type="range" min={1000} max={20000} step={500} value={gridSscMva} onChange={(e) => setGridSscMva(Number(e.target.value))} className="accent-accent" />
            </label>
            <label className="flex flex-col gap-0.5 text-[11px] text-text-muted min-w-[11rem]">
              <span className="flex justify-between">
                WTG emission level <span className="font-mono text-text-primary">× {emissionScale.toFixed(1)}</span>
              </span>
              <input type="range" min={0.5} max={3} step={0.1} value={emissionScale} onChange={(e) => setEmissionScale(Number(e.target.value))} className="accent-accent" />
            </label>
            {loading && <span className="text-[11px] text-text-muted">analysing…</span>}
            <span className="ml-auto">
              <EducationButton content={powerQualityEducation} />
            </span>
          </div>
        </motion.div>

        {harmonics && (
          <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPICard
              label={`THD at ${harmonics.bus.split(" (")[0]}`}
              value={harmonics.thd_voltage_pct.toFixed(2)}
              unit="%"
              trendValue={`${harmonics.thd_voltage_pct <= harmonics.thd_limit_pct ? "✓" : "✗"} planning level ${harmonics.thd_limit_pct} %`}
            />
            <KPICard
              label="Closest to its limit"
              value={`h${harmonics.dominant_harmonic_order}`}
              unit=""
              trendValue={`${harmonics.worst_utilisation_pct.toFixed(0)} % of the planning level`}
            />
            <KPICard
              label="Strongest resonance"
              value={worstPeak ? `${worstPeak.frequency_hz.toFixed(0)}` : "—"}
              unit="Hz"
              trendValue={worstPeak ? `h ${worstPeak.harmonic_order.toFixed(1)} · amplification ×${worstPeak.amplification.toFixed(0)}` : "none amplified"}
            />
            <KPICard
              label="Flicker P_st / P_lt"
              value={flicker ? `${flicker.pst.toFixed(3)} / ${flicker.plt.toFixed(3)}` : "—"}
              unit=""
              trendValue={flicker ? `${flicker.pst_compliant && flicker.plt_compliant ? "✓" : "✗"} limits ${flicker.pst_limit} / ${flicker.plt_limit}` : ""}
            />
          </motion.div>
        )}

        <motion.div variants={item}>
          <HarmonicSpectrumPanel />
        </motion.div>
        <motion.div variants={item} className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-4">
          <ResonanceScanPanel />
          <FlickerFilterPanel />
        </motion.div>
      </motion.div>
    </MotionConfig>
  );
}
