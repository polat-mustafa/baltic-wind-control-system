/**
 * Earth fault on a 66 kV string feeder (GET /grid/protection/earth-fault).
 *
 * The array is earthed through a neutral earthing resistor (NER), so a phase-earth
 * fault draws a few hundred amperes, not kiloamperes: the phase overcurrent relays do
 * not see it. A residual stage (51N) on each feeder's core-balance CT trips it, a
 * slower one on the NER / incomer backs it up. Its pickup must stay above the
 * capacitive current a healthy feeder feeds into a fault elsewhere (no sympathetic
 * trip) and below the fault current, which falls as the fault resistance rises.
 */

import { useState } from "react";

import { useStudy } from "../../hooks/useStudy";
import { getEarthFaultStudy } from "../../services/protectionApi";
import { Slider } from "../ui/Slider";
import { Check, Stat, StudyError, StudyLoading, StudyNote, Verdict } from "../ui/StudyBits";

const METHOD =
  "IEC 60909 single-line-to-earth currents (pandapower, c_max 1.10 / c_min 1.00) at the OSS 66 kV bus; definite-time residual stages per IEC 60255-151; fault current with resistance I = 3·U0 / (|Z1 + Z2 + Z0| + 3·R_f).";

export default function EarthFaultPanel() {
  const [rf, setRf] = useState(0);
  const { data: s, error, loading } = useStudy(() => getEarthFaultStudy(rf), [rf], 250);
  const feeder = s?.settings[0];
  const maxIc = s ? Math.max(...s.healthy_feeder_capacitive_a) : 0;

  return (
    <section className="rounded-lg border border-border-primary bg-bg-secondary p-4 space-y-3" aria-label="Earth fault on a 66 kV string feeder">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-primary">Earth fault on a 66 kV string feeder — resistance-earthed array</h3>
        {s && <Verdict ok={s.assessment === "PASS"} yes="PASS" no="FAIL" />}
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <Slider label="Fault resistance R_f" value={rf} display={`${rf} Ω`} min={0} max={300} step={5} onChange={setRf} />
        {loading && <StudyLoading />}
      </div>
      {error && <StudyError error={error} />}
      {s && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Stat label="Ik1'' max / min (IEC 60909)" value={`${s.ik1_max_ka.toFixed(2)} / ${s.ik1_min_ka.toFixed(2)}`} unit="kA" />
            <Stat label="Fault current at this R_f" value={s.fault_current_a.toFixed(0)} unit="A" />
            <Stat label="Neutral earthing resistor" value={s.ner_ohm.toFixed(1)} unit="Ω" />
            <Stat label="Highest R_f the feeder stage detects" value={s.max_detectable_resistance_ohm.toFixed(0)} unit="Ω" tone={rf <= s.max_detectable_resistance_ohm ? "ok" : "bad"} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-text-muted">
                  <th className="py-1 pr-2 font-medium">Stage</th>
                  <th className="py-1 pr-2 font-medium">Setting</th>
                  <th className="py-1 pr-2 text-right font-medium">Pickup [A]</th>
                  <th className="py-1 text-right font-medium">Delay [s]</th>
                </tr>
              </thead>
              <tbody>
                {s.settings.map((st) => (
                  <tr key={st.setting_id} className="border-t border-border-primary text-text-secondary">
                    <td className="py-1 pr-2 font-mono" translate="no">{st.setting_id}</td>
                    <td className="py-1 pr-2" translate="no">{st.description}</td>
                    <td className="py-1 pr-2 text-right font-mono">{st.pickup_a.toFixed(0)}</td>
                    <td className="py-1 text-right font-mono">{st.time_delay_s.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="space-y-1.5 text-xs text-text-secondary">
              <Check pass={s.relay_sequence[0]?.operated ?? false}>
                <span>Feeder stage picks up the fault</span>{" "}
                <span translate="no" className="font-mono">({s.fault_current_a.toFixed(0)} A ≥ {feeder?.pickup_a.toFixed(0)} A)</span>
              </Check>
              <Check pass={s.selective}>
                <span>Backup grades behind the feeder stage (≥ 300 ms)</span>{" "}
                <span translate="no" className="font-mono">{s.backup_margin_ms == null ? "—" : `${s.backup_margin_ms.toFixed(0)} ms`}</span>
              </Check>
              <Check pass={s.no_sympathetic_trip}>
                <span>No sympathetic trip: pickup ≥ 1.3 × a healthy feeder's capacitive current</span>{" "}
                <span translate="no" className="font-mono">({maxIc.toFixed(1)} A)</span>
              </Check>
              <Check pass={s.ner_within_rating}>NER cleared within its 10 s short-time rating</Check>
            </ul>
          </div>
          <StudyNote items={[METHOD]} />
        </>
      )}
    </section>
  );
}
