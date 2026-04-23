/**
 * Live telemetry HUD — small read-out overlaid at bottom-left of the viewer.
 *
 * Shows: RPM | Pitch | Yaw | Power | Wind | Bearing temp
 * Updates from the Zustand store.
 */

import { selectTurbine, useLandingStore } from "../../../../store/landingStore";

interface ViewerLegendProps {
  turbineId: string;
}

export function ViewerLegend({ turbineId }: ViewerLegendProps) {
  const t = useLandingStore(selectTurbine(turbineId));
  if (!t) return null;

  const items = [
    { label: "RPM",   value: t.rotorSpeedRpm.toFixed(2) },
    { label: "Pitch", value: `${t.pitchAngleDeg.toFixed(1)}°` },
    { label: "Yaw",   value: `${t.nacellePositionDeg.toFixed(0)}°` },
    { label: "Power", value: `${t.powerOutputMW.toFixed(1)} MW` },
    { label: "Wind",  value: `${t.windSpeedMs.toFixed(1)} m/s` },
    { label: "Brg",   value: `${t.bearingTempC.toFixed(0)} °C` },
  ];

  return (
    <div className="absolute bottom-6 left-3 z-10 flex gap-1.5 pointer-events-none">
      {items.map(({ label, value }) => (
        <div
          key={label}
          className="flex flex-col items-center bg-bg-secondary/80 backdrop-blur-sm rounded-md px-2 py-1 border border-border-primary min-w-[48px]"
        >
          <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider leading-3">
            {label}
          </span>
          <span className="text-[12px] text-text-primary font-mono font-semibold leading-4 tabular-nums">
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}
