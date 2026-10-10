/**
 * Ocean wave overlay for the Control Room map (canvas in screen space under
 * the deck.gl layers; the map view comes in as a ref).
 *
 * Deliberately quiet: long, softly curved crest lines across the wind that
 * travel downwind, broken into segments so they read as a sea surface, plus a
 * few short whitecaps from Bft 4 (≈ 5.5 m/s), where crests start breaking.
 * Contrast follows the simulated significant wave height Hs. Stylised: real
 * wavelengths (L = gT²/2π ≈ 90 m at Tp 7.7 s) are a pixel or two at farm zoom.
 *
 * Only on the sea (clipped to the coastline polygon), faded in from zoom 8,
 * drawn at the device pixel ratio so it stays sharp; still lines when reduced
 * motion is asked for.
 */

import { useEffect, useRef } from "react";
import type { MapView } from "./WindParticleOverlay";

import { SEA_POLYGON_GEO } from "../../constants/windFarmLayout";
import { useLandingStore } from "../../store/landingStore";
import { useLayerStore } from "../../store/layerStore";

/** Waves hidden below this zoom, full from WAVE_ZOOM_FULL. */
const WAVE_ZOOM_MIN = 8;
const WAVE_ZOOM_FULL = 9.5;
/** Crest spacing and along-crest wobble (CSS px). */
const SPACING = 48;
const WOBBLE_PX = 4;
const WOBBLE_LEN = 260;

function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export default function OceanWaveOverlay({ view }: { view: MapView }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    // Wind direction eases toward the store value (~1 s), so a wind shift turns the sea smoothly
    let dir = useLandingStore.getState().kpis.windDirectionDeg;
    let raf = 0;

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const ctx = canvas!.getContext("2d");
      const vp = view.current;
      if (!ctx || !vp) return;
      const { width: w, height: h, zoom } = vp;
      const dpr = window.devicePixelRatio || 1;
      if (canvas!.width !== Math.round(w * dpr) || canvas!.height !== Math.round(h * dpr)) {
        canvas!.width = Math.round(w * dpr);
        canvas!.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const fade = Math.min(1, Math.max(0, (zoom - WAVE_ZOOM_MIN) / (WAVE_ZOOM_FULL - WAVE_ZOOM_MIN)));
      if (fade <= 0) return;

      const { kpis, environment } = useLandingStore.getState();
      let d = kpis.windDirectionDeg - dir;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      dir = (dir + d * 0.03 + 360) % 360;
      const hs = environment.significantWaveHeightM;
      const sea = Math.min(1, Math.max(0.3, hs / 4)); // 0.3 calm … 1 at Hs ≥ 4 m
      const whitecaps = Math.min(1, Math.max(0, (kpis.averageWindSpeedMs - 5.5) / 8.5));
      const t = reduced ? 0 : now / 1000;
      const light = useLayerStore.getState().mapTheme === "storybook";

      ctx.save();
      // Sea only
      ctx.beginPath();
      SEA_POLYGON_GEO.forEach(([lat, lon], i) => {
        const [x, y] = vp.project([lon, lat]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.clip();

      // Rotate so x runs along the crests and +y points downwind (wind FROM bearing → screen)
      const diag = Math.hypot(w, h);
      ctx.translate(w / 2, h / 2);
      ctx.rotate((dir * Math.PI) / 180);
      const travel = (t * (6 + 3 * hs)) % SPACING; // px/s, faster in a higher sea
      ctx.lineCap = "round";
      ctx.strokeStyle = light ? "#1f4f6b" : "#a9cdec";
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = fade * (light ? 0.14 + 0.16 * sea : 0.1 + 0.16 * sea);

      const half = diag / 2 + SPACING;
      const rows: number[] = [];
      for (let y = -half + travel; y < half; y += SPACING) rows.push(y);
      const crestY = (x: number, y: number, row: number) => y + WOBBLE_PX * Math.sin((x / WOBBLE_LEN) * 2 * Math.PI + row * 1.3 + t * 0.4);

      for (const y of rows) {
        const row = Math.round((y - travel) / SPACING);
        // Short-crested sea: crest arcs bowed downwind with seeded lengths and gaps, stable per row so nothing flickers
        let x = -half - hash(row, 1) * 120;
        for (let k = 0; x < half; k++) {
          const len = 40 + hash(row, k) * 70;
          const y0 = crestY(x, y, row);
          const y1 = crestY(x + len, y, row);
          ctx.beginPath();
          ctx.moveTo(x, y0);
          ctx.quadraticCurveTo(x + len / 2, (y0 + y1) / 2 + len * 0.14, x + len, y1);
          ctx.stroke();
          x += len + 40 + hash(k, row) * 90;
        }
      }

      // Whitecaps: short bright strokes on a share of the crests that grows with the wind
      if (whitecaps > 0) {
        ctx.strokeStyle = light ? "#ffffff" : "#e8f3ff";
        ctx.lineWidth = 1.8;
        ctx.globalAlpha = fade * (0.35 + 0.4 * whitecaps);
        for (const y of rows) {
          const row = Math.round((y - travel) / SPACING);
          for (let k = 0; k < diag / 90; k++) {
            if (hash(row * 3.1, k) > whitecaps * 0.35) continue;
            const x = -half + (k + hash(k, row * 7.7)) * 90;
            const life = (t / (3 + hash(row, k) * 3) + hash(k, row)) % 1; // each cap breaks and fades in 3–6 s
            ctx.globalAlpha = fade * (0.35 + 0.4 * whitecaps) * Math.sin(Math.PI * life);
            ctx.beginPath();
            ctx.moveTo(x, crestY(x, y, row));
            ctx.lineTo(x + 10, crestY(x + 10, y, row));
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [view]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />;
}
