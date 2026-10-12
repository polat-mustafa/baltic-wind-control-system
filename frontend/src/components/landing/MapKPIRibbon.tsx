/**
 * KPI strip above the Control Room map — farm-level readings, updated every tick.
 *
 * One row of cells (style board): label, reading, one line of context. Readings
 * stay neutral while normal and take the warning / alarm colour only when a
 * limit is crossed (ISA-101: colour means "look here").
 */

import { useEffect, useRef, useState } from "react";

import { useFleet } from "../../lib/fleet";
import { MODELLED_RATE, TIME_COMPRESSION } from "../../lib/plant/failures";
import { useGridEventSample } from "../../hooks/useGridEventSample";
import type { FarmKPI } from "../../types/landing";
import type { LossBreakdown } from "../../types/grid";
import { gustMs as gustFromMean } from "../../utils/landingPhysics";
import { useLandingStore } from "../../store/landingStore";
import { useLiveGridStore, useStatcomQ } from "../../store/liveGridStore";

interface MapKPIRibbonProps {
  kpis: FarmKPI;
}

const NORMAL = "var(--color-text-primary)";
const WARN = "var(--color-status-warning)";
const ALARM = "var(--color-status-alarm)";

interface CellProps {
  label: string;
  value: string;
  unit: string;
  sub: string;
  color?: string;
  title?: string;
}

function Cell({ label, value, unit, sub, color = NORMAL, title }: CellProps) {
  return (
    <div className="flex min-w-[8.5rem] flex-1 flex-col gap-0.5 border-r border-border-primary px-4 py-2 last:border-r-0" title={title}>
      <span className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">{label}</span>
      <span className="font-mono text-xl font-medium tabular-nums transition-colors duration-700" style={{ color }}>
        {value}
        <span className="ml-1.5 text-xs text-text-muted">{unit}</span>
      </span>
      <span className="truncate text-xs text-text-muted">{sub}</span>
    </div>
  );
}

const FAULT_NOTE = `Turbine faults at offshore failure rates (Carroll et al. 2016: ${MODELLED_RATE.toFixed(1)} stops per turbine per year), time compressed ×${TIME_COMPRESSION}: one 5 s update is one plant hour. Curtailment: live RCE price below zero (PSE).`;

/** " · cables … MW · transformers … MW · other … MW" from the load flow's loss breakdown (empty without one). */
function lossSplit(b: LossBreakdown | undefined): string {
  if (!b) return "";
  const v = (k: keyof LossBreakdown) => b[k] ?? 0;
  const cables = v("export_cable") + v("array_cables");
  const tx = v("oss_transformers") + v("onshore_transformers") + v("wtg_transformers");
  const all = Object.values(b).reduce((a, x) => a + (x ?? 0), 0);
  return ` · cables ${cables.toFixed(1)} MW · transformers ${tx.toFixed(1)} MW · other ${(all - cables - tx).toFixed(1)} MW`;
}

