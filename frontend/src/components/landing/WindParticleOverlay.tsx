/**
 * Animated wind particle overlay for the Leaflet map (Windy.com style).
 *
 * Renders ~300 particles flowing in the current wind direction using
 * HTML5 Canvas + requestAnimationFrame. Each particle is drawn as a
 * short directional streak with a bright head dot.
 *
 * Color scale follows wind speed:
 *   #60a5fa  light breeze  (< 6 m/s)
 *   #06b6d4  moderate       (6–10 m/s)
 *   #e2e8f0  strong         (10–14 m/s)
 *   #fbbf24  near cut-out   (> 14 m/s)
 *
 * Wind data is read from landingStore on each animation frame.
 * Zero external dependencies — pure Canvas API.
 */

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

import { useLandingStore } from "../../store/landingStore";

// ── Tunables ──────────────────────────────────────────────────────

const PARTICLE_COUNT = 300;
const BASE_MAX_AGE = 80; // frames before respawn
const AGE_VARIANCE = 30;
const STREAK_FRAMES = 7; // trail length in frames of travel
const JITTER = 0.3; // random lateral wander (px/frame)

// ── Wind speed → color ───────────────────────────────────────────

function windColor(ms: number): string {
  if (ms < 6) return "#60a5fa";
  if (ms < 10) return "#06b6d4";
  if (ms < 14) return "#e2e8f0";
  return "#fbbf24";
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

// ── Component ────────────────────────────────────────────────────

export default function WindParticleOverlay() {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
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

    function resize() {
      const size = map.getSize();
      w = size.x;
      h = size.y;
      canvas.width = w;
      canvas.height = h;
    }
    resize();

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

    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, spawn);

    // Lerp targets — smoothly interpolate toward store values each frame
    const LERP_RATE = 0.03; // ~84% convergence in 1s at 60fps
    let lerpWindDir = useLandingStore.getState().kpis.windDirectionDeg;
    let lerpWindSpeed = useLandingStore.getState().kpis.averageWindSpeedMs;

    function onMapChange() {
      resize();
      particlesRef.current = Array.from({ length: PARTICLE_COUNT }, spawn);
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

      const color = windColor(lerpWindSpeed);

      ctx.clearRect(0, 0, w, h);

      const particles = particlesRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Wave-like modulation: sinusoidal speed variation per particle
        const waveFactor = 0.7 + 0.3 * Math.sin(p.age * 0.05 + p.phase);
        // Lateral sway: gentle perpendicular sine wave
        const perpX = -dy;
        const perpY = dx;
        const sway = Math.sin(p.age * 0.03 + p.phase * 2) * 0.15;

        p.x += (dx * waveFactor + perpX * sway) * p.speedFactor + (Math.random() - 0.5) * JITTER;
        p.y += (dy * waveFactor + perpY * sway) * p.speedFactor + (Math.random() - 0.5) * JITTER;
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

        // Streak tail (short line in wind direction)
        const tailX = p.x - dx * STREAK_FRAMES * p.speedFactor;
        const tailY = p.y - dy * STREAK_FRAMES * p.speedFactor;

        ctx.globalAlpha = alpha * 0.3;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        // Bright head dot
        ctx.globalAlpha = alpha * 0.55;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      map.off("resize", onMapChange);
      map.off("moveend", onMapChange);
      map.off("zoomend", onMapChange);
      canvas.remove();
    };
  }, [map]);

  return null;
}
