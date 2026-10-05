/**
 * Flicker at the POC against the IEC 61000-3-7 planning levels, and a
 * single-tuned filter calculator at OSS 66 kV rated against the network's
 * own harmonic impedance.
 */

import { useEffect } from "react";

import { powerQualityEducation } from "../../constants/education/p2";
import { usePowerQualityStore } from "../../store/powerQualityStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { EducationButton } from "../ui/EducationButton";

function Meter({ label, value, limit }: { label: string; value: number; limit: number }) {
  const pct = Math.min(100, (value / limit) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-text-secondary">{label}</span>
        <span className="font-mono text-text-primary">
          {value.toFixed(4)} <span className="text-text-muted">/ {limit}</span>
        </span>
      </div>
      <div className="mt-1 h-2 rounded bg-bg-tertiary overflow-hidden">
        <div className="h-2 rounded bg-accent transition-all duration-700" style={{ width: `${Math.max(pct, 0.8)}%` }} />
      </div>
    </div>
  );
}

const ORDERS = [5, 7, 11, 13, 17, 19];

export default function FlickerFilterPanel() {
  const { flicker, filterDesign, filterOrder, filterMvar, setFilterOrder, setFilterMvar, runFilter } = usePowerQualityStore();

  useEffect(() => {
    const t = setTimeout(() => void runFilter(), 250);
    return () => clearTimeout(t);
  }, [filterOrder, filterMvar, runFilter]);

  return (
    <ChartWrapper title="Flicker and a harmonic filter" headerRight={<EducationButton content={powerQualityEducation} />}>
      {flicker && (
        <div className="space-y-3">
          <Meter label="P_st (short-term)" value={flicker.pst} limit={flicker.pst_limit} />
          <Meter label="P_lt (long-term)" value={flicker.plt} limit={flicker.plt_limit} />
          <p className="text-[11px] text-text-muted">
            {flicker.pst_compliant && flicker.plt_compliant ? "✓" : "✗"} IEC 61000-3-7 HV-EHV planning levels. Continuous operation{" "}
            {flicker.pst_continuous.toFixed(4)}, switching {flicker.pst_switching.toFixed(4)} (c = {flicker.flicker_coefficient}, k_f ={" "}
            {flicker.switching_coefficient} — illustrative full-converter values). Full converters on a strong grid barely flicker.
          </p>
        </div>
      )}
      <div className="mt-4 border-t border-border-primary pt-3 space-y-2">
        <p className="text-xs font-semibold text-text-secondary">Single-tuned filter at OSS 66 kV</p>
        <div className="flex flex-wrap items-end gap-3">
          <div role="tablist" aria-label="Filter order" className="flex gap-1">
            {ORDERS.map((h) => (
              <button
                key={h}
                role="tab"
                aria-selected={filterOrder === h}
                onClick={() => setFilterOrder(h)}
                className={`rounded px-2 py-1 text-[11px] font-medium ${filterOrder === h ? "bg-accent text-white" : "text-text-secondary hover:bg-bg-tertiary"}`}
              >
                h{h}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-0.5 text-[11px] text-text-muted min-w-[9rem] flex-1">
            <span className="flex justify-between">
              Capacitor bank <span className="font-mono text-text-primary">{filterMvar} MVAR</span>
            </span>
            <input type="range" min={2} max={40} step={1} value={filterMvar} onChange={(e) => setFilterMvar(Number(e.target.value))} className="accent-accent" />
          </label>
        </div>
        {filterDesign && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <dt className="text-text-muted">Tuned to</dt>
            <dd className="font-mono text-right">{filterDesign.tuned_frequency_hz.toFixed(1)} Hz</dd>
            <dt className="text-text-muted">C / L per phase</dt>
            <dd className="font-mono text-right">
              {filterDesign.capacitor_uf.toFixed(2)} µF / {filterDesign.reactor_mh.toFixed(2)} mH
            </dd>
            <dt className="text-text-muted">Network |Z| at h{filterDesign.harmonic_order}</dt>
            <dd className="font-mono text-right">{filterDesign.network_impedance_ohm.toFixed(1)} Ω</dd>
            <dt className="text-text-muted">Attenuation</dt>
            <dd className="font-mono text-right">{filterDesign.insertion_loss_db.toFixed(1)} dB</dd>
            <dt className="text-text-muted">50 Hz reactive power</dt>
            <dd className="font-mono text-right">+{filterDesign.reactive_contribution_mvar.toFixed(1)} MVAR</dd>
            <dd className="col-span-2 text-[11px] text-text-secondary">{filterDesign.assessment}</dd>
          </dl>
        )}
        <p className="text-[11px] text-text-muted">
          A filter adds capacitance — it shifts the other resonances; a real design re-runs the scan with the filter in.
        </p>
      </div>
    </ChartWrapper>
  );
}
