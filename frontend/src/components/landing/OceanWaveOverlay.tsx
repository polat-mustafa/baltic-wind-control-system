/**
 * Animated ocean wave overlay for the Leaflet map (Canvas-based).
 *
 * Three layers of sinusoidal wave crest lines simulate ocean surface:
 *   1. Primary swell — wide spacing, slow scroll, brightest
 *   2. Wind-sea — medium spacing, moderate scroll
 *   3. Ripples — tight spacing, fast scroll, faintest
 *
 * Zoom-dependent visibility:
 *   zoom < 12  → hidden (no draw, saves GPU)
 *   zoom 12–13 → fade-in (linear interpolation 0→1)
 *   zoom ≥ 13  → full opacity
 *
 * Foam dots scatter along primary swell crests for realism at close zoom.
 *
 * Wave direction follows wind (rotated via canvas transform).
 * Intensity (opacity) scales with wind speed — calm seas at low wind,
 * visible swells at rated wind. Follows the WindParticleOverlay canvas
 * pattern: createElement → atmosphericPane → requestAnimationFrame loop.
 *
 * Respects prefers-reduced-motion: draws static lines (no animation).
 */

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

import { useLandingStore } from "../../store/landingStore";

// ── Zoom thresholds ─────────────────────────────────────────────

/** Zoom level below which waves are completely hidden */
const WAVE_ZOOM_MIN = 12;
/** Zoom level at which waves reach full opacity */
const WAVE_ZOOM_FULL = 13;

// ── Wave layer definitions ───────────────────────────────────────

interface WaveLayer {
  /** Stroke width in CSS px */
  lineWidth: number;
  /** Vertical spacing between crest lines in px */
  spacing: number;
  /** Scroll speed multiplier (px per frame) */
  speed: number;
  /** Sine wave amplitude (lateral wobble in px) */
  amplitude: number;
  /** Sine wave spatial frequency (radians per px) */
  frequency: number;
  /** RGBA stroke color */
  color: string;
}

const WAVE_LAYERS: WaveLayer[] = [
  {
    lineWidth: 2,
    spacing: 90,
    speed: 0.3,
    amplitude: 6,
    frequency: 0.008,
    color: "rgba(180,210,255,0.35)",
  },
  {
    lineWidth: 1.5,
    spacing: 55,
    speed: 0.5,
    amplitude: 4,
    frequency: 0.012,
    color: "rgba(140,180,255,0.25)",
  },
  {
    lineWidth: 1,
    spacing: 30,
    speed: 0.8,
    amplitude: 2.5,
    frequency: 0.02,
    color: "rgba(200,220,240,0.15)",
  },
];

// ── Foam dot config ─────────────────────────────────────────────

/** Spacing between foam dot candidates along primary swell crests */
const FOAM_SPACING = 18;
/** Base radius of foam dots (px) */
const FOAM_RADIUS = 1.2;
/** Only draw foam on wave crests where sine value exceeds this threshold */
const FOAM_CREST_THRESHOLD = 0.6;

// ── Deterministic pseudo-random (seeded by position) ────────────

function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

// ── Component ────────────────────────────────────────────────────

