/**
 * Animated wind particle overlay for the Control Room map (Windy.com style),
 * drawn in screen space under the deck.gl layers.
 *
 * Renders ~160 particles flowing in the current wind direction using
 * HTML5 Canvas + requestAnimationFrame. Each frame fades what is already on
 * the canvas a little and draws every particle's last step, so the particles
 * leave smooth tapering trails (no per-frame jitter, which read as noise).
 * Drawn at the device pixel ratio so the lines stay sharp.
 *
 * Colour follows wind speed, neutral greys getting lighter, amber only when
 * the wind nears the 25 m/s cut-out:
 *   #7189a0  light breeze  (< 6 m/s)
 *   #a3b6c8  moderate      (6–10 m/s)
 *   #e4ecf3  strong        (10–20 m/s)
 *   #f0b13e  near cut-out  (≥ 20 m/s)
 *
 * Wind data is read from landingStore on each animation frame; the map view
 * comes in as a ref (panning carries the particles along, zooming respawns
 * them). Zero external dependencies — pure Canvas API.
 */

import { useEffect, useRef } from "react";
import type { WebMercatorViewport } from "@deck.gl/core";

import { useLandingStore } from "../../store/landingStore";
import { useLayerStore } from "../../store/layerStore";

// ── Tunables ──────────────────────────────────────────────────────

const PARTICLE_COUNT = 160;
const BASE_MAX_AGE = 150; // frames before respawn
const AGE_VARIANCE = 50;
/** Share of the trail canvas erased per frame: smaller = longer trails. */
const TRAIL_FADE = 0.035;

// ── Wind speed → color ───────────────────────────────────────────

function windColor(ms: number): string {
  if (ms < 6) return "#7189a0";
  if (ms < 10) return "#a3b6c8";
  if (ms < 20) return "#e4ecf3";
  return "#f0b13e";
}

// ── Particle ─────────────────────────────────────────────────────

interface Particle {
  x: number;
  y: number;
  age: number;
  maxAge: number;
  phase: number;
  speedFactor: number;
}

/** The current map view (screen size, zoom, lon/lat → px), kept by the map. */
export type MapView = { readonly current: WebMercatorViewport | null };

// ── Component ────────────────────────────────────────────────────

export default function WindParticleOverlay({ view }: { view: MapView }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let last: WebMercatorViewport | null = null;

    function spawn(): Particle {
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        age: Math.floor(Math.random() * BASE_MAX_AGE),
        maxAge: BASE_MAX_AGE + Math.floor(Math.random() * AGE_VARIANCE),
        phase: Math.random() * Math.PI * 2,
        speedFactor: 0.8 + Math.random() * 0.4,
      };
    }

    // Lerp targets — smoothly interpolate toward store values each frame
    const LERP_RATE = 0.03; // ~84% convergence in 1s at 60fps
    let lerpWindDir = useLandingStore.getState().kpis.windDirectionDeg;
    let lerpWindSpeed = useLandingStore.getState().kpis.averageWindSpeedMs;

    /** Follow the map: a pan carries the particles along, a zoom or resize respawns them. */
    function followView(vp: WebMercatorViewport) {
      if (vp === last || (last && vp.longitude === last.longitude && vp.latitude === last.latitude && vp.zoom === last.zoom && vp.width === w && vp.height === h)) return;
      if (last && vp.zoom === last.zoom && vp.width === w && vp.height === h) {
        const [x0, y0] = last.project([vp.longitude, vp.latitude]);
        const [dx, dy] = [w / 2 - x0, h / 2 - y0];
        for (const p of particlesRef.current) {
          p.x += dx;
          p.y += dy;
        }
      } else {
        w = vp.width;
        h = vp.height;
        dpr = window.devicePixelRatio || 1;
        canvas!.width = Math.round(w * dpr);
        canvas!.height = Math.round(h * dpr);
        particlesRef.current = Array.from({ length: PARTICLE_COUNT }, spawn);
      }
      // Old trails would sit in the wrong place after a pan or zoom
      canvas!.getContext("2d")?.clearRect(0, 0, canvas!.width, canvas!.height);
      last = vp;
    }

    // ── Animation loop ────────────────────────────────────────────

    function frame() {
      const ctx = canvas!.getContext("2d");
      if (!ctx || !view.current) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }
      followView(view.current);

      const { windDirectionDeg, averageWindSpeedMs } =
        useLandingStore.getState().kpis;

      // Lerp wind direction (shortest angular path handles 0/360 wrap)
      let dirDelta = windDirectionDeg - lerpWindDir;
      if (dirDelta > 180) dirDelta -= 360;
      if (dirDelta < -180) dirDelta += 360;
      lerpWindDir = (lerpWindDir + dirDelta * LERP_RATE + 360) % 360;

      // Lerp wind speed
      lerpWindSpeed += (averageWindSpeedMs - lerpWindSpeed) * LERP_RATE;

      // Particles flow in the downwind direction (FROM → TO)
      const toRad = ((lerpWindDir + 180) * Math.PI) / 180;
      const speed = Math.max(0.3, (lerpWindSpeed / 15) * 1.5);
      const dx = Math.sin(toRad) * speed;
      const dy = -Math.cos(toRad) * speed; // canvas Y is inverted

      // Storybook sits on the light street map: ink trails there, the speed greys on the dark one
      const color = useLayerStore.getState().mapTheme === "storybook" ? "#2b2118" : windColor(lerpWindSpeed);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Fade the existing trails a little
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(0,0,0,${TRAIL_FADE})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.lineCap = "round";

      const particles = particlesRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const x0 = p.x;
        const y0 = p.y;

        // Gentle meander across the flow (turbulent eddies), smooth per particle
        const sway = Math.sin(p.age * 0.03 + p.phase * 2) * 0.12;
        p.x += (dx - dy * sway) * p.speedFactor;
        p.y += (dy + dx * sway) * p.speedFactor;
        p.age++;

        // Respawn if out of bounds or expired
        if (
          p.x < -20 ||
          p.x > w + 20 ||
          p.y < -20 ||
          p.y > h + 20 ||
          p.age > p.maxAge
        ) {
          particles[i] = spawn();
          particles[i].age = 0;
          continue;
        }

        // Smooth fade-in at birth, fade-out at death
        const t = p.age / p.maxAge;
        const alpha =
          t < 0.12 ? t / 0.12 : t > 0.8 ? (1 - t) / 0.2 : 1;

        ctx.globalAlpha = alpha * 0.4;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [view]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-[-1] h-full w-full" aria-hidden />;
}
