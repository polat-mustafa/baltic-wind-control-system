/**
 * Level-1 plant overview banner — always visible across all areas/sub-tabs.
 *
 * ISA-101 / ASM Consortium L1 display: situational awareness at a glance.
 * Every number comes from usePlantSnapshot() — the same state the mimic and
 * the single-line diagram draw — so the three can never disagree.
 *
 *   identity · UTC · P/Q/U at the PSE 400 kV POC · f · losses · WTGs online ·
 *   alarm priority chips (click → alarm list)
 */

import { useEffect, useState, type ReactNode } from "react";

import { useScadaStore } from "../../store/scadaStore";
import { usePlantSnapshot } from "../../store/liveGridStore";
import { useFleet } from "../../lib/fleet";
import { cn } from "../../lib/utils";
/** PSE operating band at the 400 kV POC: 380–420 kV (±5 %). */
const V_POC_MIN_KV = 380;
const V_POC_MAX_KV = 420;
/** Normal CE frequency band ±50 mHz; beyond it reserves (FCR) are deploying. */
const F_NORMAL_BAND_HZ = 0.05;

function useUtcClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

interface MetricProps {
  label: ReactNode;
  value: string;
  unit?: string;
  outOfBand?: boolean;
  title?: string;
}

function Metric({ label, value, unit, outOfBand, title }: MetricProps) {
  return (
    <div className="flex flex-col justify-center px-3 border-l border-border-primary first:border-l-0" title={title}>
      <span className="text-xs uppercase tracking-wider text-text-muted whitespace-nowrap">{label}</span>
      <span className="flex items-baseline gap-1 whitespace-nowrap">
        <span
          className={cn(
            "font-mono font-semibold tabular-nums text-[15px] leading-tight",
            outOfBand ? "text-status-warning" : "text-text-primary",
          )}
        >
          {value}
        </span>
        {unit && <span className="text-xs text-text-muted">{unit}</span>}
      </span>
    </div>
  );
}

const CHIPS = [
  { key: "CRITICAL", label: "P1", attr: "P1" },
  { key: "HIGH", label: "P2", attr: "P2" },
  { key: "MEDIUM", label: "P3", attr: "P3" },
] as const;

export default function PlantOverviewBar({ trailing }: { trailing?: ReactNode }) {
  const fleet = useFleet();
  const TURBINE_COUNT = fleet.turbines.length;
  const alarms = useScadaStore((s) => s.alarms);
  const setArea = useScadaStore((s) => s.setArea);
  const setSubTab = useScadaStore((s) => s.setSubTab);
  const plant = usePlantSnapshot();
  const now = useUtcClock();

  const active = alarms.filter((a) => a.state === "ACTIVE" && !a.shelved);
  const utc = `${now.toISOString().slice(0, 10)} ${now.toISOString().slice(11, 19)} UTC`;
  const signed = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(0)}`;

  return (
    <div
      className="flex items-stretch min-h-12 bg-bg-tertiary border-b border-border-secondary shrink-0"
      data-tour="plant-overview"
    >
      <div className="hidden sm:flex flex-col justify-center px-3 border-r border-border-primary">
        <span className="text-xs font-semibold text-text-primary leading-tight whitespace-nowrap">
          {fleet.name} ({fleet.net.total_capacity_mw.toFixed(0)} MW)
        </span>
        <span className="text-xs font-mono text-text-muted tabular-nums whitespace-nowrap">{utc}</span>
      </div>

      <div className="flex items-stretch flex-1 min-w-0 overflow-x-auto [scrollbar-width:none]">
        <Metric
          label="P · POC"
          value={plant.pocMW.toFixed(1)}
          unit="MW"
          title={`Delivered at the PSE 400 kV connection point. Generation ${plant.genMW.toFixed(1)} MW − losses ${plant.lossMW.toFixed(2)} MW`}
        />
        <Metric
          label="Q · POC"
          value={signed(plant.pocMVAr)}
          unit="MVAr"
          title="Reactive power at the POC, generating positive"
        />
        <Metric
          label="U · POC"
          value={plant.pocKV.toFixed(1)}
          unit="kV"
          outOfBand={plant.pocKV < V_POC_MIN_KV || plant.pocKV > V_POC_MAX_KV}
          title="PSE operating band 380–420 kV"
        />
        <Metric
          label="f"
          value={plant.frequencyHz.toFixed(3)}
          unit="Hz"
          outOfBand={Math.abs(plant.frequencyHz - 50) > F_NORMAL_BAND_HZ}
          title="Continental Europe normal band 49.95–50.05 Hz"
        />
        <Metric label="Losses" value={plant.lossMW.toFixed(2)} unit="MW" title="Array + transformers + export cables" />
        <Metric
          label="WTG online"
          value={`${plant.turbinesOnline}/${TURBINE_COUNT}`}
          outOfBand={plant.turbinesOnline < TURBINE_COUNT}
        />
        <div className="hidden lg:flex items-center px-3 border-l border-border-primary">
          <span
            className="text-xs font-mono uppercase tracking-wider text-text-muted whitespace-nowrap"
            title={
              plant.source === "pandapower"
                ? "Network values from the backend Newton-Raphson load flow (refreshed every 10 s)"
                : "Backend load flow unreachable — browser estimate"
            }
          >
            {plant.source === "pandapower" ? "load flow · pandapower" : "estimate · offline"}
          </span>
        </div>
      </div>

      {/* Alarm tape — vivid colour only here (ISA-101). Click → alarm list. */}
      <button
        type="button"
        onClick={() => {
          setArea("operations");
          setSubTab("operations", "alarms");
        }}
        className="flex items-center gap-1.5 px-3 border-l border-border-primary hover:bg-bg-hover transition-colors"
        title="Open the alarm list"
      >
        {CHIPS.map(({ key, label, attr }) => {
          const n = active.filter((a) => a.priority === key).length;
          return (
            <span
              key={key}
              data-priority={attr}
              className={cn(
                "px-1.5 py-0.5 rounded text-xs font-mono font-bold tabular-nums",
                n === 0 && "opacity-30",
                n > 0 && key === "CRITICAL" && "animate-pulse",
              )}
            >
              {n} {label}
            </span>
          );
        })}
      </button>
      {trailing}
    </div>
  );
}
