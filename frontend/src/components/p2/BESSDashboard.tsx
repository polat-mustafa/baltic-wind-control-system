/**
 * BESS tab — 50 MW / 200 MWh LFP at the OSS. Pick the frequency event and
 * the battery's duty; FCR, ramp smoothing, ageing and dispatch follow.
 *
 *   controls · KPIs
 *   FCR (frequency | battery power | characteristic)
 *   ramp smoothing | state of health + dispatch
 */

import { useEffect } from "react";
import { motion, MotionConfig } from "framer-motion";

import { bessEducation } from "../../constants/education/p2";
import { FFR_THRESHOLD_HZ, FREQUENCY_EVENTS, type FrequencyEvent, useBESSStore } from "../../store/bessStore";
import { EducationButton } from "../ui/EducationButton";
import { KPICard } from "../ui/KPICard";
import { Slider } from "../ui/Slider";
import BESSDegradationPanel from "./BESSDegradationPanel";
import BESSFrequencyPanel from "./BESSFrequencyPanel";
import BESSRampPanel from "./BESSRampPanel";

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

function DispatchCard() {
  const { dispatch: d, pTargetMw, pAvailableMw, setParams } = useBESSStore();
  const bar = (mw: number) => `${Math.min(100, (Math.abs(mw) / 560) * 100)}%`;
  const rows: [string, number, string][] = d
    ? [
        ["Wind available", pAvailableMw, "bg-text-muted/40"],
        ["Turbines dispatched", d.p_wtg_dispatch_mw, "bg-accent"],
        [d.p_bess_mw >= 0 ? "Battery discharge" : "Battery charge", d.p_bess_mw, d.p_bess_mw >= 0 ? "bg-status-success" : "bg-status-warning"],
        ["POC output", d.p_poc_mw, "bg-accent"],
      ]
    : [];
  return (
    <div className="rounded-lg border border-border-primary bg-bg-secondary p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Meeting a TSO set-point with turbines + battery</h3>
        <EducationButton content={bessEducation} />
      </div>
      <div className="flex flex-wrap gap-4">
        <Slider label="TSO set-point" value={pTargetMw} display={`${pTargetMw} MW`} min={0} max={560} step={5} onChange={(v) => setParams({ pTargetMw: v })} />
        <Slider
          label="Wind available"
          value={pAvailableMw}
          display={`${pAvailableMw} MW`}
          min={0}
          max={510}
          step={5}
          onChange={(v) => setParams({ pAvailableMw: v })}
        />
      </div>
      {d && (
        <>
          <dl className="space-y-1.5 text-xs">
            {rows.map(([label, mw, color]) => (
              <div key={label} className="grid grid-cols-[8.5rem_1fr_4.5rem] items-center gap-2">
                <dt className="text-text-secondary">{label}</dt>
                <div className="relative h-2.5 rounded bg-bg-tertiary">
                  <div className={`h-2.5 rounded ${color} transition-all duration-500`} style={{ width: bar(mw) }} />
                  {label === "POC output" && (
                    <div className="absolute -top-1 h-[18px] w-0.5 bg-status-alarm transition-all duration-500" style={{ left: bar(pTargetMw) }} />
                  )}
                </div>
                <dd className="font-mono text-right text-text-primary">{mw.toFixed(1)} MW</dd>
              </div>
            ))}
          </dl>
          <p className="text-[11px] text-text-muted">
            {d.dispatch_feasible ? "✓" : "✗"} {d.notes}. SOC after one minute {d.soc_after_pct.toFixed(2)} %. The red tick is the set-point.
          </p>
        </>
      )}
    </div>
  );
}

