/**
 * Individual turbine SVG icon with status-colored nacelle and animated blades.
 *
 * ISA-101 compliant colors from SCADA_COLORS:
 *   operating → green, curtailed → amber, fault → red, offline → gray
 *
 * Blade animation: CSS keyframes rotate the 3-blade rotor when operating.
 * Speed scales with power output (faster rotation = more power).
 */

import { memo } from "react";

import { SCADA_COLORS } from "../../constants/scadaColors";
import type { TurbineStatus } from "../../types/landing";

interface TurbineIconProps {
  turbineId: string;
  x: number;
  y: number;
  status: TurbineStatus;
  powerOutputMW: number;
  onMouseEnter: (turbineId: string, e: React.MouseEvent<SVGGElement>) => void;
  onMouseLeave: () => void;
  onClick: () => void;
}

/** Map turbine status to ISA-101 SCADA color. */
const STATUS_COLOR: Record<TurbineStatus, string> = {
  operating: SCADA_COLORS.ENERGIZED,
  curtailed: SCADA_COLORS.WARNING,
  fault: SCADA_COLORS.FAULT,
  offline: SCADA_COLORS.DE_ENERGIZED,
};

/**
 * Blade animation duration: faster when producing more power.
 * At 15 MW → 2s per revolution, at 0 MW → stopped.
 */
function bladeAnimationDuration(powerMW: number): string {
  if (powerMW <= 0) return "0s";
  // 2s at rated (15 MW), 6s at low power (~3 MW)
  const duration = Math.max(2, 8 - (powerMW / 15) * 6);
  return `${duration.toFixed(1)}s`;
}

function TurbineIcon({
  turbineId,
  x,
  y,
  status,
  powerOutputMW,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: TurbineIconProps) {
  const color = STATUS_COLOR[status];
  const isSpinning = status === "operating" || status === "curtailed";
  const duration = bladeAnimationDuration(powerOutputMW);

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onMouseEnter={(e) => onMouseEnter(turbineId, e)}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      className="cursor-pointer"
      role="button"
      aria-label={`Turbine at position ${x},${y}`}
    >
      {/* Tower */}
      <line x1={0} y1={4} x2={0} y2={16} stroke={color} strokeWidth={2} />

      {/* Nacelle (hub) */}
      <circle cx={0} cy={4} r={3} fill={color} opacity={0.9} />

      {/* 3-blade rotor */}
      <g>
        {isSpinning && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 0 4"
            to="360 0 4"
            dur={duration}
            repeatCount="indefinite"
          />
        )}
        {/* Blade 1 — up */}
        <line x1={0} y1={4} x2={0} y2={-8} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        {/* Blade 2 — lower-right */}
        <line x1={0} y1={4} x2={10} y2={10} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        {/* Blade 3 — lower-left */}
        <line x1={0} y1={4} x2={-10} y2={10} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      </g>

      {/* Hit area (invisible, larger for easier interaction) */}
      <rect x={-14} y={-12} width={28} height={32} fill="transparent" />
    </g>
  );
}

export default memo(TurbineIcon);
