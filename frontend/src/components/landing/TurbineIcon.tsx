/**
 * Professional wind turbine SVG icon — Vestas V236-15.0 MW silhouette.
 *
 * ISA-101 compliant status coloring:
 *   operating → green (#3ecf6e)
 *   curtailed → amber (#f5a623)
 *   fault     → red   (#ef4444)
 *   offline   → gray  (#6b7280)
 *
 * Features:
 *   - Nacelle body with realistic proportions
 *   - 3 airfoil-shaped blades (tapered path, not simple lines)
 *   - Tapered tower with foundation base
 *   - Animated blade rotation scaled to power output
 *   - Status glow ring around nacelle hub
 *   - Micro power bar beneath tower
 *   - Turbine ID label
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
 * At 15 MW → 2s per revolution, at low power → 6s, at 0 MW → stopped.
 */
function bladeAnimationDuration(powerMW: number): string {
  if (powerMW <= 0) return "0s";
  const duration = Math.max(2, 8 - (powerMW / 15) * 6);
  return `${duration.toFixed(1)}s`;
}

/**
 * Airfoil blade path — tapered from hub to tip.
 * Blade extends upward from origin (hub center at 0,0).
 */
const BLADE_PATH = "M 0,0 C -1.2,-3 -1.8,-8 -1,-13 L 0,-15 L 1,-13 C 1.4,-8 0.8,-3 0,0 Z";

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
  const powerFraction = Math.min(powerOutputMW / 15, 1);

  // Short turbine ID (e.g., "BWA-01" → "01")
  const shortId = turbineId.replace(/^BWA-/, "");

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onMouseEnter={(e) => onMouseEnter(turbineId, e)}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      className="cursor-pointer"
      role="button"
      aria-label={`Turbine ${turbineId} — ${status}, ${powerOutputMW.toFixed(1)} MW`}
    >
      {/* Status glow (subtle halo behind nacelle) */}
      {status === "fault" && (
        <circle cx={0} cy={0} r={8} fill={color} opacity={0.15}>
          <animate attributeName="opacity" values="0.15;0.3;0.15" dur="1.5s" repeatCount="indefinite" />
        </circle>
      )}
      {status === "operating" && (
        <circle cx={0} cy={0} r={6} fill={color} opacity={0.08} />
      )}

      {/* Tower — tapered trapezoid */}
      <path
        d="M -1.5,3 L -2.5,20 L 2.5,20 L 1.5,3 Z"
        fill={color}
        opacity={0.5}
        style={{ transition: "fill 0.6s ease" }}
      />

      {/* Foundation base */}
      <line x1={-4} y1={20} x2={4} y2={20} stroke={color} strokeWidth={1.5} opacity={0.4} />

      {/* Nacelle body */}
      <rect
        x={-4} y={-2}
        width={8} height={4}
        rx={1.5}
        fill={color}
        opacity={0.85}
        style={{ transition: "fill 0.6s ease" }}
      />

      {/* Hub center dot */}
      <circle cx={0} cy={0} r={2} fill={color} style={{ transition: "fill 0.6s ease" }} />

      {/* 3-blade rotor group */}
      <g>
        {isSpinning && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 0 0"
            to="360 0 0"
            dur={duration}
            repeatCount="indefinite"
          />
        )}
        {/* Blade 1 — 0° (up) */}
        <path d={BLADE_PATH} fill={color} opacity={0.75} />
        {/* Blade 2 — 120° */}
        <path d={BLADE_PATH} fill={color} opacity={0.75} transform="rotate(120 0 0)" />
        {/* Blade 3 — 240° */}
        <path d={BLADE_PATH} fill={color} opacity={0.75} transform="rotate(240 0 0)" />
      </g>

      {/* Micro power bar beneath tower */}
      <rect x={-5} y={22} width={10} height={2} rx={0.5} fill="#1e2231" stroke={color} strokeWidth={0.3} opacity={0.5} />
      {powerFraction > 0 && (
        <rect
          x={-5} y={22}
          width={10 * powerFraction} height={2}
          rx={0.5}
          fill={color}
          opacity={0.6}
        />
      )}

      {/* Turbine ID label */}
      <text
        x={0} y={30}
        fill="#6b7490"
        fontSize={6}
        fontFamily="JetBrains Mono, monospace"
        textAnchor="middle"
      >
        {shortId}
      </text>

      {/* Hit area (invisible, larger for easier interaction) */}
      <rect x={-16} y={-18} width={32} height={52} fill="transparent" />
    </g>
  );
}

export default memo(TurbineIcon);
