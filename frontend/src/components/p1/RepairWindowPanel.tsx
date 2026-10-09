/**
 * Repair window — when a vessel can next reach a failed turbine and what the
 * repair costs (backend POST /wind/maintenance-scheduling).
 *
 * The farm's O&M port distance by sea (site assessment; SB-510: Ustka 52.5 km)
 * sets the CTV transit: work per day = the 12 h working day (WOMBAT) minus the
 * trip out and back at 37 km/h (20 kn). SOV and jack-up stay offshore.
 */

import { useEffect, useState } from "react";

import { useFarmPlan } from "../../hooks/useFarmPlan";
import { SB510_PORTS } from "../../lib/lifecycle/farm";
import { useModeStore } from "../../store/modeStore";
import { useWeatherWindowStore } from "../../store/weatherWindowStore";
import type { VesselType } from "../../types/weatherWindow";

const VESSELS: [VesselType, string][] = [
  ["CTV", "Crew transfer vessel"],
  ["SOV", "Service operation vessel"],
  ["JACK_UP", "Jack-up (heavy lift)"],
  ["HELICOPTER", "Helicopter"],
];

const COST_LABELS: Record<string, string> = {
  vessel_day_rate_eur: "Vessel",
  mobilisation_eur: "Mobilisation",
  labour_eur: "Technicians",
  parts_eur: "Parts",
};

const today = () => new Date().toISOString().slice(0, 10);
const eur = (v: number) => `${(v / 1000).toLocaleString("en", { maximumFractionDigits: 0 })} k€`;

export default function RepairWindowPanel() {
  const plan = useFarmPlan();
  const own = useModeStore((s) => s.mode === "own");
  const { repair, repairError, findRepairWindow } = useWeatherWindowStore();
  const [vessel, setVessel] = useState<VesselType>("CTV");
  const [date, setDate] = useState(today);
  const [hours, setHours] = useState(8);
  const ids = plan.turbines.map((t) => t.id).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const [turbine, setTurbine] = useState(ids[0] ?? "WTG-01");
  // own project without an assessed port → the backend's SB-510 default, said so below
  const port = plan.omPort ?? (own ? null : SB510_PORTS.om);

  useEffect(() => {
    if (!date || !(hours > 0)) return;
    const t = setTimeout(() => {
      void findRepairWindow({
        failure_date_iso: date,
        vessel_type: vessel,
        repair_duration_hours: hours,
        turbine_id: turbine,
        ...(port ? { port_km: port.km } : {}),
      });
    }, 250);
    return () => clearTimeout(t);
  }, [vessel, date, hours, turbine, port, findRepairWindow]);

  const field = "rounded border border-border-primary bg-bg-tertiary px-2 py-1 text-[12px] text-text-primary";
  return (
    <section className="bg-bg-secondary rounded-lg border border-border-primary p-4" data-tour="repair-window">
      <h3 className="text-base font-semibold text-text-primary">Repair window — next access and cost</h3>
      <p className="mt-1 text-[12px] text-text-muted">
        O&M port {port ? `${port.name}, ${port.km.toFixed(1)} km by sea` : "not assessed — SB-510's Ustka (52.5 km) is used"}.
        A CTV crew works the 12 h day minus the trip out and back; an SOV or jack-up stays offshore.
      </p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-text-muted">
        <label className="flex flex-col gap-0.5">
          Vessel
          <select className={field} value={vessel} onChange={(e) => setVessel(e.target.value as VesselType)}>
            {VESSELS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          Failure date
          <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="flex flex-col gap-0.5">
          Work needed [h]
          <input type="number" min={1} max={720} className={`${field} w-20`} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-0.5">
          Turbine
          <select className={field} value={turbine} onChange={(e) => setTurbine(e.target.value)}>
            {ids.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
      </div>

      {repairError && <p className="mt-3 text-[12px] text-status-alarm">{repairError}</p>}
      {repair && !repairError && (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-4">
          <Stat label="Window opens" value={repair.estimated_window_start_iso} />
          <Stat label="Waiting" value={`${repair.wait_days.toFixed(1)} d`} hint={`${repair.access_probability_pct.toFixed(0)} % of days accessible that month`} />
          <Stat label="Downtime" value={`${repair.total_downtime_days.toFixed(1)} d`} />
          <Stat
            label="Work per day"
            value={`${repair.work_hours_per_day.toFixed(1)} h`}
            hint={repair.transit_hours > 0 ? `${repair.transit_hours.toFixed(1)} h transit each way` : "no transit"}
          />
          <Stat label="Cost estimate" value={eur(repair.cost_estimate_eur)} />
          {Object.entries(repair.cost_breakdown).map(([k, v]) => (
            <Stat key={k} label={COST_LABELS[k] ?? k} value={eur(v)} />
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="py-1">
      <div className="text-xs uppercase tracking-wider text-text-muted">{label}</div>
      <div className="font-mono text-text-primary">{value}</div>
      {hint && <div className="text-xs text-text-muted">{hint}</div>}
    </div>
  );
}
