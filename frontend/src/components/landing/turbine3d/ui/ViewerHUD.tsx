/**
 * HUD overlays: compass, scale bar, keyboard-shortcut cheat sheet, camera-mode badge.
 *
 * All components are pure HTML (not inside Canvas) — zero GPU cost.
 * They read from landingStore to stay in sync with the simulation state.
 */

import { memo, useEffect, useRef, useState } from "react";
import { Keyboard } from "lucide-react";

import { cameraHeading } from "../hooks/useCameraHeading";

import {
  selectInteriorView,
  selectTurbinePart,
  useLandingStore,
} from "../../../../store/landingStore";

interface CompassProps {
  /** Wind direction in meteorological convention (0° = wind FROM N). */
  windDirectionDeg: number;
  /** Nacelle heading = bearing the rotor faces (upwind when aligned). */
  nacelleYawDeg: number;
  windMs: number;
}

const CARD16 = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const cardinal16 = (deg: number) => CARD16[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
const TICKS = Array.from({ length: 36 }, (_, i) => i * 10);

/**
 * Heading-up compass (like a ship's radar or a nav display): the dial turns
 * with the camera so "up" on the dial is always the direction you are
 * looking in the 3D view — what you see left/right of the tower matches the
 * dial. Wind arrow in the flow direction (tail = FROM bearing), nacelle glyph
 * with the rotor on its upwind face, yaw error read out below.
 */
export const CompassWidget = memo(function CompassWidget({
  windDirectionDeg,
  nacelleYawDeg,
  windMs,
}: CompassProps) {
  const dialRef = useRef<SVGGElement>(null);
  const viewRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const h = cameraHeading.deg;
      dialRef.current?.setAttribute("transform", `rotate(${-h})`);
      if (viewRef.current) viewRef.current.textContent = `${String(Math.round(h) % 360).padStart(3, "0")}°`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const yawErr = Math.round(((nacelleYawDeg - windDirectionDeg + 540) % 360) - 180) || 0; // no "−0"
  const ink = { fill: "var(--color-text-primary)" };
  const muted = { stroke: "var(--color-text-muted)" };

  return (
    <div className="pointer-events-none absolute left-2 top-14 z-10 w-[132px] select-none @max-lg:hidden">
      <svg viewBox="-60 -60 120 120" className="h-[132px] w-[132px] drop-shadow">
        <circle r="57" style={{ fill: "var(--color-bg-secondary)", stroke: "var(--color-border-primary)", opacity: 0.94 }} strokeWidth="1.5" />
        <g ref={dialRef}>
          {TICKS.map((d) => (
            <line
              key={d}
              x1="0"
              y1={d % 90 === 0 ? -44 : d % 30 === 0 ? -47 : -50}
              x2="0"
              y2="-54"
              transform={`rotate(${d})`}
              style={muted}
              strokeWidth={d % 30 === 0 ? 1.4 : 0.7}
            />
          ))}
          {[0, 90, 180, 270].map((d, i) => (
            <text
              key={d}
              transform={`rotate(${d}) translate(0 -34) rotate(${-d})`}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="11"
              fontWeight="800"
              style={d === 0 ? { fill: "#dc2626" } : ink}
            >
              {"NESW"[i]}
            </text>
          ))}
          {/* wind: tail on the FROM side, head downwind, through the centre */}
          <g transform={`rotate(${windDirectionDeg})`}>
            <line x1="0" y1="-50" x2="0" y2="26" stroke="#0284c7" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M 0 40 L -8 24 L 8 24 Z" fill="#0284c7" />
            {/* feathers mark the tail like a met chart barb */}
            <line x1="0" y1="-50" x2="7" y2="-56" stroke="#0284c7" strokeWidth="2" />
            <line x1="0" y1="-44" x2="7" y2="-50" stroke="#0284c7" strokeWidth="2" />
          </g>
          {/* nacelle: body downwind of the tower, rotor on the upwind face */}
          <g transform={`rotate(${nacelleYawDeg})`}>
            <rect x="-4.5" y="-4" width="9" height="18" rx="2.5" fill="#f59e0b" stroke="#78350f" strokeWidth="1" />
            <line x1="-17" y1="-6.5" x2="17" y2="-6.5" stroke="#78350f" strokeWidth="2.6" strokeLinecap="round" />
            <circle cy="-7" r="3" fill="#78350f" />
          </g>
        </g>
        {/* lubber line: the view direction is always up */}
        <path d="M 0 -59 L -4.5 -51 L 4.5 -51 Z" style={{ fill: "var(--color-text-primary)" }} />
      </svg>
      <div className="mt-0.5 rounded border border-border-primary bg-bg-secondary/90 px-1.5 py-0.5 font-mono text-[10px] font-bold leading-tight text-text-primary">
        <div className="text-sky-300">
          Wind {windMs.toFixed(1)} m/s · {Math.round(windDirectionDeg)}° {cardinal16(windDirectionDeg)}
        </div>
        <div className="text-amber-300">
          Nacelle {Math.round(nacelleYawDeg)}° · err {yawErr >= 0 ? "+" : ""}
          {yawErr.toFixed(0)}°
        </div>
        <div className="text-text-muted">
          View <span ref={viewRef}>000°</span> ▲
        </div>
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
    <div className="absolute bottom-20 left-3 z-10 pointer-events-none @max-lg:hidden bg-bg-secondary/70 backdrop-blur-sm rounded px-1.5 py-1 border border-border-primary">
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
    <div className="absolute top-2 left-40 z-10 @max-lg:hidden bg-bg-secondary/80 backdrop-blur-sm rounded px-2 py-0.5 border border-border-primary pointer-events-none">
      <span className="text-[9px] font-mono text-text-muted uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
});

export const KeyboardHelp = memo(function KeyboardHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute bottom-3 right-3 z-10 pointer-events-auto @max-lg:hidden pointer-coarse:hidden">
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
