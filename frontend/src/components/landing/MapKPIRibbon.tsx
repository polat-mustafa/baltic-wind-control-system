/**
 * KPI ribbon — farm-level metrics updated every 3s.
 *
 * Supports two layouts:
 *   horizontal (default): glassmorphic bar across the top of the map
 *   vertical: right sidebar strip (legacy, unused by default)
 *
 * Uses ISA-101 muted colors for control room readability.
 */

import { useEffect, useRef, useState } from "react";

import { useFleet } from "../../lib/fleet";
import { useGridEventSample } from "../../hooks/useGridEventSample";

import type { FarmKPI } from "../../types/landing";
import { Zap, Wind, Gauge, AlertTriangle, Activity, TrendingUp, Sigma, Waves, Tornado } from "lucide-react";
import { cn } from "../../lib/utils";
import { gustMs as gustFromMean } from "../../utils/landingPhysics";
import { useLiveGridStore, useStatcomQ } from "../../store/liveGridStore";

interface MapKPIRibbonProps {
  kpis: FarmKPI;
  horizontal?: boolean;
}

interface KPIItemProps {
  label: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
  color?: string;
  title?: string;
}

function KPIChip({ label, value, unit, icon, color = "#3ecf6e", title }: KPIItemProps) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 px-2 py-1.5" title={title}>
      <span className="text-text-muted">{icon}</span>
      <div className="flex items-baseline gap-1">
        <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium mr-1">{label}</span>
        <span className="text-sm font-bold tabular-nums transition-colors duration-700" style={{ color }}>
          {value}
        </span>
        <span className="text-[9px] text-text-muted">{unit}</span>
      </div>
    </div>
  );
}

