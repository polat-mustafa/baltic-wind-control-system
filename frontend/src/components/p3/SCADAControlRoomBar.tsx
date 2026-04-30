/**
 * SCADA Control Room bar — glassmorphic overlay for fullscreen mode.
 *
 * Matches the MapKPIRibbon pattern from the landing page.
 * Shows alarm priority badges, key measurements, farm power, and exit button.
 */

import { Minimize2 } from "lucide-react";

import { useScadaStore } from "../../store/scadaStore";
import { useLandingStore } from "../../store/landingStore";
import { cn } from "../../lib/utils";

interface SCADAControlRoomBarProps {
  onExit: () => void;
}

export default function SCADAControlRoomBar({ onExit }: SCADAControlRoomBarProps) {
  const alarms = useScadaStore((s) => s.alarms);
  const measurements = useScadaStore((s) => s.measurements);
  const kpis = useLandingStore((s) => s.kpis);

  const critCount = alarms.filter((a) => a.priority === "CRITICAL" && a.state === "ACTIVE").length;
  const highCount = alarms.filter((a) => a.priority === "HIGH" && a.state === "ACTIVE").length;
  const medCount = alarms.filter((a) => a.priority === "MEDIUM" && a.state === "ACTIVE").length;

  const m400 = measurements.find((m) => m.nodeId === "bb-400kv");
  const m220 = measurements.find((m) => m.nodeId === "bb-220kv");
  const m66 = measurements.find((m) => m.nodeId === "bb-66kv");

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-2 shrink-0",
        "bg-bg-secondary/80 backdrop-blur-md border-b border-border-primary",
      )}
    >
      {/* Left: Alarm priority badges (vivid color preserved — only place
          where saturation carries meaning per ISA-101). */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-text-primary mr-1">SCADA Control Room</span>
        <div className="w-px h-4 bg-border-primary" />
        {critCount > 0 && (
          <span data-priority="P1" className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold animate-pulse">
            {critCount} P1
          </span>
        )}
        {highCount > 0 && (
          <span data-priority="P2" className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">
            {highCount} P2
          </span>
        )}
        {medCount > 0 && (
          <span data-priority="P3" className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">
            {medCount} P3
          </span>
        )}
        {critCount === 0 && highCount === 0 && medCount === 0 && (
          <span className="text-[10px] font-mono text-text-secondary">All Clear</span>
        )}
      </div>

      {/* Center: Measurement readouts — desaturated voltage tokens */}
      <div className="flex items-center gap-4 text-[10px] font-mono text-text-secondary">
        {m400 && (
          <span>
            <span style={{ color: "var(--color-voltage-400kv)" }}>400 kV:</span>{" "}
            {m400.powerMW} MW / {m400.currentA} A
          </span>
        )}
        {m220 && (
          <span>
            <span style={{ color: "var(--color-voltage-220kv)" }}>220 kV:</span>{" "}
            {m220.powerMW} MW / {m220.currentA} A
          </span>
        )}
        {m66 && (
          <span>
            <span style={{ color: "var(--color-voltage-66kv)" }}>66 kV:</span>{" "}
            {m66.powerMW} MW / {m66.currentA} A
          </span>
        )}
      </div>

      {/* Right: Farm power, frequency, exit */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="text-text-muted">Farm:</span>
          <span className="font-bold text-status-normal">
            {Math.round(kpis.totalOutputMW)} MW
          </span>
          <span className="text-text-muted">|</span>
          <span className="text-text-secondary">{kpis.gridFrequencyHz} Hz</span>
        </div>
        <button
          onClick={onExit}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1",
            "bg-bg-tertiary border border-border-primary",
            "text-text-muted hover:text-text-primary hover:bg-bg-hover",
            "transition-colors duration-150 text-xs",
          )}
          title="Exit Control Room Mode (Esc)"
        >
          <Minimize2 size={12} />
          <span className="text-[10px]">Exit</span>
        </button>
      </div>
    </div>
  );
}
