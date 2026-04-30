/**
 * Per-turbine tile rendered as a node on the Plant Mimic.
 *
 * ISA-101 discipline:
 *   - Background grayscale at rest
 *   - 3px LEFT border = the only non-data colour, and only when abnormal
 *   - Numerics monospace + tabular-nums, white on bg-secondary
 *   - Wind-direction arrow rotated by nacelle yaw, in muted text
 *   - Mini sparkline = last 30 power samples (rolling buffer kept locally)
 *
 * Subscribes individually via selectTurbine(id) so unaffected cells
 * never re-render when one turbine updates.
 */

import { memo, useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

import { selectTurbine, useLandingStore } from "../../store/landingStore";
import { Sparkline } from "../ui/Sparkline";
import { cn } from "../../lib/utils";
import type { TurbineStatus } from "../../types/landing";

interface TurbineCellProps {
  turbineId: string;
  onOpen: (turbineId: string) => void;
}

const STATUS_BORDER: Record<TurbineStatus, string> = {
  operating: "border-l-border-primary",
  curtailed: "border-l-status-warning",
  fault:     "border-l-status-alarm animate-pulse",
  offline:   "border-l-text-faint",
};

const STATUS_DOT: Record<TurbineStatus, string> = {
  operating: "bg-status-normal",
  curtailed: "bg-status-warning",
  fault:     "bg-status-alarm",
  offline:   "bg-text-faint",
};

const TEXT_BY_STATUS: Record<TurbineStatus, string> = {
  operating: "text-text-primary",
  curtailed: "text-text-primary",
  fault:     "text-status-alarm",
  offline:   "text-text-muted",
};

const TREND_LEN = 30;

function TurbineCellInner({ turbineId, onOpen }: TurbineCellProps) {
  const t = useLandingStore(selectTurbine(turbineId));
  const trendRef = useRef<number[]>([]);
  const [tick, setTick] = useState(0);

  // Push current power into rolling buffer once per render of new data.
  useEffect(() => {
    if (!t) return;
    const buf = trendRef.current;
    buf.push(t.powerOutputMW);
    if (buf.length > TREND_LEN) buf.splice(0, buf.length - TREND_LEN);
    setTick((n) => n + 1);
  }, [t?.powerOutputMW, t]);

  if (!t) return null;

  const status: TurbineStatus = t.status;

  return (
    <button
      type="button"
      onClick={() => onOpen(turbineId)}
      className={cn(
        "group flex flex-col text-left",
        "border-l-[3px] border border-border-primary bg-bg-secondary",
        "px-1.5 py-1 min-w-[100px] w-[100px]",
        "transition-colors hover:bg-bg-elevated focus:outline-none",
        "focus-visible:ring-1 focus-visible:ring-accent",
        STATUS_BORDER[status],
      )}
      title={`${turbineId} · ${status.toUpperCase()}${t.faultType ? ` · ${t.faultType}` : ""}`}
    >
      {/* Header — id + status dot */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-wide text-text-secondary">
          {turbineId}
        </span>
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            STATUS_DOT[status],
            status === "fault" && "animate-pulse",
          )}
          aria-hidden
        />
      </div>

      {/* Power — prominent number */}
      <div className="flex items-baseline gap-0.5 mt-0.5">
        <span
          className={cn(
            "font-mono font-semibold tabular-nums text-sm leading-none",
            TEXT_BY_STATUS[status],
          )}
        >
          {status === "offline" || status === "fault"
            ? "—"
            : t.powerOutputMW.toFixed(1)}
        </span>
        <span className="text-[9px] text-text-muted">MW</span>
      </div>

      {/* Wind speed + nacelle direction */}
      <div className="flex items-center gap-1 mt-0.5">
        <span className="font-mono tabular-nums text-[10px] text-text-secondary">
          {t.windSpeedMs.toFixed(1)}
        </span>
        <span className="text-[9px] text-text-muted">m/s</span>
        <ArrowUp
          size={9}
          className="text-text-muted shrink-0"
          style={{ transform: `rotate(${t.nacellePositionDeg}deg)` }}
          aria-hidden
        />
        <span className="font-mono tabular-nums text-[9px] text-text-muted">
          {Math.round(t.nacellePositionDeg)}°
        </span>
      </div>

      {/* Sparkline */}
      <div className="mt-0.5 -mx-0.5">
        <Sparkline
          key={tick}
          points={trendRef.current}
          width={92}
          height={14}
          strokeColor={
            status === "fault"
              ? "var(--color-status-alarm, #C8362D)"
              : status === "curtailed"
              ? "var(--color-status-warning, #C9A227)"
              : "var(--color-text-muted, #A8AAAD)"
          }
        />
      </div>
    </button>
  );
}

const TurbineCell = memo(TurbineCellInner);
export default TurbineCell;