export default function BESSDashboard() {
  const s = useBESSStore();
  const { fcr, ramp, degradation, error, setParams, runFcr, runRamp, runDegradation, runDispatch } = s;
  const { event, fcrCapacityMw, ffrEnabled, initialSocPct, rampLimitMwPerMin, annualCycles, avgDodPct, pTargetMw, pAvailableMw } = s;

  useEffect(() => {
    const id = setTimeout(() => void runFcr(), 250);
    return () => clearTimeout(id);
  }, [event, fcrCapacityMw, ffrEnabled, initialSocPct, runFcr]);
  useEffect(() => {
    const id = setTimeout(() => void runRamp(), 250);
    return () => clearTimeout(id);
  }, [rampLimitMwPerMin, initialSocPct, runRamp]);
  useEffect(() => {
    const id = setTimeout(() => void runDegradation(), 250);
    return () => clearTimeout(id);
  }, [annualCycles, avgDodPct, runDegradation]);
  useEffect(() => {
    const id = setTimeout(() => void runDispatch(), 250);
    return () => clearTimeout(id);
  }, [pTargetMw, pAvailableMw, initialSocPct, runDispatch]);

  return (
    <MotionConfig reducedMotion="user">
      <motion.div className="space-y-4" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }}>
        {error && (
          <div className="p-3 bg-status-alarm/10 border border-status-alarm/30 rounded-lg text-sm flex justify-between">
            <span className="text-status-alarm">{error}</span>
            <button className="text-xs text-text-secondary" onClick={s.clearError}>
              Dismiss
            </button>
          </div>
        )}

        <motion.div variants={item} className="rounded-lg border border-border-primary bg-bg-secondary p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-text-secondary">Frequency event</p>
              <div role="tablist" aria-label="Frequency event" className="flex flex-wrap gap-1">
                {(Object.keys(FREQUENCY_EVENTS) as FrequencyEvent[]).map((e) => (
                  <button
                    key={e}
                    role="tab"
                    aria-selected={event === e}
                    onClick={() => setParams({ event: e })}
                    className={`rounded px-2 py-1 text-[11px] font-medium ${event === e ? "bg-accent text-white" : "text-text-secondary hover:bg-bg-tertiary"}`}
                  >
                    {FREQUENCY_EVENTS[e].label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-text-secondary">
              <input type="checkbox" checked={ffrEnabled} onChange={(e) => setParams({ ffrEnabled: e.target.checked })} className="accent-accent" />
              FFR step below {FFR_THRESHOLD_HZ} Hz (example product, not a PSE service)
            </label>
            <span className="ml-auto">
              <EducationButton content={bessEducation} />
            </span>
          </div>
          <div className="flex flex-wrap gap-4">
            <Slider label="FCR capacity offered" value={fcrCapacityMw} display={`${fcrCapacityMw} MW`} min={5} max={50} step={5} onChange={(v) => setParams({ fcrCapacityMw: v })} />
            <Slider label="Initial SOC" value={initialSocPct} display={`${initialSocPct} %`} min={10} max={90} step={1} onChange={(v) => setParams({ initialSocPct: v })} />
            <Slider
              label="POC ramp limit"
              value={rampLimitMwPerMin}
              display={`${rampLimitMwPerMin} MW/min`}
              min={10}
              max={100}
              step={1}
              onChange={(v) => setParams({ rampLimitMwPerMin: v })}
            />
            <Slider label="Cycles per year" value={annualCycles} display={`${annualCycles}`} min={50} max={700} step={5} onChange={(v) => setParams({ annualCycles: v })} />
            <Slider label="Depth of discharge" value={avgDodPct} display={`${avgDodPct} %`} min={20} max={90} step={5} onChange={(v) => setParams({ avgDodPct: v })} />
          </div>
        </motion.div>

        <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            label="FCR endurance after the event"
            value={fcr ? fcr.fcr_endurance_min.toFixed(0) : "—"}
            unit="min"
            trendValue={fcr ? `${fcr.fcr_endurance_min >= 15 ? "✓" : "✗"} ≥ 15 min at full FCR (SO GL Art. 156)` : ""}
          />
          <KPICard
            label="FCR energy out / in"
            value={fcr ? `${fcr.energy_delivered_mwh.toFixed(2)} / ${fcr.energy_absorbed_mwh.toFixed(2)}` : "—"}
            unit="MWh"
            trendValue={fcr ? `${fcr.time_s.length} s event, ${fcrCapacityMw} MW offered` : ""}
          />
          <KPICard
            label="Ramp violations without → with battery"
            value={ramp ? `${ramp.ramp_violations_before} → ${ramp.ramp_violations_after}` : "—"}
            trendValue={ramp ? `peak ${Math.max(ramp.peak_bess_charge_mw, ramp.peak_bess_discharge_mw).toFixed(1)} of 50 MW` : ""}
          />
          <KPICard
            label="End of life (80 % SOH)"
            value={degradation ? (degradation.eol_reached ? `year ${degradation.eol_year}` : "> 25 y") : "—"}
            trendValue={degradation ? `${degradation.total_cycles_to_eol.toFixed(0)} full cycles` : ""}
          />
        </motion.div>

        <motion.div variants={item}>
          <BESSFrequencyPanel />
        </motion.div>
        <motion.div variants={item} className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <BESSRampPanel />
          <div className="space-y-4">
            <BESSDegradationPanel />
            <DispatchCard />
          </div>
        </motion.div>
      </motion.div>
    </MotionConfig>
  );
}
