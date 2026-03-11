/**
 * Wake cone visualization — educational SVG showing downstream wake deficit.
 *
 * Trapezoidal shape expanding rightward from rotor position.
 * Opacity proportional to power output (higher power = stronger wake).
 * Gradient fades from semi-opaque at rotor to transparent at far end.
 *
 * Purely educational — helps non-engineers understand wake effects.
 */

interface TurbineWakeConeProps {
  powerOutputMW: number;
  /** When provided and > 0, show actual wake loss instead of generic label. */
  wakeLossPct?: number;
}

/** Color matching the severity thresholds used in TurbineDetailPanel / WakeEffectLayer. */
function wakeConeColor(pct: number): string {
  if (pct > 20) return "#ef4444"; // red
  if (pct > 10) return "#f97316"; // orange
  return "#fbbf24"; // yellow
}

export default function TurbineWakeCone({ powerOutputMW, wakeLossPct }: TurbineWakeConeProps) {
  const opacity = Math.min(powerOutputMW / 15, 1) * 0.6;
  const hasLoss = wakeLossPct != null && wakeLossPct > 0;
  const fillColor = hasLoss ? wakeConeColor(wakeLossPct) : "#3b82f6";
  const labelText = hasLoss ? `\u2212${wakeLossPct}% wake loss` : "Wake deficit zone";

  return (
    <svg
      viewBox="0 0 380 35"
      className="w-full"
      style={{ height: 35 }}
      role="img"
      aria-label={labelText}
    >
      <defs>
        <linearGradient id="wake-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={fillColor} stopOpacity={0.35} />
          <stop offset="100%" stopColor={fillColor} stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Rotor line (left edge) */}
      <line x1={75} y1={6} x2={75} y2={29} stroke={fillColor} strokeWidth={1.5} opacity={0.4} />

      {/* Wake cone trapezoid */}
      <polygon
        points="75,10 350,0 350,35 75,25"
        fill="url(#wake-grad)"
        opacity={opacity}
        style={{ transition: "opacity 0.6s" }}
      />

      {/* Wake boundary lines */}
      <line x1={75} y1={10} x2={350} y2={0} stroke={fillColor} strokeWidth={0.5} opacity={0.2} strokeDasharray="4 3" />
      <line x1={75} y1={25} x2={350} y2={35} stroke={fillColor} strokeWidth={0.5} opacity={0.2} strokeDasharray="4 3" />

      {/* Label */}
      <text
        x={210}
        y={20}
        textAnchor="middle"
        fill={fillColor}
        fontSize={8}
        opacity={hasLoss ? 0.7 : 0.4}
        fontWeight={hasLoss ? 600 : 400}
        fontFamily="Inter, sans-serif"
      >
        {labelText}
      </text>
    </svg>
  );
}
