/**
 * Level-1 plant overview banner — always visible across all areas/sub-tabs.
 *
 * ISA-101 / ASM Consortium L1 display: situational awareness at a glance,
 * with operator-relevant status indicators (production, quality, safety,
 * systemic alarms). No drill-down here — that's L2/L3.
 *
 * Layout (left → right):
 *   plant identity · UTC clock · MW/MVAr/Hz/V mini-tiles · turbines online ·
 *   alarm priority chips · standards strip
 */

import { useEffect, useMemo, useState } from "react";

import { useScadaStore } from "../../store/scadaStore";

const PLANT_NAME = "Baltic Wind 510 MW";
const TURBINE_COUNT = 34;
const NOMINAL_FREQ_HZ = 50.0;
const NOMINAL_400KV = 400.0;

function useUtcClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

interface MetricProps {
  label: string;
  value: string;
  unit?: string;
  outOfBand?: boolean;
}

function Metric({ label, value, unit, outOfBand }: MetricProps) {
  return (
    <div className="flex flex-col px-3 py-1 border-l border-border-primary first:border-l-0">
      <span className="text-[9px] uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span
          className={`font-mono font-semibold tabular-nums text-base leading-none ${
            outOfBand ? "text-status-warning" : "text-text-primary"
          }`}
        >
          {value}
        </span>
        {unit && (
          <span className="text-[10px] text-text-muted">{unit}</span>
        )}
      </div>
    </div>
  );
}

export default function PlantOverviewBar() {
  const measurements = useScadaStore((s) => s.measurements);
  const alarms = useScadaStore((s) => s.alarms);
  const breakerStates = useScadaStore((s) => s.breakerStates);
  const now = useUtcClock();

  // Plant totals — sum the three busbar measurements as a proxy aggregate.
  const m400 = measurements.find((m) => m.nodeId === "bb-400kv");
  const m220 = measurements.find((m) => m.nodeId === "bb-220kv");
  const m66 = measurements.find((m) => m.nodeId === "bb-66kv");

  const plantMW = m400?.powerMW ?? m220?.powerMW ?? m66?.powerMW ?? 0;
  const plantV = m400?.voltageKV ?? NOMINAL_400KV;
  // Light derived numbers (mock) — Q drawn from 400 kV current/V relationship,
  // frequency stays at nominal with small jitter.
  const plantQ = useMemo(() => Math.round(((m400?.currentA ?? 420) - 400) / 4), [m400]);
  const plantHz = useMemo(
    () => NOMINAL_FREQ_HZ + (Math.sin(now.getTime() / 7000) * 0.025),
    [now],
  );

  // Turbines online — derived from string breaker states (cb-str1 … cb-str6).
  // Each string carries 5–6 turbines; if breaker tripped, mark string offline.
  const stringsOpen = useMemo(() => {
    const ids = ["cb-str1","cb-str2","cb-str3","cb-str4","cb-str5","cb-str6"];
    return ids.filter((id) => breakerStates[id] && breakerStates[id] !== "CLOSED").length;
  }, [breakerStates]);
  const turbinesOnline = Math.max(0, TURBINE_COUNT - stringsOpen * 6);

  // Alarm tape — counts by priority and active state only.
  const active = alarms.filter((a) => a.state === "ACTIVE");
  const p1 = active.filter((a) => a.priority === "CRITICAL").length;
  const p2 = active.filter((a) => a.priority === "HIGH").length;
  const p3 = active.filter((a) => a.priority === "MEDIUM").length;

  // Out-of-band detection (mock thresholds): freq must stay within ±200 mHz
  // of 50 Hz per ENTSO-E NC RfG; voltage within ±5% of nominal.
  const freqOOB = Math.abs(plantHz - NOMINAL_FREQ_HZ) > 0.2;
  const voltOOB = Math.abs(plantV - NOMINAL_400KV) > NOMINAL_400KV * 0.05;

  const utc = `${now.toISOString().slice(0, 10)} ${now.toISOString().slice(11, 19)}Z`;

  return (
    <div className="flex items-stretch bg-bg-tertiary border-b-2 border-border-secondary">
      {/* Plant identity + clock */}
      <div className="flex flex-col justify-center px-4 py-1.5 border-r border-border-primary min-w-[180px]">
        <span className="text-[10px] uppercase tracking-widest text-text-muted">
          Plant Overview
        </span>
        <span className="text-xs font-semibold text-text-primary leading-tight">
          {PLANT_NAME}
        </span>
        <span className="text-[10px] font-mono text-text-secondary tabular-nums">
          {utc}
        </span>
      </div>

      {/* Production / electrical metrics */}
      <div className="flex items-center flex-1 min-w-0 overflow-x-auto">
        <Metric label="P" value={plantMW.toFixed(0)} unit="MW" />
        <Metric
          label="Q"
          value={(plantQ >= 0 ? "+" : "") + plantQ.toString()}
          unit="MVAr"
        />
        <Metric
          label="f"
          value={plantHz.toFixed(3)}
          unit="Hz"
          outOfBand={freqOOB}
        />
        <Metric
          label="V₄₀₀"
          value={plantV.toFixed(1)}
          unit="kV"
          outOfBand={voltOOB}
        />
        <Metric
          label="Turbines"
          value={`${turbinesOnline}/${TURBINE_COUNT}`}
          outOfBand={turbinesOnline < TURBINE_COUNT}
        />
      </div>

      {/* Alarm tape — Priority chips. Color is preserved INTENTIONALLY; this
          is the one place vivid colour carries meaning per ISA-101. */}
      <div className="flex items-center gap-1.5 px-3 border-l border-border-primary">
        <span className="text-[9px] uppercase tracking-wider text-text-muted">
          Alarms
        </span>
        <span
          data-priority="P1"
          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tabular-nums ${
            p1 > 0 ? "" : "opacity-30"
          } ${p1 > 0 ? "animate-pulse" : ""}`}
        >
          {p1.toString().padStart(2, "0")} P1
        </span>
        <span
          data-priority="P2"
          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tabular-nums ${
            p2 > 0 ? "" : "opacity-30"
          }`}
        >
          {p2.toString().padStart(2, "0")} P2
        </span>
        <span
          data-priority="P3"
          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tabular-nums ${
            p3 > 0 ? "" : "opacity-30"
          }`}
        >
          {p3.toString().padStart(2, "0")} P3
        </span>
      </div>

      {/* Standards strip — quietest possible */}
      <div className="hidden xl:flex items-center px-3 border-l border-border-primary">
        <span className="text-[9px] font-mono text-text-muted">
          ISA-101 · ISA-18.2 · IEC 61850 · IEC 62443
        </span>
      </div>
    </div>
  );
}
