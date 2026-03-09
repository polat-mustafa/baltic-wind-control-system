/**
 * Animated SVG cross-section of the V236-15.0 MW turbine.
 *
 * Side-view cutaway showing: wind arrow → blades → hub → main shaft →
 * main bearing (with thermal halo) → gearbox → generator → converter →
 * nacelle shell → yaw ring → tower → monopile foundation.
 *
 * Every metric is overlaid ON the visual, not in a table.
 * Animations: blade rotation, generator glow, wind arrow flow, thermal halo.
 * Vibration ≥ 4.5 mm/s → CSS shake on bearing. Respects prefers-reduced-motion.
 *
 * viewBox: 0 0 380 240
 */

import { SCADA_COLORS } from "../../constants/scadaColors";
import type { TurbinePartId } from "../../constants/turbinePartEducation";
import type { TurbineStatus } from "../../types/landing";

import CrossSectionClickZones from "./CrossSectionClickZones";

interface TurbineCrossSectionProps {
  powerOutputMW: number;
  windSpeedMs: number;
  rotorSpeedRpm: number;
  pitchAngleDeg: number;
  bearingTempC: number;
  vibrationMmS: number;
  nacellePositionDeg: number;
  status: TurbineStatus;
  onPartClick?: (partId: TurbinePartId) => void;
  activePart?: TurbinePartId | null;
  faultPartId?: TurbinePartId | null;
  curtailmentPartId?: TurbinePartId | null;
}

const STATUS_COLOR: Record<TurbineStatus, string> = {
  operating: SCADA_COLORS.ENERGIZED,
  curtailed: SCADA_COLORS.WARNING,
  fault: SCADA_COLORS.FAULT,
  offline: SCADA_COLORS.DE_ENERGIZED,
};

/** Maps a value to a thermal color: green → amber → red */
function thermalColor(temp: number, warn: number, alarm: number): string {
  if (temp >= alarm) return SCADA_COLORS.FAULT;
  if (temp >= warn) return SCADA_COLORS.WARNING;
  return SCADA_COLORS.ENERGIZED;
}

/** Threshold color for vibration values */
function vibrationColor(mmS: number): string {
  if (mmS >= 7.0) return SCADA_COLORS.FAULT;
  if (mmS >= 4.5) return SCADA_COLORS.WARNING;
  return "#9ba3b8";
}

// Blade airfoil path — same shape used on the map markers
const BLADE = "M 0,0 C -2,-5 -3,-14 -1.5,-24 L 0,-27 L 1.5,-24 C 3,-14 2,-5 0,0 Z";