export default function MapKPIRibbon({ kpis: baseKpis }: MapKPIRibbonProps) {
  // During a grid frequency event the ribbon shows the event's frequency.
  const gridEvent = useGridEventSample();
  const kpis =
    gridEvent && gridEvent.s.f !== 50 && !gridEvent.done
      ? { ...baseKpis, gridFrequencyHz: gridEvent.s.f }
      : baseKpis;
  const capacityPct = kpis.capacityFactorPct;
  const fleet = useFleet();
  const alertColor = kpis.activeAlerts === 0 ? NORMAL : kpis.activeAlerts > 3 ? ALARM : WARN;
  const freqColor = Math.abs(kpis.gridFrequencyHz - 50) < 0.05 ? NORMAL : WARN;

  // Q = STATCOM output (+ injecting / − absorbing), coloured by use of its ±120 MVAr.
  // From the backend load flow (pandapower, store/liveGridStore) when it is
  // reachable, else the browser's reactive-balance estimate (labelled "est.").
  const grid = useLiveGridStore((s) => s.result);
  const reactiveQ = Math.round(useStatcomQ(kpis.totalOutputMW).q);
  const reactiveColor = Math.abs(reactiveQ) < 60 ? NORMAL : Math.abs(reactiveQ) < 100 ? WARN : ALARM;

  // The farm wind: hub 150 m freestream — the number the Environment panel and the map show too
  const gustMs = gustFromMean(kpis.freestreamWindMs);
  const weatherSource = useLandingStore((s) => s.weatherSource);
  const live = useLandingStore((s) => s.liveWeather);
  const windSource = weatherSource === "live" ? (live ? "live" : "sim (no live data)") : "sim";
  const gustColor = gustMs > 28 ? ALARM : gustMs > 22 ? WARN : NORMAL;

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
  const dfdtColor = Math.abs(dfdt) > 200 ? ALARM : Math.abs(dfdt) > 100 ? WARN : NORMAL;


  const capacity = fleet.net.total_capacity_mw;
  return (
    <div
      className="flex overflow-x-auto rounded border border-border-primary bg-bg-secondary [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label="Farm readings"
    >
      <Cell
        label="Output"
        value={kpis.totalOutputMW.toFixed(0)}
        unit="MW"
        sub={`of ${capacity.toFixed(0)} MW · CF ${capacityPct.toFixed(1)} %`}
      />
      <Cell
        label="Wind"
        value={kpis.freestreamWindMs.toFixed(1)}
        unit="m/s"
        sub={`${Math.round(kpis.windDirectionDeg)}° · gust ${gustMs.toFixed(1)} · ${windSource}`}
        title={`Freestream wind at hub height 150 m, from ${Math.round(kpis.windDirectionDeg)}° (${windSource}). Mean wind at the rotors after wakes: ${kpis.averageWindSpeedMs.toFixed(1)} m/s`}
        color={gustColor}
      />
      <Cell
        label="Frequency"
        value={kpis.gridFrequencyHz.toFixed(3)}
        unit="Hz"
        sub={`df/dt ${dfdt >= 0 ? "+" : ""}${dfdt.toFixed(0)} mHz/s`}
        color={Math.abs(dfdt) > 100 ? dfdtColor : freqColor}
      />
      <Cell
        label="Q at POC"
        value={`${reactiveQ >= 0 ? "+" : ""}${reactiveQ}`}
        unit="Mvar"
        sub={grid?.converged ? "STATCOM · load flow" : "STATCOM · estimate"}
        color={reactiveColor}
        title={grid?.converged ? "STATCOM set-point from the pandapower load flow (backend)" : "Browser estimate — backend load flow not reachable"}
      />
      <Cell
        label="Availability"
        value={kpis.availabilityPercent.toFixed(1)}
        unit="%"
        sub="time-based, IEC 61400-26"
        color={kpis.availabilityPercent >= 95 ? NORMAL : WARN}
      />
      {grid?.converged && (
        <Cell
          label="Losses"
          value={grid.total_loss_mw.toFixed(1)}
          unit="MW"
          sub={`export cable ${grid.export_cable_loading_pct.toFixed(0)} %`}
          color={grid.voltage_compliant ? NORMAL : ALARM}
          title={`pandapower Newton-Raphson: ${grid.poc_p_mw.toFixed(1)} MW / ${grid.poc_q_mvar.toFixed(1)} MVAr at PSE 400 kV · V_OSS ${grid.v_oss_220_pu.toFixed(3)} pu${lossSplit(grid.loss_breakdown_mw)}`}
        />
      )}
      <Cell
        label="Alerts"
        value={String(kpis.activeAlerts)}
        unit={kpis.activeAlerts === 1 ? "alarm" : "alarms"}
        sub={kpis.activeAlerts === 0 ? "all clear" : "see SCADA alarms"}
        color={alertColor}
        title={FAULT_NOTE}
      />
    </div>
  );
}
