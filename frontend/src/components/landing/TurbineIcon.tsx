/**
 * Professional wind turbine SVG icon — Vestas V236-15.0 MW silhouette.
 *
 * ISA-101 compliant status coloring:
 *   operating → green (#3ecf6e)
 *   curtailed → amber (#f5a623)
 *   fault     → red   (#ef4444)
 *   offline   → gray  (#6b7280)
 *
 * Visual layers:
 *   - Yaw compass: faint concentric ring + N-arrow rotated by nacelle position
 *   - Tower (tapered trapezoid)
 *   - Nacelle (rotates with yaw)
 *   - Pitch arc: small arc badge near hub, sweep from 0° to current pitch
 *   - 3 airfoil-shaped blades (rotation speed scales with power)
 *   - Status glow ring around hub
 *   - Power bar + ID label
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
  /** Nacelle yaw position (0–360°, 0 = N). Optional — falls back to wind direction. */
  yawDeg?: number;
  /** Blade pitch angle (0° = full power, 90° = feathered). Optional. */
  pitchDeg?: number;
  onMouseEnter: (turbineId: string, e: React.MouseEvent<SVGGElement>) => void;
  onMouseLeave: () => void;
  onClick: () => void;
}

const STATUS_COLOR: Record<TurbineStatus, string> = {
  operating: SCADA_COLORS.ENERGIZED,
  curtailed: SCADA_COLORS.WARNING,
  fault: SCADA_COLORS.FAULT,
  offline: SCADA_COLORS.DE_ENERGIZED,
};

function bladeAnimationDuration(powerMW: number): string {
  if (powerMW <= 0) return "0s";
  const duration = Math.max(2, 8 - (powerMW / 15) * 6);
  return `${duration.toFixed(1)}s`;
}

const BLADE_PATH = "M 0,0 C -1.2,-3 -1.8,-8 -1,-13 L 0,-15 L 1,-13 C 1.4,-8 0.8,-3 0,0 Z";

/** Polar → cartesian helper for the pitch arc. */
function polar(r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [r * Math.cos(rad), r * Math.sin(rad)];
}

function TurbineIcon({
  turbineId,
  x,
  y,
  status,
  powerOutputMW,
  yawDeg = 225,
  pitchDeg = 0,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: TurbineIconProps) {
  const color = STATUS_COLOR[status];
  const isSpinning = status === "operating" || status === "curtailed";
  const duration = bladeAnimationDuration(powerOutputMW);
  const powerFraction = Math.min(powerOutputMW / 15, 1);
  const shortId = turbineId.replace(/^BWA-/, "");

  // Pitch arc: from 12 o'clock (0°) sweeping clockwise through `pitchDeg`.
  const pitchClamp = Math.max(0, Math.min(90, pitchDeg));
  const arcEnd = polar(7, pitchClamp);
  const arcSweep = pitchClamp > 180 ? 1 : 0;
  const pitchArcPath = `M 0,-7 A 7,7 0 ${arcSweep} 1 ${arcEnd[0].toFixed(2)},${arcEnd[1].toFixed(2)}`;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onMouseEnter={(e) => onMouseEnter(turbineId, e)}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      className="cursor-pointer"
      role="button"
      aria-label={`Turbine ${turbineId} — ${status}, ${powerOutputMW.toFixed(1)} MW, yaw ${yawDeg.toFixed(0)}°, pitch ${pitchDeg.toFixed(1)}°`}
    >
      {/* Status glow */}
      {status === "fault" && (
        <circle cx={0} cy={0} r={8} fill={color} opacity={0.15}>
          <animate attributeName="opacity" values="0.15;0.3;0.15" dur="1.5s" repeatCount="indefinite" />
        </circle>
      )}
      {status === "operating" && (
        <circle cx={0} cy={0} r={6} fill={color} opacity={0.08} />
      )}

      {/* Yaw compass — faint outer ring + small N-arrow rotated to nacelle yaw */}
      <g opacity={0.45}>
        <circle cx={0} cy={0} r={11} fill="none" stroke="#94a3b8" strokeWidth={0.4} strokeDasharray="1 2" />
        <g transform={`rotate(${yawDeg} 0 0)`}>
          <path d="M 0,-11 L -1.5,-9 L 1.5,-9 Z" fill="#cbd5e1" />
        </g>
      </g>

      {/* Tower — tapered trapezoid */}
      <path
        d="M -1.5,3 L -2.5,20 L 2.5,20 L 1.5,3 Z"
        fill={color}
        opacity={0.5}
        style={{ transition: "fill 0.6s ease" }}
      />
      <line x1={-4} y1={20} x2={4} y2={20} stroke={color} strokeWidth={1.5} opacity={0.4} />

      {/* Nacelle body — rotates with yaw so the long axis aligns with wind direction */}
      <g transform={`rotate(${yawDeg - 90} 0 0)`}>
        <rect
          x={-4} y={-2}
          width={8} height={4}
          rx={1.5}
          fill={color}
          opacity={0.85}
          style={{ transition: "fill 0.6s ease" }}
        />
      </g>

      {/* Pitch arc badge — only meaningful when actively producing */}
      {isSpinning && pitchClamp > 0.5 && (
        <path
          d={pitchArcPath}
          fill="none"
          stroke="#fbbf24"
          strokeWidth={0.8}
          opacity={0.85}
        />
      )}

      {/* Hub center dot */}
      <circle cx={0} cy={0} r={2} fill={color} style={{ transition: "fill 0.6s ease" }} />

      {/* 3-blade rotor */}
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
        <path d={BLADE_PATH} fill={color} opacity={0.75} />
        <path d={BLADE_PATH} fill={color} opacity={0.75} transform="rotate(120 0 0)" />
        <path d={BLADE_PATH} fill={color} opacity={0.75} transform="rotate(240 0 0)" />
      </g>

      {/* Micro power bar */}
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

      {/* ID label */}
      <text
        x={0} y={30}
        fill="#6b7490"
        fontSize={6}
        fontFamily="JetBrains Mono, monospace"
        textAnchor="middle"
      >
        {shortId}
      </text>

      {/* Hit area */}
      <rect x={-16} y={-18} width={32} height={52} fill="transparent" />
    </g>
  );
}

export default memo(TurbineIcon);
