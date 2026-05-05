/**
 * Compact sparkline charts — two inline SVGs showing power and wind history.
 *
 * Each sparkline is ~170×32px with a colored line + semi-transparent area fill.
 * Points are computed from the ring buffer array (last 20 values ≈ 60 seconds).
 * Pure SVG polyline + polygon — no chart library needed.
 *
 * Power: green (0–15 MW scale), Wind: blue (0–25 m/s scale).
 */

interface TurbineSparklinesProps {
  powerHistory: number[];
  windHistory: number[];
  currentPowerMW: number;
  currentWindMs: number;
}

const W = 170;
const H = 28;
const PAD_TOP = 2;
const PAD_BOTTOM = 2;

function buildPoints(data: number[], maxVal: number): string {
  if (data.length < 2) return "";
  const step = W / (data.length - 1);
  const usableH = H - PAD_TOP - PAD_BOTTOM;
  return data
    .map((v, i) => {
      const x = i * step;
      const y = PAD_TOP + usableH - (Math.min(v, maxVal) / maxVal) * usableH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function buildAreaPoints(data: number[], maxVal: number): string {
  if (data.length < 2) return "";
  const linePoints = buildPoints(data, maxVal);
  const step = W / (data.length - 1);
  const lastX = (data.length - 1) * step;
  return `0,${H} ${linePoints} ${lastX.toFixed(1)},${H}`;
}

function Sparkline({
  data,
  maxVal,
  lineColor,
  fillColor,
  label,
  value,
  unit,
}: {
  data: number[];
  maxVal: number;
  lineColor: string;
  fillColor: string;
  label: string;
  value: string;
  unit: string;
}) {
  const hasData = data.length >= 2;

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] text-text-muted uppercase tracking-wider">{label}</span>
        <span className="text-[11px] font-mono tabular-nums font-medium" style={{ color: lineColor }}>
          {value} <span className="text-[9px] text-text-muted">{unit}</span>
        </span>
      </div>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: H }}
      >
        {hasData ? (
          <>
            <polygon points={buildAreaPoints(data, maxVal)} fill={fillColor} />
            <polyline
              points={buildPoints(data, maxVal)}
              fill="none"
              stroke={lineColor}
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        ) : (
          <text x={W / 2} y={H / 2 + 3} textAnchor="middle" fill="#3d4560" fontSize={9}>
            waiting…
          </text>
        )}
      </svg>
    </div>
  );
}

export default function TurbineSparklines({
  powerHistory,
  windHistory,
  currentPowerMW,
  currentWindMs,
}: TurbineSparklinesProps) {
  return (
    <div className="flex gap-3">
      <Sparkline
        data={powerHistory}
        maxVal={15}
        lineColor="#3ecf6e"
        fillColor="rgba(62,207,110,0.12)"
        label="Power"
        value={currentPowerMW.toFixed(1)}
        unit="MW"
      />
      <Sparkline
        data={windHistory}
        maxVal={25}
        lineColor="#3b82f6"
        fillColor="rgba(59,130,246,0.12)"
        label="Wind"
        value={currentWindMs.toFixed(1)}
        unit="m/s"
      />
    </div>
  );
}
