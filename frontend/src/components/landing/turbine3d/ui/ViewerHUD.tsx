/**
 * HUD overlays: compass, scale bar, keyboard-shortcut cheat sheet, camera-mode badge.
 *
 * All components are pure HTML (not inside Canvas) — zero GPU cost.
 * They read from landingStore to stay in sync with the simulation state.
 */

import { memo, useState } from "react";
import { Keyboard } from "lucide-react";

import {
  selectInteriorView,
  selectTurbinePart,
  useLandingStore,
} from "../../../../store/landingStore";

interface CompassProps {
  /** Wind direction in meteorological convention (0° = wind from N). */
  windDirectionDeg: number;
  /** Current nacelle yaw (0° = facing N). */
  nacelleYawDeg: number;
}

export const CompassWidget = memo(function CompassWidget({
  windDirectionDeg,
  nacelleYawDeg,
}: CompassProps) {
  return (
    <div className="absolute top-2 left-24 z-10 w-14 h-14 pointer-events-none">
      <svg viewBox="-50 -50 100 100" className="w-full h-full">
        {/* Dial */}
        <circle cx="0" cy="0" r="42" fill="rgba(12,18,28,0.72)" stroke="#334155" strokeWidth="1.5" />
        {/* Cardinal marks */}
        <text x="0" y="-30" textAnchor="middle" className="fill-sky-300" fontSize="10" fontFamily="monospace">N</text>
        <text x="30" y="3" textAnchor="middle" className="fill-slate-400" fontSize="8" fontFamily="monospace">E</text>
        <text x="0" y="36" textAnchor="middle" className="fill-slate-400" fontSize="8" fontFamily="monospace">S</text>
        <text x="-30" y="3" textAnchor="middle" className="fill-slate-400" fontSize="8" fontFamily="monospace">W</text>

        {/* Wind arrow (blue) */}
        <g transform={`rotate(${windDirectionDeg})`}>
          <path d="M 0 -34 L -4 -26 L 0 -28 L 4 -26 Z" fill="#60a5fa" />
          <line x1="0" y1="-28" x2="0" y2="-12" stroke="#60a5fa" strokeWidth="1.5" />
        </g>

        {/* Nacelle yaw indicator (amber) — short line */}
        <g transform={`rotate(${nacelleYawDeg})`}>
          <line x1="0" y1="0" x2="0" y2="-20" stroke="#f59e0b" strokeWidth="2" />
          <circle cx="0" cy="-20" r="2.5" fill="#f59e0b" />
        </g>
      </svg>
      <div className="absolute -bottom-3 left-0 right-0 text-center">
        <span className="text-[8px] font-mono text-text-muted">
          {Math.round(windDirectionDeg)}°
        </span>
      </div>
    </div>
  );
});

interface ScaleBarProps {
  /** Metres per screen pixel at current camera distance. */
  metresPerPixel: number;
}

export const ScaleBar = memo(function ScaleBar({ metresPerPixel }: ScaleBarProps) {
  // Pick a nice round length that fits in ~80 px
  const candidates = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  const widthPx = 80;
  const targetMeters = metresPerPixel * widthPx;
  const barMeters = candidates.find((c) => c >= targetMeters) ?? 1000;
  const barPx = barMeters / metresPerPixel;

  return (
    <div className="absolute bottom-12 left-3 z-10 pointer-events-none bg-bg-secondary/70 backdrop-blur-sm rounded px-1.5 py-1 border border-border-primary">
      <div
        className="h-1.5 border-l border-r border-t border-text-muted"
        style={{ width: `${Math.min(barPx, 200)}px` }}
      />
      <div className="text-[9px] font-mono text-text-muted mt-0.5">
        {barMeters < 1000 ? `${barMeters} m` : `${barMeters / 1000} km`}
      </div>
    </div>
  );
});

export const CameraModeBadge = memo(function CameraModeBadge() {
  const selectedPart = useLandingStore(selectTurbinePart);
  const interiorView = useLandingStore(selectInteriorView);

  let label = "Overview";
  if (interiorView === "schematic") label = "Schematic";
  else if (selectedPart) label = `→ ${selectedPart.replace(/_/g, " ")}`;

  return (
    <div className="absolute top-2 left-40 z-10 bg-bg-secondary/80 backdrop-blur-sm rounded px-2 py-0.5 border border-border-primary pointer-events-none">
      <span className="text-[9px] font-mono text-text-muted uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
});

export const KeyboardHelp = memo(function KeyboardHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute bottom-3 right-3 z-10 pointer-events-auto">
      <button
        className="flex items-center gap-1 rounded px-2 py-1 bg-bg-secondary/80 border border-border-primary backdrop-blur-sm text-text-muted hover:text-text-primary text-[9px] font-mono"
        onClick={() => setOpen((v) => !v)}
        title="Keyboard shortcuts"
      >
        <Keyboard size={10} />
        <span>Keys</span>
      </button>
      {open && (
        <div className="absolute bottom-8 right-0 w-52 rounded bg-bg-secondary/95 border border-border-primary backdrop-blur-md p-2 text-[9px] font-mono text-text-muted space-y-0.5">
          <div className="flex justify-between"><span>F</span><span>Frame selected</span></div>
          <div className="flex justify-between"><span>R</span><span>Reset view</span></div>
          <div className="flex justify-between"><span>1 / 2 / 3</span><span>Normal / Cut / Explode</span></div>
          <div className="flex justify-between"><span>S</span><span>3D ↔ Schematic</span></div>
          <div className="flex justify-between"><span>+ / −</span><span>Zoom</span></div>
          <div className="flex justify-between"><span>Esc</span><span>Deselect</span></div>
          <div className="flex justify-between"><span>Drag</span><span>Rotate</span></div>
          <div className="flex justify-between"><span>Scroll</span><span>Zoom</span></div>
        </div>
      )}
    </div>
  );
});