export default function TurbineCrossSection({
  powerOutputMW,
  windSpeedMs,
  rotorSpeedRpm,
  pitchAngleDeg,
  bearingTempC,
  vibrationMmS,
  nacellePositionDeg,
  status,
  onPartClick,
  activePart,
  faultPartId,
  curtailmentPartId,
}: TurbineCrossSectionProps) {
  const sColor = STATUS_COLOR[status];
  const isSpinning = powerOutputMW > 0 && (status === "operating" || status === "curtailed");
  const bladeDur = isSpinning ? Math.max(2, 8 - (powerOutputMW / 15) * 6) : 0;
  const tColor = thermalColor(bearingTempC, 65, 80);
  const vColor = vibrationColor(vibrationMmS);
  const isVibrating = vibrationMmS >= 4.5;

  // Wind arrow length proportional to wind speed (20–65px range)
  const arrowLen = Math.min(65, 20 + (windSpeedMs / 25) * 45);

  // Yaw compass indicator — simplified to a small arc
  const yawRad = (nacellePositionDeg * Math.PI) / 180;
  const compassR = 10;
  const compassCx = 175;
  const compassCy = 170;
  const needleX = compassCx + compassR * Math.sin(yawRad);
  const needleY = compassCy - compassR * Math.cos(yawRad);

  return (
    <svg
      viewBox="0 0 380 240"
      className="w-full"
      style={{ height: "auto", maxHeight: 240 }}
      role="img"
      aria-label="Turbine cross-section diagram"
    >
      <defs>
        {/* Thermal heat halo gradient */}
        <radialGradient id="thermal-halo">
          <stop offset="0%" stopColor={tColor} stopOpacity={0.4} />
          <stop offset="100%" stopColor={tColor} stopOpacity={0} />
        </radialGradient>
        {/* Wind arrow dash pattern */}
        <pattern id="wind-dash" width="8" height="4" patternUnits="userSpaceOnUse">
          <rect width="5" height="4" fill="#3b82f6" opacity="0.6" />
        </pattern>
      </defs>

      {/* ── Wind Arrow (left side) ── */}
      <g>
        <line
          x1={90 - arrowLen}
          y1={82}
          x2={65}
          y2={82}
          stroke="#3b82f6"
          strokeWidth={2.5}
          strokeDasharray="6 4"
          opacity={0.7}
          style={{ transition: "all 0.6s" }}
        >
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="-20"
            dur="1s"
            repeatCount="indefinite"
          />
        </line>
        {/* Arrow head */}
        <polygon points="65,78 73,82 65,86" fill="#3b82f6" opacity={0.8} />
        {/* Wind speed label */}
        <text
          x={90 - arrowLen / 2}
          y={74}
          textAnchor="middle"
          fill="#3b82f6"
          fontSize={10}
          fontFamily="JetBrains Mono, monospace"
          fontWeight={600}
        >
          {windSpeedMs.toFixed(1)} m/s
        </text>
      </g>

      {/* ── Foundation (monopile) ── */}
      <rect
        x={157}
        y={208}
        width={36}
        height={22}
        rx={2}
        fill="#1e293b"
        stroke="#3d4560"
        strokeWidth={1}
      />
      <text
        x={175}
        y={222}
        textAnchor="middle"
        fill="#6b7490"
        fontSize={7}
        fontFamily="JetBrains Mono, monospace"
      >
        Monopile
      </text>

      {/* ── Tower (tapered) ── */}
      <path
        d="M 168,155 L 165,208 L 185,208 L 182,155 Z"
        fill="#1e293b"
        stroke="#3d4560"
        strokeWidth={1}
        style={{ transition: "stroke 0.6s" }}
      />

      {/* ── Nacelle Shell ── */}
      <rect
        x={82}
        y={64}
        width={228}
        height={42}
        rx={6}
        fill="#131720"
        stroke={sColor}
        strokeWidth={1.5}
        opacity={0.9}
        style={{ transition: "stroke 0.6s" }}
      />

      {/* ── Hub ── */}
      <circle
        cx={92}
        cy={85}
        r={8}
        fill={sColor}
        opacity={0.3}
        style={{ transition: "fill 0.6s" }}
      />
      <circle
        cx={92}
        cy={85}
        r={4}
        fill={sColor}
        style={{ transition: "fill 0.6s" }}
      />

      {/* ── Blades (3x, rotating around hub) ── */}
      <g transform="translate(92, 85)">
        {bladeDur > 0 ? (
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0"
            to="360"
            dur={`${bladeDur.toFixed(1)}s`}
            repeatCount="indefinite"
            additive="sum"
          />
        ) : null}
        <g transform={`rotate(${pitchAngleDeg * 0.3})`}>
          <path d={BLADE} fill={sColor} opacity={0.7} />
        </g>
        <g transform={`rotate(${120 + pitchAngleDeg * 0.3})`}>
          <path d={BLADE} fill={sColor} opacity={0.7} />
        </g>
        <g transform={`rotate(${240 + pitchAngleDeg * 0.3})`}>
          <path d={BLADE} fill={sColor} opacity={0.7} />
        </g>
      </g>

      {/* ── Main Shaft ── */}
      <rect x={100} y={81} width={30} height={8} rx={1} fill="#2d3348" stroke="#3d4560" strokeWidth={0.5} />

      {/* ── Main Bearing (with thermal halo + vibration) ── */}
      <g className={isVibrating ? "vibration-active" : ""}>
        {/* Thermal halo — larger circle behind bearing */}
        <circle
          cx={130}
          cy={85}
          r={16}
          fill="url(#thermal-halo)"
          className={bearingTempC >= 80 ? "thermal-alarm" : ""}
          style={{ transition: "all 0.6s" }}
        />
        {/* Bearing body */}
        <circle
          cx={130}
          cy={85}
          r={7}
          fill="#2d3348"
          stroke={tColor}
          strokeWidth={2}
          style={{ transition: "stroke 0.6s" }}
        />
        {/* Inner race */}
        <circle cx={130} cy={85} r={3} fill={tColor} opacity={0.5} style={{ transition: "fill 0.6s" }} />
      </g>

      {/* ── Brake Disc (between bearing and gearbox) ── */}
      <g>
        <rect x={139} y={78} width={8} height={14} rx={1} fill="#2d3348" stroke="#6b7490" strokeWidth={0.8} />
        {/* Brake pad lines */}
        <line x1={140} y1={80} x2={146} y2={80} stroke="#4a5580" strokeWidth={0.5} />
        <line x1={140} y1={90} x2={146} y2={90} stroke="#4a5580" strokeWidth={0.5} />
        <text x={143} y={100} textAnchor="middle" fill="#4a5580" fontSize={5} fontFamily="JetBrains Mono, monospace">
          BRAKE
        </text>
      </g>

      {/* ── Gearbox ── */}
      <rect x={150} y={72} width={42} height={26} rx={3} fill="#1e293b" stroke="#3d4560" strokeWidth={1} />
      {/* Gear teeth decoration */}
      <circle cx={163} cy={85} r={6} fill="none" stroke="#3d4560" strokeWidth={1} strokeDasharray="2 2" />
      <circle cx={179} cy={85} r={4} fill="none" stroke="#3d4560" strokeWidth={1} strokeDasharray="2 2" />
      <text x={171} y={79} textAnchor="middle" fill="#6b7490" fontSize={7} fontFamily="JetBrains Mono, monospace">
        36:1
      </text>

      {/* ── Generator ── */}
      <g className={isSpinning ? "generator-active" : ""}>
        <rect x={200} y={72} width={65} height={26} rx={3} fill="#1e293b" stroke="#3d4560" strokeWidth={1} />
        {/* Coil symbol */}
        <path
          d="M 215,85 Q 220,75 225,85 Q 230,95 235,85 Q 240,75 245,85 Q 250,95 255,85"
          fill="none"
          stroke={isSpinning ? SCADA_COLORS.ENERGIZED : "#3d4560"}
          strokeWidth={1.5}
          opacity={0.6}
          style={{ transition: "stroke 0.6s" }}
        />
        <text x={232} y={79} textAnchor="middle" fill="#6b7490" fontSize={7} fontFamily="JetBrains Mono, monospace">
          PMSG
        </text>
      </g>

      {/* ── Converter ── */}
      <rect x={272} y={76} width={30} height={18} rx={2} fill="#1e293b" stroke="#3d4560" strokeWidth={1} />
      <text x={287} y={88} textAnchor="middle" fill="#6b7490" fontSize={7} fontFamily="JetBrains Mono, monospace">
        AC/DC
      </text>

      {/* ── Cooler Unit (nacelle roof) ── */}
      <g>
        <rect x={240} y={56} width={50} height={8} rx={1} fill="#1e293b" stroke="#3d4560" strokeWidth={0.8} />
        {/* Fin lines */}
        <line x1={246} y1={57} x2={246} y2={63} stroke="#3d4560" strokeWidth={0.4} />
        <line x1={252} y1={57} x2={252} y2={63} stroke="#3d4560" strokeWidth={0.4} />
        <line x1={258} y1={57} x2={258} y2={63} stroke="#3d4560" strokeWidth={0.4} />
        <line x1={264} y1={57} x2={264} y2={63} stroke="#3d4560" strokeWidth={0.4} />
        <line x1={270} y1={57} x2={270} y2={63} stroke="#3d4560" strokeWidth={0.4} />
        <line x1={276} y1={57} x2={276} y2={63} stroke="#3d4560" strokeWidth={0.4} />
        <line x1={282} y1={57} x2={282} y2={63} stroke="#3d4560" strokeWidth={0.4} />
        <text x={265} y={53} textAnchor="middle" fill="#4a5580" fontSize={5} fontFamily="JetBrains Mono, monospace">
          COOLER
        </text>
      </g>

      {/* ── Anemometer (nacelle roof, right side) ── */}
      <g>
        {/* Mast */}
        <line x1={300} y1={64} x2={300} y2={57} stroke="#6b7490" strokeWidth={0.8} />
        {/* Cup assembly — 3 cups on arms */}
        <line x1={296} y1={57} x2={304} y2={57} stroke="#6b7490" strokeWidth={0.6} />
        <circle cx={296} cy={56} r={1.5} fill="#3d4560" stroke="#6b7490" strokeWidth={0.4} />
        <circle cx={300} cy={54} r={1.5} fill="#3d4560" stroke="#6b7490" strokeWidth={0.4} />
        <circle cx={304} cy={56} r={1.5} fill="#3d4560" stroke="#6b7490" strokeWidth={0.4} />
        <text x={300} y={50} textAnchor="middle" fill="#4a5580" fontSize={4.5} fontFamily="JetBrains Mono, monospace">
          ANEM
        </text>
      </g>

      {/* ── Yaw Ring Compass ── */}
      <circle cx={compassCx} cy={compassCy} r={compassR} fill="#131720" stroke="#3d4560" strokeWidth={0.8} />
      <line
        x1={compassCx}
        y1={compassCy}
        x2={needleX}
        y2={needleY}
        stroke={sColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        style={{ transition: "all 0.6s" }}
      />
      <circle cx={compassCx} cy={compassCy} r={1.5} fill={sColor} style={{ transition: "fill 0.6s" }} />
      <text
        x={compassCx}
        y={compassCy + 20}
        textAnchor="middle"
        fill="#6b7490"
        fontSize={7}
        fontFamily="JetBrains Mono, monospace"
      >
        {Math.round(nacellePositionDeg)}° yaw
      </text>

      {/* ── Tower-to-nacelle connection ── */}
      <rect x={170} y={106} width={10} height={49} fill="#1e293b" stroke="#3d4560" strokeWidth={0.5} />

      {/* ═══ Data Overlays (SVG text) ═══ */}

      {/* Power output — large, above nacelle */}
      <text
        x={190}
        y={55}
        textAnchor="middle"
        fill={sColor}
        fontSize={16}
        fontWeight={700}
        fontFamily="JetBrains Mono, monospace"
        style={{ transition: "fill 0.6s" }}
      >
        {powerOutputMW.toFixed(1)} MW
      </text>

      {/* Rotor speed — near hub */}
      <text
        x={92}
        y={118}
        textAnchor="middle"
        fill="#9ba3b8"
        fontSize={8}
        fontFamily="JetBrains Mono, monospace"
      >
        {rotorSpeedRpm.toFixed(1)} rpm
      </text>

      {/* Pitch angle — near blades (upper-left) */}
      <text
        x={70}
        y={60}
        textAnchor="middle"
        fill="#9ba3b8"
        fontSize={8}
        fontFamily="JetBrains Mono, monospace"
      >
        {pitchAngleDeg.toFixed(1)}°
      </text>

      {/* Bearing temp — below bearing */}
      <text
        x={130}
        y={118}
        textAnchor="middle"
        fill={tColor}
        fontSize={8}
        fontWeight={600}
        fontFamily="JetBrains Mono, monospace"
        style={{ transition: "fill 0.6s" }}
      >
        {bearingTempC.toFixed(0)}°C
      </text>

      {/* Vibration — below bearing temp */}
      <text
        x={130}
        y={130}
        textAnchor="middle"
        fill={vColor}
        fontSize={7}
        fontFamily="JetBrains Mono, monospace"
        style={{ transition: "fill 0.6s" }}
      >
        {vibrationMmS.toFixed(1)} mm/s
      </text>

      {/* Converter output label */}
      <text
        x={287}
        y={118}
        textAnchor="middle"
        fill="#6b7490"
        fontSize={7}
        fontFamily="JetBrains Mono, monospace"
      >
        66 kV
      </text>

      {/* ── Click Zones (must be last for SVG painter's model priority) ── */}
      {onPartClick && (
        <CrossSectionClickZones
          onPartClick={onPartClick}
          activePart={activePart ?? null}
          faultPartId={faultPartId ?? null}
          curtailmentPartId={curtailmentPartId ?? null}
        />
      )}
    </svg>
  );
}
