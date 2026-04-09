/**
 * Flicker + Filter Design Panel — M06 Power Quality.
 *
 * Left: PST/PLT flicker KPIs vs IEC 61000-3-7 limits.
 * Right: Passive LC filter design output (if analysis was run).
 * 66 kV is IEC HV tier (≥35 kV) — Pst ≤ 1.0, Plt ≤ 0.65.
 */

import { usePowerQualityStore } from "../../store/powerQualityStore";
import { InfoButton } from "../ui/InfoButton";
import { flickerFilterInfo } from "../../constants/panelInfo";

function KPI({ label, value, limit, unit }: { label: string; value: number; limit: number; unit: string }) {
  const ok = value <= limit;
  return (
    <div className="bg-bg-tertiary rounded-lg p-3">
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className={`text-xl font-bold font-mono ${ok ? "text-status-success" : "text-status-alarm"}`}>
        {value.toFixed(2)} <span className="text-sm font-normal">{unit}</span>
      </p>
      <p className="text-xs text-text-muted mt-1">
        Limit: {limit.toFixed(2)} — {ok ? "Compliant ✓" : "Exceeds limit ✗"}
      </p>
    </div>
  );
}

export default function FlickerFilterPanel() {
  const { flicker, filterDesign } = usePowerQualityStore();

  if (!flicker) {
    return (
      <div className="flex items-center justify-center h-48 text-text-muted text-sm">
        Run analysis to see flicker results
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">Flicker Emission (IEC 61000-3-7)</h3>
        <InfoButton info={flickerFilterInfo} />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <KPI label="Short-term flicker Pst" value={flicker.pst} limit={flicker.pst_limit} unit="" />
        <KPI label="Long-term flicker Plt" value={flicker.plt} limit={flicker.plt_limit} unit="" />
      </div>

      <p className="text-xs text-text-muted mb-4">{flicker.assessment}</p>

      {filterDesign && (
        <>
          <h3 className="text-sm font-semibold text-text-primary mb-2">
            Passive Filter — H{filterDesign.harmonic_order} ({filterDesign.tuned_frequency_hz.toFixed(0)} Hz)
          </h3>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[
              { label: "Capacitor", value: `${filterDesign.capacitor_mvar.toFixed(1)} MVAR`, sub: `${filterDesign.capacitor_uf.toFixed(1)} µF` },
              { label: "Reactor", value: `${filterDesign.reactor_mh.toFixed(1)} mH`, sub: `Q = ${filterDesign.quality_factor.toFixed(0)}` },
              { label: "Insertion loss", value: `${filterDesign.insertion_loss_db.toFixed(1)} dB`, sub: `${filterDesign.estimated_loss_kw.toFixed(0)} kW loss` },
            ].map(({ label, value, sub }) => (
              <div key={label} className="bg-bg-tertiary rounded p-2">
                <p className="text-text-muted mb-0.5">{label}</p>
                <p className="font-mono font-semibold text-text-primary">{value}</p>
                <p className="text-text-muted">{sub}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-text-muted bg-bg-tertiary rounded p-2">
            {filterDesign.assessment}
          </p>
        </>
      )}
    </div>
  );
}
