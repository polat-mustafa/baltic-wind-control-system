import { useMemo } from "react";
import { cn } from "../../lib/utils";

interface SparklineProps {
  points: number[];
  width?: number;
  height?: number;
  band?: [number, number];
  className?: string;
  strokeColor?: string;
  bandColor?: string;
  inBandColor?: string;
  outOfBandColor?: string;
}

export function Sparkline({
  points,
  width = 80,
  height = 24,
  band,
  className,
  strokeColor = "currentColor",
  bandColor = "var(--color-text-faint, #7C7E81)",
  inBandColor = "var(--color-status-normal, #2E7D5B)",
  outOfBandColor = "var(--color-status-alarm, #C8362D)",
}: SparklineProps) {
  const { path, currentX, currentY, currentInBand } = useMemo(() => {
    if (points.length < 2) {
      return { path: "", currentX: 0, currentY: 0, currentInBand: true };
    }

    const min = band ? Math.min(band[0], ...points) : Math.min(...points);
    const max = band ? Math.max(band[1], ...points) : Math.max(...points);
    const range = max - min || 1;
    const stepX = width / (points.length - 1);

    const project = (v: number) =>
      height - ((v - min) / range) * (height - 4) - 2;

    const segments = points.map(
      (v, i) => `${i === 0 ? "M" : "L"} ${(i * stepX).toFixed(2)} ${project(v).toFixed(2)}`,
    );

    const last = points[points.length - 1];
    const inBand = band ? last >= band[0] && last <= band[1] : true;

    return {
      path: segments.join(" "),
      currentX: width,
      currentY: project(last),
      currentInBand: inBand,
    };
  }, [points, band, width, height]);

  if (points.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        className={cn("text-text-muted", className)}
        role="presentation"
      />
    );
  }

  const min = band ? Math.min(band[0], ...points) : Math.min(...points);
  const max = band ? Math.max(band[1], ...points) : Math.max(...points);
  const range = max - min || 1;
  const projectBand = (v: number) =>
    height - ((v - min) / range) * (height - 4) - 2;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("text-text-muted overflow-visible", className)}
      role="presentation"
      aria-hidden
    >
      {band && (
        <>
          <line
            x1="0"
            x2={width}
            y1={projectBand(band[0])}
            y2={projectBand(band[0])}
            stroke={bandColor}
            strokeWidth="0.5"
            strokeDasharray="2 2"
            opacity="0.6"
          />
          <line
            x1="0"
            x2={width}
            y1={projectBand(band[1])}
            y2={projectBand(band[1])}
            stroke={bandColor}
            strokeWidth="0.5"
            strokeDasharray="2 2"
            opacity="0.6"
          />
        </>
      )}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={currentX}
        cy={currentY}
        r="2"
        fill={currentInBand ? inBandColor : outOfBandColor}
      />
    </svg>
  );
}
