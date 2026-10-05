/**
 * Fleet KPIs — each figure states what it is judged against.
 */

import { Activity, Gauge, ShieldAlert, Stethoscope, Zap } from "lucide-react";

import { useDigitalTwinStore } from "../../store/digitalTwinStore";
import { InfoTile, type TilePriority } from "../ui/InfoTile";
import { formatHours } from "./twinFormat";

export default function FleetKPIs() {
  const analysis = useDigitalTwinStore((s) => s.analysis);
  if (!analysis) return null;
  const { farm, validation } = analysis;

  const hiPriority: TilePriority =
    farm.min_health_index < 40 ? "alarm" : farm.min_health_index < 70 ? "warning" : "normal";
  const statusPriority: TilePriority =
    farm.alarm_count > 0 ? "alarm" : farm.alert_count > 0 ? "warning" : "normal";

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      <InfoTile
        label="Fleet health index"
        value={farm.fleet_health_index.toFixed(1)}
        unit="/ 100"
        priority={hiPriority}
        icon={<Activity size={14} />}
        subtitle={`weakest turbine ${farm.min_health_index.toFixed(1)} · alert < 70, alarm < 40`}
      />
      <InfoTile
        label="Turbine states now"
        value={`${farm.normal_count} · ${farm.alert_count} · ${farm.alarm_count}`}
        priority={statusPriority}
        icon={<ShieldAlert size={14} />}
        subtitle={`normal · alert · alarm — ${farm.active_events} active events`}
      />
      <InfoTile
        label="Identified faults"
        value={farm.diagnosed_count}
        unit={farm.diagnosed_count === 1 ? "turbine" : "turbines"}
        priority={farm.diagnosed_count > 0 ? "warning" : "normal"}
        icon={<Stethoscope size={14} />}
        subtitle={`${farm.total_events} events in ${analysis.duration_days} d`}
      />
      <InfoTile
        label="Energy vs twin potential"
        value={farm.energy_performance_pct.toFixed(2)}
        unit="%"
        icon={<Zap size={14} />}
        subtitle={`${farm.lost_energy_mwh.toFixed(0)} MWh lost to identified faults`}
      />
      <InfoTile
        label="Detection vs ground truth"
        value={
          validation.injected > 0
            ? `${validation.isolated} / ${validation.injected}`
            : `${validation.false_events}`
        }
        unit={validation.injected > 0 ? "isolated" : "false events"}
        priority={
          validation.injected > 0 && validation.isolated < validation.injected ? "warning" : "normal"
        }
        icon={<Gauge size={14} />}
        subtitle={
          validation.injected > 0
            ? `detected ${validation.detected}/${validation.injected} · mean delay ${formatHours(validation.mean_delay_hours)} · ${validation.false_events} false`
            : "fault-free run: every event is a false alarm"
        }
      />
    </div>
  );
}
