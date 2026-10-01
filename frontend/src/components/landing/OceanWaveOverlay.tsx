/**
 * Animated ocean wave overlay for the Leaflet map (Canvas-based).
 *
 * Two layers of short-crested sinusoidal wave crest lines simulate ocean surface:
 *   1. Primary swell — wide spacing, slow scroll, brightest
 *   2. Wind-sea — medium spacing, moderate scroll
 *
 * Zoom-dependent visibility:
 *   zoom < 9     → hidden (no draw, saves GPU)
 *   zoom 9–10.5  → fade-in (linear interpolation 0→1)
 *   zoom ≥ 10.5  → full opacity (covers the default farm view, ≈ z 12)
 *
 * Foam dots scatter along primary swell crests for realism at close zoom.
 *
 * Wave direction follows wind (rotated via canvas transform).
 * Intensity (opacity, amplitude) scales with the simulated significant wave
 * height Hs (store environment); whitecap foam appears from Bft 4
 * (≈ 5.5 m/s), where breaking crests start in open sea. Follows the WindParticleOverlay canvas
 * pattern: createElement → atmosphericPane → requestAnimationFrame loop.
 *
 * Respects prefers-reduced-motion: draws static lines (no animation).
 */

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

import { SEA_POLYGON_GEO, SITE_BOUNDARY_GEO } from "../../constants/windFarmLayout";
import { useLandingStore } from "../../store/landingStore";
import { useLayerStore } from "../../store/layerStore";

// ── Zoom thresholds ─────────────────────────────────────────────

/** Zoom level below which waves are completely hidden */
const WAVE_ZOOM_MIN = 9;
/** Zoom level at which waves reach full opacity */
const WAVE_ZOOM_FULL = 10.5;

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
    lineWidth: 2.6,
    spacing: 56,
    speed: 0.3,
    amplitude: 6,
    frequency: 0.028,
    color: "rgba(205,228,255,0.6)",
  },
  {
    lineWidth: 1.5,
    spacing: 38,
    speed: 0.5,
    amplitude: 3.5,
    frequency: 0.045,
    color: "rgba(160,200,255,0.42)",
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

// ── Storybook theme (demo) ───────────────────────────────────────
// Hand-drawn sea: scattered "^" wave marks that drift downwind, bob and fade,
// plus inked curling breakers with spiral foam once the sea gets rough.
// Original drawing; density follows the simulated/live Hs, the marks drift
// with the wind, and breakers appear from Hs ≈ 2 m (whitecaps turn into
// breaking crests in a rough sea, WMO sea state 5+). Sizes are stylised.
const SB_INK = "#2b2118";
const SB_FOAM = "#f6eedb";
const SB_WAVE = "#2c6663";

/** One "^" wave mark: a thin crescent wedge, filled foam. */
function waveMark(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x - w * 0.35, y - h * 0.35, x, y - h);
  ctx.quadraticCurveTo(x + w * 0.35, y - h * 0.35, x + w, y);
  ctx.quadraticCurveTo(x + w * 0.3, y - h * 0.18, x, y - h * 0.5);
  ctx.quadraticCurveTo(x - w * 0.3, y - h * 0.18, x - w, y);
  ctx.closePath();
  ctx.fill();
}

