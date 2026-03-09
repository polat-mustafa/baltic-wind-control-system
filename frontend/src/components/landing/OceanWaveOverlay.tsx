/**
 * Animated ocean wave overlay for the Leaflet map.
 *
 * Three layered CSS gradient patterns simulate wave crests on the dark ocean:
 *   1. Primary swell — large, slow (15 s period)
 *   2. Secondary wind-sea — medium (10 s period)
 *   3. Cross-ripples — small, fast (6 s period)
 *
 * Wave direction follows wind (with smooth CSS transition).
 * Intensity (opacity) scales with wind speed — calm seas at low wind,
 * visible swells at rated wind. Pure CSS @keyframes — zero JS per frame.
 */

import { createPortal } from "react-dom";
import { useMap } from "react-leaflet";

import { selectKPIs, useLandingStore } from "../../store/landingStore";

// ── Wave layer definitions ───────────────────────────────────────

const LAYERS = [
  {
    className: "ocean-wave-swell",
    angleOffset: 0,
    gradient:
      "repeating-linear-gradient(0deg, transparent 0px, transparent 90px, rgba(96,165,250,0.035) 92px, transparent 94px)",
  },
  {
    className: "ocean-wave-sea",
    angleOffset: 15,
    gradient:
      "repeating-linear-gradient(0deg, transparent 0px, transparent 55px, rgba(59,130,246,0.028) 56.5px, transparent 58px)",
  },
  {
    className: "ocean-wave-ripple",
    angleOffset: -10,
    gradient:
      "repeating-linear-gradient(0deg, transparent 0px, transparent 30px, rgba(148,163,184,0.022) 31px, transparent 32px)",
  },
];

// ── Component ────────────────────────────────────────────────────

export default function OceanWaveOverlay() {
  const map = useMap();
  const kpis = useLandingStore(selectKPIs);

  // Waves propagate in the downwind direction
  const downwindAngle = (kpis.windDirectionDeg + 180) % 360;

  // Opacity scales with wind speed (subtle at calm, visible at rated)
  const intensity = Math.min(
    Math.max((kpis.averageWindSpeedMs - 2) / 13, 0.15),
    1,
  );

  const pane = map.getPane("atmosphericPane");
  if (!pane) return null;

  return createPortal(
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        opacity: intensity,
        transition: "opacity 2s ease",
      }}
    >
      {LAYERS.map((layer) => (
        <div
          key={layer.className}
          style={{
            position: "absolute",
            inset: "-50%",
            width: "200%",
            height: "200%",
            transform: `rotate(${downwindAngle + layer.angleOffset}deg)`,
            transition: "transform 3s ease",
          }}
        >
          <div
            className={layer.className}
            style={{
              width: "100%",
              height: "100%",
              background: layer.gradient,
            }}
          />
        </div>
      ))}
    </div>,
    pane,
  );
}
