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
    <div className="absolute bottom-2 left-2 z-10 flex gap-2 pointer-events-none">
      {items.map(({ label, value }) => (
        <div key={label} className="flex flex-col items-center bg-bg-secondary/70 backdrop-blur-sm rounded px-1.5 py-0.5 border border-border-primary">
          <span className="text-[8px] text-text-muted font-mono">{label}</span>
          <span className="text-[10px] text-text-primary font-mono font-medium">{value}</span>
        </div>
      ))}
    </div>
  );
}
