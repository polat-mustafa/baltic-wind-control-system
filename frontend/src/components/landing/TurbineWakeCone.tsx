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
}

export default function TurbineWakeCone({ powerOutputMW }: TurbineWakeConeProps) {
  const opacity = Math.min(powerOutputMW / 15, 1) * 0.6;

  return (
    <svg
      viewBox="0 0 380 35"
      className="w-full"
      style={{ height: 35 }}
      role="img"
      aria-label="Wake deficit zone"
    >
      <defs>
        <linearGradient id="wake-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Rotor line (left edge) */}
      <line x1={75} y1={6} x2={75} y2={29} stroke="#3b82f6" strokeWidth={1.5} opacity={0.4} />

      {/* Wake cone trapezoid */}
      <polygon
        points="75,10 350,0 350,35 75,25"
        fill="url(#wake-grad)"
        opacity={opacity}
        style={{ transition: "opacity 0.6s" }}
      />

      {/* Wake boundary lines */}
      <line x1={75} y1={10} x2={350} y2={0} stroke="#3b82f6" strokeWidth={0.5} opacity={0.2} strokeDasharray="4 3" />
      <line x1={75} y1={25} x2={350} y2={35} stroke="#3b82f6" strokeWidth={0.5} opacity={0.2} strokeDasharray="4 3" />

      {/* Label */}
      <text
        x={210}
        y={20}
        textAnchor="middle"
        fill="#3b82f6"
        fontSize={8}
        opacity={0.4}
        fontFamily="Inter, sans-serif"
      >
        Wake deficit zone
      </text>
    </svg>
  );
}
