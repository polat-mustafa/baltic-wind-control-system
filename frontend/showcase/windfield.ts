/**
 * Hero wind field: the 34 SB-510 turbines seen from above, with the wind
 * streaming through them. Same physics as the platform — Bastankhah–Porté-Agel
 * Gaussian wakes (utils/wakeModel), Katic sum of squares, IEA-15-240-RWT power
 * and thrust curves (utils/turbineCurves) — evaluated on a grid the particles
 * sample, so a visitor literally sees the wakes the AEP model loses energy to.
 */

import { TURBINE_POSITIONS } from "../src/constants/windFarmLayout";
import { powerKw, REFERENCE_TURBINE, thrustCoefficient } from "../src/utils/turbineCurves";
import { computeWakeLosses, ROTOR_DIAMETER, velocityDeficit } from "../src/utils/wakeModel";

const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LON = 111_320 * Math.cos((55.06 * Math.PI) / 180);
const LAT0 = TURBINE_POSITIONS.reduce((s, t) => s + t.lat, 0) / TURBINE_POSITIONS.length;
const LON0 = TURBINE_POSITIONS.reduce((s, t) => s + t.lon, 0) / TURBINE_POSITIONS.length;

/** Turbines in metres east / north of the farm centroid. */
export const TURBINES = TURBINE_POSITIONS.map((t) => ({
  id: t.id,
  e: (t.lon - LON0) * M_PER_DEG_LON,
  n: (t.lat - LAT0) * M_PER_DEG_LAT,
}));

export interface FarmState {
  windFromDeg: number;
  speedMs: number;
  ct: number;
  powerMW: number;
  freeMW: number;
  wakeLossPct: number;
  /** Δu/u₀ per turbine (hub point, Katic) */
  deficit: Map<string, number>;
}

/** The platform's live numbers for one wind: per-turbine wake deficit → farm power. */
export function farmState(windFromDeg: number, speedMs: number): FarmState {
  const ct = thrustCoefficient(REFERENCE_TURBINE, speedMs);
  const deficit = new Map(computeWakeLosses(TURBINE_POSITIONS, windFromDeg, ct).map((w) => [w.turbineId, w.deficit]));
  const free = powerKw(REFERENCE_TURBINE, speedMs) / 1000;
  const powerMW = TURBINES.reduce((s, t) => s + powerKw(REFERENCE_TURBINE, speedMs * (1 - (deficit.get(t.id) ?? 0))) / 1000, 0);
  const freeMW = free * TURBINES.length;
  return { windFromDeg, speedMs, ct, powerMW, freeMW, wakeLossPct: freeMW > 0 ? (1 - powerMW / freeMW) * 100 : 0, deficit };
}

/** Flow direction (where the wind blows TO) as an east/north unit vector. */
export function flowVector(windFromDeg: number): [number, number] {
  const a = (windFromDeg * Math.PI) / 180;
  return [-Math.sin(a), -Math.cos(a)];
}

/** u/u₀ at a point (metres), all rotors upstream of it combined. */
export function speedRatio(e: number, n: number, windFromDeg: number, ct: number): number {
  const [fe, fn] = flowVector(windFromDeg);
  let sq = 0;
  for (const t of TURBINES) {
    const de = e - t.e;
    const dn = n - t.n;
    const along = de * fe + dn * fn;
    if (along <= 0) continue;
    const d = velocityDeficit(along, Math.abs(de * fn - dn * fe), ct);
    sq += d * d;
  }
  return 1 - Math.sqrt(sq);
}

interface View {
  /** metres per CSS pixel */
  scale: number;
  /** farm centroid in CSS pixels */
  cx: number;
  cy: number;
}

interface Particle {
  x: number;
  y: number;
  age: number;
  life: number;
}

const GRID = 6; // px per velocity cell
const REF_SPEED_PX = 1.15; // px per frame at u/u₀ = 1 (visual, not to scale)

export interface WindField {
  setWind(windFromDeg: number, speedMs: number): void;
  /** u/u₀ and the point's metres from the centroid under a CSS-pixel position, or null outside. */
  probe(px: number, py: number): { ratio: number; e: number; n: number } | null;
  /** metres per CSS pixel at the current size (for the scale bar) */
  metresPerPx(): number;
  destroy(): void;
}

