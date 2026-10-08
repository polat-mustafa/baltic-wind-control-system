/**
 * Cable DTS tab — one 220 kV export circuit. Set the current and ambient;
 * the fibre profile, zone ratings and the N-1 emergency transient follow.
 *
 *   controls · KPIs
 *   profile + zone table
 *   rating vs ambient | N-1 transient
 */

import { useEffect } from "react";
import { motion, MotionConfig } from "framer-motion";

import { cableDtsEducation } from "../../constants/education/p2";
import { N1_CURRENT_A, NORMAL_CURRENT_A, useCableDTSStore } from "../../store/cableDtsStore";
import { EducationButton } from "../ui/EducationButton";
import { KPICard } from "../ui/KPICard";
import { Slider } from "../ui/Slider";
import DTSProfilePanel from "./DTSProfilePanel";
import DTSRatingPanel from "./DTSRatingPanel";
import DTSTransientPanel from "./DTSTransientPanel";

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

const PRESETS: [string, number][] = [
  [`Both circuits, 510 MW — ${NORMAL_CURRENT_A} A`, NORMAL_CURRENT_A],
  ["Datasheet rating — 825 A", 825],
  [`N-1 survivor — ${N1_CURRENT_A} A`, N1_CURRENT_A],
];

const fmtMinutes = (m: number) => `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, "0")} min`;

export default function CableDTSDashboard() {
  const { profile: p, transient: t, currentA, ambientC, emergencyA, error, setParams, runProfile, runTransient, clearError } = useCableDTSStore();

  useEffect(() => {
    const id = setTimeout(() => void runProfile(), 250);
    return () => clearTimeout(id);
  }, [currentA, ambientC, runProfile]);
  useEffect(() => {
    const id = setTimeout(() => void runTransient(), 250);
    return () => clearTimeout(id);
  }, [currentA, ambientC, emergencyA, runTransient]);

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

        <motion.div variants={item} className="rounded-lg border border-border-primary bg-bg-secondary p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-text-secondary">Current per circuit</p>
              <div className="flex flex-wrap gap-1">
                {PRESETS.map(([label, a]) => (
                  <button
                    key={a}
                    aria-pressed={currentA === a}
                    onClick={() => setParams({ currentA: a })}
                    className={`rounded px-2 py-1 text-[11px] font-medium ${currentA === a ? "bg-accent text-white" : "text-text-secondary hover:bg-bg-tertiary"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <span className="ml-auto">
              <EducationButton content={cableDtsEducation} />
            </span>
          </div>
          <div className="flex flex-wrap gap-4">
            <Slider label="Current per circuit" value={currentA} display={`${currentA} A`} min={0} max={1400} step={10} onChange={(v) => setParams({ currentA: v })} />
            <Slider label="Ambient (seabed, soil, air)" value={ambientC} display={`${ambientC} °C`} min={0} max={30} step={1} onChange={(v) => setParams({ ambientC: v })} />
            <Slider
              label="Emergency current after the step"
              value={emergencyA}
              display={`${emergencyA} A`}
              min={800}
              max={1600}
              step={10}
              onChange={(v) => setParams({ emergencyA: v })}
            />
          </div>
        </motion.div>

        <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            label="Hottest conductor"
            value={p ? p.max_conductor_c.toFixed(1) : "—"}
            unit="°C"
            trendValue={p ? `${p.max_conductor_c < 90 ? "✓" : "✗"} ≤ 90 °C · at ${p.max_location_km.toFixed(2)} km` : ""}
          />
          <KPICard
            label="Route rating at this ambient"
            value={p ? p.rating_at_ambient_a.toFixed(0) : "—"}
            unit="A"
            trendValue={p ? `set by the ${p.limiting_zone} · 825 A at 20 °C (datasheet)` : ""}
          />
          <KPICard
            label="Export capability, 2 circuits"
            value={p ? p.export_capability_mva.toFixed(0) : "—"}
            unit="MVA"
            trendValue={p ? `${p.export_capability_mva >= 510 ? "✓" : "✗"} 510 MW farm at 220 kV` : ""}
          />
          <KPICard
            label={`Time to 90 °C at ${emergencyA} A`}
            value={t ? (t.allowed_minutes === null ? "> 24 h" : fmtMinutes(t.allowed_minutes)) : "—"}
            trendValue={t?.limiting_zone ? `${t.limiting_zone} first` : t ? "no zone reaches 90 °C" : ""}
          />
        </motion.div>

        <motion.div variants={item}>
          <DTSProfilePanel />
        </motion.div>
        <motion.div variants={item} className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <DTSRatingPanel />
          <DTSTransientPanel />
        </motion.div>
      </motion.div>
    </MotionConfig>
  );
}