export default function OceanWaveOverlay() {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const pane = map.getPane("atmosphericPane");
    if (!pane) return;

    // Create overlay canvas inside atmospheric pane (above tiles, below markers)
    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:absolute;top:0;left:0;pointer-events:none;";
    pane.appendChild(canvas);
    canvasRef.current = canvas;

    let w = 0;
    let h = 0;
    let currentZoom = map.getZoom();

    function resize() {
      const size = map.getSize();
      w = size.x;
      h = size.y;
      canvas.width = w;
      canvas.height = h;
    }
    resize();

    // Check prefers-reduced-motion
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motionQuery.matches;
    const onMotionChange = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches;
    };
    motionQuery.addEventListener("change", onMotionChange);

    // Phase offsets for each layer (accumulated over frames)
    const phases = [0, 0, 0];

    // Lerp targets — smoothly interpolate toward store values each frame
    const LERP_RATE = 0.03; // ~84% convergence in 1s at 60fps
    let lerpWindDir = useLandingStore.getState().kpis.windDirectionDeg;
    let lerpIntensity = Math.min(
      Math.max((useLandingStore.getState().kpis.averageWindSpeedMs - 2) / 13, 0.3),
      1,
    );

    function onMapChange() {
      resize();
      currentZoom = map.getZoom();
    }
    map.on("resize", onMapChange);
    map.on("moveend", onMapChange);
    map.on("zoomend", onMapChange);

    // ── Animation loop ────────────────────────────────────────────

    function frame() {
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      // ── Zoom gate: skip drawing entirely below threshold ────────
      if (currentZoom < WAVE_ZOOM_MIN) {
        ctx.clearRect(0, 0, w, h);
        // Keep phases advancing so there's no visual jump on zoom-in
        if (!reducedMotion) {
          for (let li = 0; li < WAVE_LAYERS.length; li++) {
            phases[li] += WAVE_LAYERS[li].speed;
          }
        }
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      // ── Zoom fade factor: 0 at WAVE_ZOOM_MIN → 1 at WAVE_ZOOM_FULL ─
      const zoomFade =
        currentZoom >= WAVE_ZOOM_FULL
          ? 1
          : Math.min(
              Math.max(
                (currentZoom - WAVE_ZOOM_MIN) / (WAVE_ZOOM_FULL - WAVE_ZOOM_MIN),
                0,
              ),
              1,
            );

      const { windDirectionDeg, averageWindSpeedMs } =
        useLandingStore.getState().kpis;

      // Lerp wind direction (shortest angular path handles 0/360 wrap)
      let dirDelta = windDirectionDeg - lerpWindDir;
      if (dirDelta > 180) dirDelta -= 360;
      if (dirDelta < -180) dirDelta += 360;
      lerpWindDir = (lerpWindDir + dirDelta * LERP_RATE + 360) % 360;

      // Lerp wind intensity
      const targetIntensity = Math.min(
        Math.max((averageWindSpeedMs - 2) / 13, 0.3),
        1,
      );
      lerpIntensity += (targetIntensity - lerpIntensity) * LERP_RATE;

      // Combined opacity: smoothed intensity × zoom fade
      const intensity = lerpIntensity * zoomFade;

      ctx.clearRect(0, 0, w, h);
      ctx.save();

      // Global opacity from wind intensity × zoom fade
      ctx.globalAlpha = intensity;

      // Rotate canvas so wave crests are perpendicular to wind direction.
      // Waves propagate downwind → crests are perpendicular to downwind.
      const downwindRad = ((lerpWindDir + 180) * Math.PI) / 180;
      const cx = w / 2;
      const cy = h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(downwindRad);
      ctx.translate(-cx, -cy);

      // Diagonal of the viewport — ensures full coverage after rotation
      const diag = Math.sqrt(w * w + h * h);
      const margin = (diag - Math.max(w, h)) / 2 + 50;

      for (let li = 0; li < WAVE_LAYERS.length; li++) {
        const layer = WAVE_LAYERS[li];

        // Advance phase (scroll effect) — skip if reduced motion
        if (!reducedMotion) {
          phases[li] += layer.speed;
        }

        ctx.strokeStyle = layer.color;
        ctx.lineWidth = layer.lineWidth;
        ctx.lineCap = "round";

        // Draw horizontal sine wave crest lines across the rotated canvas
        const yStart = -margin + (phases[li] % layer.spacing);
        const xStart = -margin;
        const xEnd = w + margin;
        const step = 4; // px between sample points on each crest

        for (let y = yStart; y < h + margin; y += layer.spacing) {
          ctx.beginPath();
          let first = true;
          for (let x = xStart; x <= xEnd; x += step) {
            const sineVal = Math.sin(
              x * layer.frequency + phases[li] * 0.02 + li * 1.7,
            );
            const sy = y + layer.amplitude * sineVal;
            if (first) {
              ctx.moveTo(x, sy);
              first = false;
            } else {
              ctx.lineTo(x, sy);
            }
          }
          ctx.stroke();

          // ── Foam dots on primary swell crests only (layer 0) ────
          if (li === 0 && zoomFade > 0.3) {
            ctx.fillStyle = `rgba(220,235,255,${0.25 * zoomFade})`;
            for (let x = xStart; x <= xEnd; x += FOAM_SPACING) {
              const sineVal = Math.sin(
                x * layer.frequency + phases[li] * 0.02 + li * 1.7,
              );
              // Only place foam near wave crests (positive sine peaks)
              if (sineVal > FOAM_CREST_THRESHOLD) {
                const sy = y + layer.amplitude * sineVal;
                // Deterministic pseudo-random to avoid flickering
                const rng = hash(Math.round(x * 0.1), Math.round(y * 0.1));
                if (rng > 0.45) {
                  const r = FOAM_RADIUS * (0.6 + rng * 0.8);
                  ctx.beginPath();
                  ctx.arc(x + rng * 4 - 2, sy + rng * 3 - 1.5, r, 0, Math.PI * 2);
                  ctx.fill();
                }
              }
            }
          }
        }
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      motionQuery.removeEventListener("change", onMotionChange);
      map.off("resize", onMapChange);
      map.off("moveend", onMapChange);
      map.off("zoomend", onMapChange);
      canvas.remove();
    };
  }, [map]);

  return null;
}