export default function MapKPIRibbon({ kpis: baseKpis, horizontal = true }: MapKPIRibbonProps) {
  // During a grid frequency event the ribbon shows the event's frequency.
  const gridEvent = useGridEventSample();
  const kpis =
    gridEvent && gridEvent.s.f !== 50 && !gridEvent.done
      ? { ...baseKpis, gridFrequencyHz: gridEvent.s.f }
      : baseKpis;
  const capacityPct = kpis.capacityFactorPct;
  const fleet = useFleet();
  // Capacity factor is weather, not a fault — informational blue at any value
  // (ISA-101: reserve amber/red for abnormal states).
  const capacityColor = "#3b82f6";
  const alertColor = kpis.activeAlerts === 0 ? "#3ecf6e" : kpis.activeAlerts > 3 ? "#ef4444" : "#f5a623";
  const freqColor = Math.abs(kpis.gridFrequencyHz - 50) < 0.05 ? "#3ecf6e" : "#f5a623";

  // Q = STATCOM output (+ injecting / − absorbing), coloured by use of its ±120 MVAr.
  // From the backend load flow (pandapower, store/liveGridStore) when it is
  // reachable, else the browser's reactive-balance estimate (labelled "est.").
  const grid = useLiveGridStore((s) => s.result);
  const reactiveQ = Math.round(useStatcomQ(kpis.totalOutputMW).q);
  const reactiveColor = Math.abs(reactiveQ) < 60 ? "#3ecf6e" : Math.abs(reactiveQ) < 100 ? "#f5a623" : "#ef4444";

  const gustMs = gustFromMean(kpis.averageWindSpeedMs);
  const gustColor = gustMs > 28 ? "#ef4444" : gustMs > 22 ? "#f5a623" : "#3ecf6e";

  // df/dt — frequency rate of change in mHz/s. Derived by tracking the
  // previous gridFrequencyHz value across renders. ENTSO-E NC RfG limit is
  // ±200 mHz/s for Type D; we colour-code amber > 100, red > 200.
  const prevFreq = useRef(kpis.gridFrequencyHz);
  const prevTime = useRef(Date.now());
  const [dfdt, setDfdt] = useState(0);
  useEffect(() => {
    const now = Date.now();
    const dt = (now - prevTime.current) / 1000;
    if (dt > 0.1) {
      const rate = ((kpis.gridFrequencyHz - prevFreq.current) / dt) * 1000; // mHz/s
      // Smooth via simple low-pass to reduce jitter from 3s tick
      setDfdt((d) => d * 0.6 + rate * 0.4);
      prevFreq.current = kpis.gridFrequencyHz;
      prevTime.current = now;
    }
  }, [kpis.gridFrequencyHz]);
  const dfdtColor = Math.abs(dfdt) > 200 ? "#ef4444" : Math.abs(dfdt) > 100 ? "#f5a623" : "#3ecf6e";

  if (!horizontal) {
    // Legacy vertical layout (kept for backward compatibility)
    return (
      <div className="flex flex-col bg-bg-secondary border border-border-primary rounded-lg overflow-hidden h-full">
        <div className="px-3 py-2 border-b border-border-primary bg-bg-tertiary">
          <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Live KPIs</span>
        </div>
        <div className="flex-1 overflow-y-auto text-sm">
          <div className="px-3 py-2 border-b border-border-primary">
            <span className="text-text-muted text-[10px]">Total Output</span>
            <div className="font-bold tabular-nums transition-colors duration-700" style={{ color: "#3ecf6e" }}>
              {kpis.totalOutputMW.toFixed(0)} <span className="text-[10px] text-text-muted">MW / {fleet.net.total_capacity_mw.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Horizontal glassmorphic bar
  return (
    <div
      className={cn(
        // One swipeable row below xl; wraps (max. 2 rows) on wide screens
        "flex items-center justify-between gap-y-0.5 overflow-x-auto xl:flex-wrap xl:overflow-visible",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "bg-bg-secondary/80 backdrop-blur-md border-b border-border-primary",
        "rounded-b-lg mx-2 sm:mx-12 shadow-lg shadow-black/20",
        "pointer-events-auto",
      )}
    >
      <KPIChip
        label="Output"
        value={kpis.totalOutputMW.toFixed(0)}
        unit="MW"
        icon={<Zap size={12} />}
        color="#3ecf6e"
      />
      <KPIChip
        label="Wind"
        value={kpis.averageWindSpeedMs.toFixed(1)}
        unit="m/s"
        icon={<Wind size={12} />}
        color="#3b82f6"
      />
      <KPIChip
        label="Avail"
        value={kpis.availabilityPercent.toFixed(1)}
        unit="%"
        icon={<Gauge size={12} />}
        color={kpis.availabilityPercent >= 95 ? "#3ecf6e" : "#f5a623"}
      />
      <KPIChip
        label="Alerts"
        value={String(kpis.activeAlerts)}
        unit={kpis.activeAlerts === 1 ? "alarm" : "alarms"}
        icon={<AlertTriangle size={12} />}
        color={alertColor}
      />

      {/* Capacity factor with mini bar */}
      <div className="flex shrink-0 items-center gap-2 px-3 py-1.5">
        <span className="text-text-muted"><TrendingUp size={12} /></span>
        <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">CF</span>
        <div className="w-16 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(capacityPct, 100)}%`, backgroundColor: capacityColor }}
          />
        </div>
        <span className="text-xs font-bold tabular-nums transition-colors duration-700" style={{ color: capacityColor }}>
          {capacityPct.toFixed(1)}%
        </span>
      </div>

      <KPIChip
        label="Freq"
        value={kpis.gridFrequencyHz.toFixed(3)}
        unit="Hz"
        icon={<Activity size={12} />}
        color={freqColor}
      />
      <KPIChip
        label="df/dt"
        value={`${dfdt >= 0 ? "+" : ""}${dfdt.toFixed(0)}`}
        unit="mHz/s"
        icon={<Sigma size={12} />}
        color={dfdtColor}
      />
      <KPIChip
        label="Q"
        value={`${reactiveQ >= 0 ? "+" : ""}${reactiveQ}`}
        unit={grid?.converged ? "MVAr" : "MVAr est."}
        icon={<Waves size={12} />}
        color={reactiveColor}
        title={grid?.converged ? "STATCOM set-point from the pandapower load flow (backend)" : "Browser estimate — backend load flow not reachable"}
      />
      {grid?.converged && (
        <KPIChip
          label="Loss"
          value={grid.total_loss_mw.toFixed(1)}
          unit="MW"
          icon={<Zap size={12} />}
          color={grid.voltage_compliant ? "#3ecf6e" : "#ef4444"}
          title={`pandapower Newton-Raphson: ${grid.poc_p_mw.toFixed(1)} MW / ${grid.poc_q_mvar.toFixed(1)} MVAr at PSE 400 kV · V_OSS ${grid.v_oss_220_pu.toFixed(3)} pu · export cable ${grid.export_cable_loading_pct.toFixed(0)} %`}
        />
      )}
      <KPIChip
        label="Gust"
        value={gustMs.toFixed(1)}
        unit="m/s"
        icon={<Tornado size={12} />}
        color={gustColor}
      />
    </div>
  );
}