/** Curling breaker (curl faces +x unless flipped), base at (0,0), ~60 × 34 px. */
function breaker(ctx: CanvasRenderingContext2D, seed: number) {
  ctx.lineJoin = "round";
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = SB_INK;
  // body
  ctx.beginPath();
  ctx.moveTo(-30, 0);
  ctx.bezierCurveTo(-24, -14, -8, -30, 10, -30);
  ctx.bezierCurveTo(22, -30, 30, -22, 27, -12);
  ctx.bezierCurveTo(23, -17, 16, -17, 13, -11);
  ctx.bezierCurveTo(10, -5, 12, -1, 16, 0);
  ctx.closePath();
  ctx.fillStyle = SB_WAVE;
  ctx.fill();
  ctx.stroke();
  // ribs
  ctx.lineWidth = 0.9;
  ctx.globalAlpha *= 0.8;
  for (const x of [-16, -6, 3]) {
    ctx.beginPath();
    ctx.moveTo(x, -2);
    ctx.bezierCurveTo(x + 2, -12, x + 6, -20, x + 10, -24 + (x + 16) * 0.1);
    ctx.stroke();
  }
  ctx.globalAlpha /= 0.8;
  // spiral foam along the crest
  const balls: [number, number, number][] = [
    [-10, -27, 5.5],
    [-1, -31, 6],
    [9, -33, 6.2],
    [19, -30, 5.2],
  ];
  for (const [bx, by, r] of balls) {
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fillStyle = SB_FOAM;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 3.2; a += 0.35) {
      const rr = (r * 0.8 * a) / (Math.PI * 3.2);
      const px = bx + rr * Math.cos(a + seed);
      const py = by + rr * Math.sin(a + seed);
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }
  // foam skirt
  ctx.beginPath();
  ctx.moveTo(-36, 1);
  ctx.bezierCurveTo(-20, -4, 10, -4, 30, 1);
  ctx.bezierCurveTo(12, 5, -18, 5, -36, 1);
  ctx.fillStyle = SB_FOAM;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawStorybookSea(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tS: number,
  windFromDeg: number,
  hs: number,
  fade: number,
  avoid: { x0: number; y0: number; x1: number; y1: number },
) {
  // downwind unit vector on screen (y down): from 225° → toward NE (+x, −y)
  const a = ((windFromDeg + 180) * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const drift = 6; // px/s, stylised

  // 1) "^" marks on a jittered grid, each living ~6–10 s
  const cell = 64;
  const density = Math.min(0.95, 0.25 + hs / 5);
  ctx.fillStyle = SB_FOAM;
  for (let gy = -1; gy < h / cell + 1; gy++) {
    for (let gx = -1; gx < w / cell + 1; gx++) {
      const r = hash(gx, gy);
      if (r > density) continue;
      const life = 6 + r * 4;
      const phase = (tS + r * 17) / life;
      const age = phase - Math.floor(phase); // 0 → 1
      const k = Math.floor(phase); // new position each life
      const jx = hash(gx + k * 7.1, gy) * cell;
      const jy = hash(gx, gy + k * 3.3) * cell;
      const x = gx * cell + jx + dx * drift * age * life;
      const y = gy * cell + jy + dy * drift * age * life + Math.sin(tS * 1.6 + r * 9) * 1.2;
      ctx.globalAlpha = fade * Math.sin(Math.PI * age) * 0.9;
      waveMark(ctx, x, y, 6 + r * 6, 3.2 + r * 2.2);
    }
  }

  // 2) curling breakers from Hs ≈ 2 m, up to 8 on screen
  const n = Math.max(0, Math.min(8, Math.floor((hs - 1.8) * 2.5)));
  const flip = dx < 0 ? -1 : 1; // curl faces downwind
  for (let i = 0; i < n; i++) {
    const life = 9 + hash(i, 5) * 5;
    const phase = (tS + hash(i, 9) * 30) / life;
    const age = phase - Math.floor(phase);
    const k = Math.floor(phase);
    const x = 60 + hash(i + k * 13.7, 1) * (w - 120) + dx * drift * age * life;
    const y = 80 + hash(i, 2 + k * 5.9) * (h - 140) + dy * drift * age * life;
    // Keep breakers (≈ 60 × 34 px) off the turbine array — they'd hide icons
    if (x > avoid.x0 - 35 && x < avoid.x1 + 35 && y > avoid.y0 && y < avoid.y1 + 20) continue;
    const grow = age < 0.25 ? age / 0.25 : age > 0.75 ? (1 - age) / 0.25 : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(x, y);
    ctx.scale(flip * (0.55 + 0.25 * hash(i, 3)), grow * (0.55 + 0.25 * hash(i, 3)));
    breaker(ctx, i);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
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
    // Sea-state intensity from Hs: 0.5 m → faint, ≥ 4 m → full
    const hsIntensity = (hs: number) => Math.min(Math.max(hs / 4, 0.35), 1);
    let lerpIntensity = hsIntensity(useLandingStore.getState().environment.significantWaveHeightM);

    function onMapChange() {
      resize();
      currentZoom = map.getZoom();
    }
    map.on("resize", onMapChange);
    map.on("moveend", onMapChange);
    map.on("zoomend", onMapChange);

    // Turbine array on screen (+ margin for icon size and breaker width)
    function farmRect() {
      const r = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      for (const [lat, lon] of SITE_BOUNDARY_GEO) {
        const p = map.latLngToContainerPoint([lat, lon]);
        r.x0 = Math.min(r.x0, p.x - 50);
        r.y0 = Math.min(r.y0, p.y - 40);
        r.x1 = Math.max(r.x1, p.x + 50);
        r.y1 = Math.max(r.y1, p.y + 40);
      }
      return r;
    }

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

      const { kpis, environment } = useLandingStore.getState();
      const { windDirectionDeg, averageWindSpeedMs } = kpis;

      // Lerp wind direction (shortest angular path handles 0/360 wrap)
      let dirDelta = windDirectionDeg - lerpWindDir;
      if (dirDelta > 180) dirDelta -= 360;
      if (dirDelta < -180) dirDelta += 360;
      lerpWindDir = (lerpWindDir + dirDelta * LERP_RATE + 360) % 360;

      // Lerp wind intensity
      const targetIntensity = hsIntensity(environment.significantWaveHeightM);
      // Whitecaps: none below Bft 4 (5.5 m/s), dense by Bft 7 (≈ 14 m/s)
      const whitecaps = Math.min(Math.max((averageWindSpeedMs - 5.5) / 8.5, 0), 1);
      lerpIntensity += (targetIntensity - lerpIntensity) * LERP_RATE;

      // Combined opacity: smoothed intensity × zoom fade
      const intensity = lerpIntensity * zoomFade;

      ctx.clearRect(0, 0, w, h);
      ctx.save();

      // Waves only on the sea: clip to the OSM coastline polygon.
      ctx.beginPath();
      SEA_POLYGON_GEO.forEach(([lat, lon], i) => {
        const pt = map.latLngToContainerPoint([lat, lon]);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.closePath();
      ctx.clip();

      if (useLayerStore.getState().mapTheme === "storybook") {
        drawStorybookSea(
          ctx,
          w,
          h,
          reducedMotion ? 0 : performance.now() / 1000,
          lerpWindDir,
          environment.significantWaveHeightM,
          Math.max(zoomFade, 0.6),
          farmRect(),
        );
        ctx.restore();
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      // Global opacity from sea state × zoom fade. Capped at 85 % so crests
      // read clearly but stay under the icons (drawn below the marker pane).
      ctx.globalAlpha = intensity * 0.6;

      // Rotate so rows run across the wind and +y points downwind: rotating
      // by the wind-FROM bearing maps screen-down (0,1) to (−sinθ, cosθ),
      // i.e. the downwind direction (from 225° → toward NE). The old
      // +180° made the crests travel into the wind.
      const downwindRad = (lerpWindDir * Math.PI) / 180;
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

        // Crest rows across the rotated canvas (x = along crest, +y = downwind).
        const yStart = -margin + (phases[li] % layer.spacing);
        const xStart = -margin;
        const xEnd = w + margin;

        for (let y = yStart; y < h + margin; y += layer.spacing) {
          // Short-crested sea: each row is a string of short crest arcs,
          // bowed downwind, with seeded lengths/gaps (stable per row, so
          // nothing flickers as the rows travel).
          const row = Math.round((y - phases[li]) / layer.spacing);
          const swell = layer.amplitude * (0.6 + 0.6 * lerpIntensity);
          ctx.beginPath();
          let x = xStart - hash(li, row) * 80;
          for (let k = 0; x < xEnd; k++) {
            const r = hash(row + li * 31, k);
            const len = 14 + r * 30;
            const sy = y + swell * Math.sin(x * layer.frequency + phases[li] * 0.02 + li * 1.7);
            ctx.moveTo(x, sy);
            ctx.quadraticCurveTo(x + len / 2, sy + 2 + r * 4, x + len, sy);
            x += len + 18 + hash(k, row) * 46;
          }
          ctx.stroke();

          // ── Foam dots on primary swell crests only (layer 0) ────
          if (li === 0 && zoomFade > 0.3 && whitecaps > 0) {
            ctx.fillStyle = `rgba(235,245,255,${(0.25 + 0.5 * whitecaps) * zoomFade})`;
            for (let x = xStart; x <= xEnd; x += FOAM_SPACING) {
              const sineVal = Math.sin(
                x * layer.frequency + phases[li] * 0.02 + li * 1.7,
              );
              // Only place foam near wave crests (positive sine peaks)
              if (sineVal > FOAM_CREST_THRESHOLD) {
                const sy = y + layer.amplitude * sineVal;
                // Deterministic pseudo-random to avoid flickering
                const rng = hash(Math.round(x * 0.1), Math.round(y * 0.1));
                if (rng > 0.85 - 0.5 * whitecaps) {
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