export function mountWindField(
  canvas: HTMLCanvasElement,
  initial: { windFromDeg: number; speedMs: number },
  onLayout?: () => void,
): WindField {
  const ctx = canvas.getContext("2d")!;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w = 0;
  let h = 0;
  let dpr = 1;
  let view: View = { scale: 1, cx: 0, cy: 0 };
  let cols = 0;
  let rows = 0;
  let ratio = new Float32Array(0);
  let wind = { ...initial, ct: thrustCoefficient(REFERENCE_TURBINE, initial.speedMs) };
  let particles: Particle[] = [];
  let raf = 0;
  let visible = true;
  let yawDeg = initial.windFromDeg; // rotors follow the wind with a yaw lag, like the real ones

  function layout() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = Math.max(1, r.width);
    h = Math.max(1, r.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const wide = w > 900;
    // the farm (≈ 11 × 9 km) sits right of the headline on wide screens, centred below it on narrow ones
    const extentM = 15_500;
    view = {
      scale: extentM / (wide ? Math.min(w * 0.6, h * 1.25) : Math.min(w * 1.15, h * 0.9)),
      cx: wide ? w * 0.68 : w * 0.5,
      cy: wide ? h * 0.5 : h * 0.62,
    };
    cols = Math.ceil(w / GRID) + 1;
    rows = Math.ceil(h / GRID) + 1;
    computeGrid();
    seed();
    ctx.clearRect(0, 0, w, h);
  }

  function toMetres(px: number, py: number): [number, number] {
    return [(px - view.cx) * view.scale, -(py - view.cy) * view.scale];
  }

  function computeGrid() {
    ratio = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const [e, n] = toMetres(i * GRID, j * GRID);
        ratio[j * cols + i] = speedRatio(e, n, wind.windFromDeg, wind.ct);
      }
    }
  }

  function sample(x: number, y: number): number {
    const i = Math.min(cols - 1, Math.max(0, Math.round(x / GRID)));
    const j = Math.min(rows - 1, Math.max(0, Math.round(y / GRID)));
    return ratio[j * cols + i] ?? 1;
  }

  function spawn(p: Particle) {
    p.x = Math.random() * w;
    p.y = Math.random() * h;
    p.age = 0;
    p.life = 90 + Math.random() * 160;
  }

  function seed() {
    const n = Math.round(Math.min(3200, (w * h) / 380));
    particles = Array.from({ length: n }, () => {
      const p = { x: 0, y: 0, age: 0, life: 0 };
      spawn(p);
      p.age = Math.random() * p.life;
      return p;
    });
  }

  function drawTurbines() {
    const [fe, fn] = flowVector(yawDeg);
    // rotor seen from above: a line one diameter long, across the wind
    const half = ROTOR_DIAMETER / 2 / view.scale;
    const rx = -fn * half;
    const ry = -fe * half;
    ctx.lineCap = "round";
    for (const t of TURBINES) {
      const x = view.cx + t.e / view.scale;
      const y = view.cy - t.n / view.scale;
      ctx.strokeStyle = "rgba(241, 243, 238, 0.95)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x - rx * 1.5, y - ry * 1.5);
      ctx.lineTo(x + rx * 1.5, y + ry * 1.5);
      ctx.stroke();
      // nacelle behind the rotor, pointing downwind
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + fe * 6, y - fn * 6);
      ctx.stroke();
      // transition piece: RAL 1023, the yellow every jacket wears
      ctx.fillStyle = "#f2b705";
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame() {
    raf = 0;
    if (!visible) return;
    // yaw follows the wind at ~0.3°/frame (real yaw drives turn ≈ 0.3°/s; sped up)
    const dy = ((wind.windFromDeg - yawDeg + 540) % 360) - 180;
    yawDeg += Math.sign(dy) * Math.min(Math.abs(dy), 0.6);

    // fade the previous frame: trails
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.05)";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";

    const [fe, fn] = flowVector(wind.windFromDeg);
    const speedScale = REF_SPEED_PX * (0.55 + wind.speedMs / 22);
    ctx.lineWidth = 1;
    for (const p of particles) {
      const r = sample(p.x, p.y);
      const v = speedScale * r;
      const nx = p.x + fe * v;
      const ny = p.y - fn * v;
      const deficit = 1 - r;
      // free stream: chart-paper white; in a wake: copper, the colour of the energy it costs
      ctx.strokeStyle =
        deficit > 0.02
          ? `rgba(222, 122, 70, ${Math.min(0.95, 0.35 + deficit * 3.5)})`
          : "rgba(214, 226, 218, 0.17)";
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      p.x = nx;
      p.y = ny;
      if (++p.age > p.life || p.x < -4 || p.y < -4 || p.x > w + 4 || p.y > h + 4) spawn(p);
    }
    // turbines on a separate pass, redrawn crisp each frame over the trails
    drawTurbines();
    raf = requestAnimationFrame(frame);
  }

  function still() {
    // reduced motion: one settled picture of the streamlines instead of the animation
    ctx.clearRect(0, 0, w, h);
    const [fe, fn] = flowVector(wind.windFromDeg);
    ctx.lineWidth = 1;
    for (let k = 0; k < 900; k++) {
      let x = Math.random() * w;
      let y = Math.random() * h;
      for (let s = 0; s < 40; s++) {
        const r = sample(x, y);
        const nx = x + fe * 2 * r;
        const ny = y - fn * 2 * r;
        ctx.strokeStyle = 1 - r > 0.02 ? "rgba(214,128,82,0.55)" : "rgba(214,226,218,0.22)";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        x = nx;
        y = ny;
      }
    }
    yawDeg = wind.windFromDeg;
    drawTurbines();
  }

  const start = () => {
    if (reduced) still();
    else if (!raf && visible) raf = requestAnimationFrame(frame);
  };

  const ro = new ResizeObserver(() => {
    layout();
    start();
    onLayout?.();
  });
  ro.observe(canvas);
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    start();
  });
  io.observe(canvas);

  return {
    setWind(windFromDeg, speedMs) {
      wind = { windFromDeg, speedMs, ct: thrustCoefficient(REFERENCE_TURBINE, speedMs) };
      computeGrid();
      if (reduced) still();
    },
    probe(px, py) {
      if (px < 0 || py < 0 || px > w || py > h) return null;
      const [e, n] = toMetres(px, py);
      return { ratio: speedRatio(e, n, wind.windFromDeg, wind.ct), e, n };
    },
    metresPerPx: () => view.scale,
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    },
  };
}

/** Metres from the farm centroid → "55°03.6′N 16°32.4′E" (chart notation). */
export function chartPosition(e: number, n: number): string {
  const lat = LAT0 + n / M_PER_DEG_LAT;
  const lon = LON0 + e / M_PER_DEG_LON;
  const fmt = (v: number, pos: string, neg: string) => {
    const a = Math.abs(v);
    const deg = Math.floor(a);
    return `${deg}°${((a - deg) * 60).toFixed(1).padStart(4, "0")}′${v >= 0 ? pos : neg}`;
  };
  return `${fmt(lat, "N", "S")} ${fmt(lon, "E", "W")}`;
}
