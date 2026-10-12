/**
 * IEC 60287 rating of each export route section (GET /grid/cable/route-rating):
 * J-tube, subsea, HDD landfall and land cable rate differently — the route is only
 * as good as its hottest section. Below: the landfall HDD design options and each
 * section's conductor temperature through the 30-year hindcast at full-farm current.
 */

import { useStudy } from "../../hooks/useStudy";
import { getRouteRating } from "../../services/cableDtsApi";
import { Stat, StudyError, StudyLoading, StudyNote, Verdict } from "../ui/StudyBits";

/** Installation kinds as the backend names them (cable_rating.Installation.kind). */
const INSTALL: Record<string, string> = {
  jtube: "J-tube in air, full sun",
  buried: "buried in the seabed",
  duct: "water-filled duct in grout",
  trefoil: "trefoil, direct buried",
};

export default function RouteRatingPanel() {
  const { data: r, error, loading } = useStudy(getRouteRating, []);
  const limiting = r?.sections.reduce((a, s) => (s.rating_a < a.rating_a ? s : a), r.sections[0]);
  const hottest = r?.load_profile.reduce((a, s) => (s.peak_conductor_c > a.peak_conductor_c ? s : a), r.load_profile[0]);
  const okProfile = r ? r.load_profile.every((p) => p.hours_above_90c === 0) : false;

  return (
    <section className="rounded-lg border border-border-primary bg-bg-secondary p-4 space-y-3" aria-label="IEC 60287 rating per route section">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-primary">Route rating — IEC 60287 per section of one export circuit</h3>
        {r && <Verdict ok={okProfile} yes="≤ 90 °C over 30 years" no="above 90 °C in the hindcast" />}
        {loading && !r && <StudyLoading />}
      </div>
      {error && <StudyError error={error} />}
      {r && limiting && hottest && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Stat label="Limiting section" value={`${limiting.rating_a.toFixed(0)}`} unit="A" sub={<span translate="no">{limiting.section}</span>} />
            <Stat label="Datasheet rating" value={r.datasheet_rating_a.toFixed(0)} unit="A" />
            <Stat label="Hottest conductor, 30-year hindcast" value={hottest.peak_conductor_c.toFixed(1)} unit="°C" tone={hottest.peak_conductor_c <= 90 ? "ok" : "bad"} sub={<span translate="no">{hottest.section}</span>} />
            <Stat
              label="Method check: CIGRE TB 880 case 0-1"
              value={`${r.verification.rating_a.toFixed(0)} / ${r.verification.reference_a.toFixed(0)}`}
              unit="A"
            />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-text-muted">
                    <th className="py-1 pr-2 font-medium">Section</th>
                    <th className="py-1 pr-2 font-medium">Installation</th>
                    <th className="py-1 pr-2 text-right font-medium">Ambient [°C]</th>
                    <th className="py-1 pr-2 text-right font-medium">Rating [A]</th>
                    <th className="py-1 pr-2 text-right font-medium">Peak, 30 yr [°C]</th>
                    <th className="py-1 text-right font-medium">h &gt; 90 °C</th>
                  </tr>
                </thead>
                <tbody>
                  {r.sections.map((s) => {
                    const p = r.load_profile.find((x) => x.section === s.section);
                    return (
                      <tr key={s.section} className="border-t border-border-primary text-text-secondary">
                        <td className="py-1 pr-2" translate="no" title={s.cable}>
                          {s.section}
                        </td>
                        <td className="py-1 pr-2">{INSTALL[s.installation] ?? s.installation}</td>
                        <td className="py-1 pr-2 text-right font-mono">{s.ambient_c.toFixed(0)}</td>
                        <td className={`py-1 pr-2 text-right font-mono ${s === limiting ? "text-text-primary font-semibold" : ""}`}>{s.rating_a.toFixed(0)}</td>
                        <td className="py-1 pr-2 text-right font-mono">{p ? p.peak_conductor_c.toFixed(1) : "—"}</td>
                        <td className="py-1 text-right font-mono">{p ? p.hours_above_90c.toFixed(0) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-text-secondary">Landfall HDD design options (12 m deep)</p>
              <table className="w-full text-xs">
                <tbody>
                  {r.hdd_options.map((o) => (
                    <tr key={o.option} className="border-t border-border-primary text-text-secondary">
                      <td className="py-1 pr-2" translate="no">{o.option}</td>
                      <td className="py-1 text-right font-mono">{o.rating_a.toFixed(0)} A</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <StudyNote
            items={[
              `IEC 60287-1-1 / -2-1 steady-state rating per section; export cable T2 calibrated to the datasheet (${r.calibrated_t2_k_m_w} K·m/W); verified against ${r.verification.case}. Load profile: full-farm current through the 30-year wind hindcast with each section's thermal time constant.`,
            ]}
          />
        </>
      )}
    </section>
  );
}
