/**
 * Blade surface fields for the "Blade Analysis" overlay — live, per vertex.
 *
 * Operating point (BEM-lite, per span station r):
 *   axial induction a from Ct (momentum theory), tangential a' = a(1−a)/λr²
 *   W² = (U(1−a))² + (ωr(1+a'))²            relative wind [m/s]
 *   φ  = atan(U(1−a) / ωr(1+a'))             inflow angle
 *   α  = φ − θ_twist(r) − β_pitch            angle of attack
 *
 * Fields:
 *   thermal  — adiabatic-wall temperature from aerodynamic (kinetic) heating,
 *              T = T_air + r_f · W²/(2 c_p); r_f = 1 at the leading-edge
 *              stagnation line, ≈ Pr^⅓ = 0.89 (turbulent recovery) elsewhere.
 *              ≈ +5 K at the tip at rated (W ≈ 103 m/s). Solar heating and
 *              internal heat sources are not modelled.
 *   pressure — surface pressure relative to free stream, p − p∞ = Cp · ½ρW².
 *              Cp from thin-airfoil loading (flat plate 4α√((1−ξ)/ξ) + parabolic
 *              camber 32m√(ξ(1−ξ))) plus a symmetric thickness speed-up,
 *              Cp = 1 − (V/W)² with V/W = 1 + u_t ± ΔCp/4 (suction / pressure
 *              side) and a stagnation ramp at the leading edge. α is clamped
 *              to the attached-flow range (stall is not modelled).
 *   bending  — flapwise (out-of-plane) bending moment from rotor thrust,
 *              thrust per blade T/3 with a load ∝ r (optimal-rotor BEM shape):
 *              M(r) = k(R³/3 − rR²/2 + r³/6), k = 2(T/3)/(R² − r_h²).
 *              ≈ 66 MN·m at the root at rated thrust (2.6 MN).
 *
 * Geometry convention (Blade.tsx loft and the Blender blade, same frame):
 *   span along +Y from the root flange; uv.x < 0.5 suction side, > 0.5
 *   pressure side (LE at 0.5); chord position ξ recovered from the vertex
 *   position by undoing sweep, prebend and twist.
 */

import * as THREE from "three";

import { inductionFromCt, turbineThrustCoefficient, v236ThrustMN } from "../../../../utils/landingPhysics";
import { BLADE_LENGTH_M, STATIONS, bladeTwistDeg } from "../scene/bladeConstants";
import { BLADE_DRAW_SCALE, ROTOR_RADIUS } from "./layout";

export type BladeFieldMode = "off" | "thermal" | "pressure" | "bending";
export type ActiveBladeField = Exclude<BladeFieldMode, "off">;

const RHO = 1.225; // kg/m³ — same as the power/thrust model
const CP_AIR = 1005; // J/(kg·K)
const RECOVERY_TURBULENT = 0.89; // Pr^(1/3), Pr = 0.71
const ALPHA_MIN_DEG = -8;
const ALPHA_MAX_DEG = 12; // ≈ stall onset of thick DU-type sections
// Span stations are in the drawn blade's frame; physical radius r = HUB_RADIUS + k·span.
const HUB_RADIUS = ROTOR_RADIUS - BLADE_LENGTH_M * BLADE_DRAW_SCALE; // 2.56 m

export interface BladeOperatingPoint {
  /** Hub-height free-stream wind [m/s]. */
  windMs: number;
  /** Rotor speed [rpm]. */
  rpm: number;
  /** Collective pitch [deg]. */
  pitchDeg: number;
}

export interface SectionState {
  /** Radius from the rotor axis [m]. */
  r: number;
  /** Relative wind speed [m/s]. */
  w: number;
  /** Dynamic pressure ½ρW² [Pa]. */
  q: number;
  /** Angle of attack used for the loading, clamped to attached flow [deg]. */
  alphaDeg: number;
}

/** Relative wind, dynamic pressure and angle of attack at a span station. */
export function sectionState(span: number, op: BladeOperatingPoint): SectionState {
  const r = HUB_RADIUS + Math.max(0, span) * BLADE_DRAW_SCALE;
  const u = Math.max(0, op.windMs);
  const omega = (Math.max(0, op.rpm) * 2 * Math.PI) / 60;
  const a = u > 0 && omega > 0 ? inductionFromCt(turbineThrustCoefficient(u)) : 0;
  const lambdaR = u > 0 ? (omega * r) / u : 0;
  const aPrime = lambdaR > 0 ? (a * (1 - a)) / (lambdaR * lambdaR) : 0;
  const ua = u * (1 - a);
  const ut = omega * r * (1 + aPrime);
  const w = Math.hypot(ua, ut);
  const phiDeg = (Math.atan2(ua, ut) * 180) / Math.PI;
  const alpha = phiDeg - bladeTwistDeg(span) - op.pitchDeg;
  return {
    r,
    w,
    q: 0.5 * RHO * w * w,
    alphaDeg: Math.min(ALPHA_MAX_DEG, Math.max(ALPHA_MIN_DEG, alpha)),
  };
}

// ─── Section shape along the span (same tables as the Blender blade) ──────

const TC: [number, number][] = [
  [0, 1], [3, 1], [9, 0.62], [18, 0.4], [35, 0.3], [60, 0.24], [85, 0.21], [115.5, 0.18],
];

function smoothTable(table: [number, number][], x: number): number {
  for (let i = 1; i < table.length; i++) {
    const [x0, y0] = table[i - 1];
    const [x1, y1] = table[i];
    if (x <= x1) {
      const t = Math.max(0, (x - x0) / (x1 - x0));
      return y0 + (y1 - y0) * t * t * (3 - 2 * t);
    }
  }
  return table[table.length - 1][1];
}

/** Relative thickness t/c at a span station. */
export function thicknessRatio(span: number): number {
  return smoothTable(TC, span);
}

function station(span: number) {
  const s = Math.min(BLADE_LENGTH_M, Math.max(0, span));
  for (let i = 1; i < STATIONS.length; i++) {
    const a = STATIONS[i - 1];
    const b = STATIONS[i];
    if (s <= b.span) {
      const t = (s - a.span) / (b.span - a.span);
      return {
        chord: a.chord + (b.chord - a.chord) * t,
        prebend: a.prebend + (b.prebend - a.prebend) * t,
        sweep: a.sweep + (b.sweep - a.sweep) * t,
      };
    }
  }
  const last = STATIONS[STATIONS.length - 1];
  return { chord: last.chord, prebend: last.prebend, sweep: last.sweep };
}

/** Chord fraction ξ (0 = LE, 1 = TE) of a blade-local vertex. */
export function chordFraction(x: number, y: number, z: number): number {
  const st = station(y);
  const tc = thicknessRatio(y);
  const w = Math.min(1, Math.max(0, (tc - 0.42) / 0.58)); // 1 = cylindrical root
  const axis = 0.25 + 0.25 * w; // pitch axis location (x/c), as in the loft
  const a = (-bladeTwistDeg(y) * Math.PI) / 180;
  const xt = -x - st.sweep;
  const zt = st.prebend - z;
  const px = Math.cos(a) * xt - Math.sin(a) * zt;
  return Math.min(1, Math.max(0, px / Math.max(0.2, st.chord) + axis));
}

// ─── Fields ───────────────────────────────────────────────────────────────

/** Surface temperature rise above the air from kinetic heating [K]. */
export function aeroHeatingK(w: number, xi: number): number {
  const recovery = RECOVERY_TURBULENT + (1 - RECOVERY_TURBULENT) * Math.exp(-xi / 0.02);
  return (recovery * w * w) / (2 * CP_AIR);
}

/**
 * Pressure coefficient Cp at chord fraction ξ.
 * `suction` = upper (suction) surface; tc = t/c; alphaDeg = angle of attack.
 */
export function pressureCoefficient(xi: number, suction: boolean, alphaDeg: number, tc: number): number {
  const x = Math.min(1, Math.max(0, xi));
  const airfoilTc = Math.min(tc, 0.42);
  const camber = 0.035 * (1 - Math.min(1, Math.max(0, (tc - 0.42) / 0.58)));
  const alpha = (alphaDeg * Math.PI) / 180;
  // Thin-airfoil loading ΔCp = Cp_lower − Cp_upper; ε ≈ LE radius regularisation.
  const dCp = 4 * alpha * Math.sqrt((1 - x) / (x + 0.005)) + 32 * camber * Math.sqrt(x * (1 - x));
  // Symmetric thickness speed-up (peaks ≈ 30 % chord).
  const ut = 1.2 * airfoilTc * Math.sin(Math.PI * Math.pow(x, 0.7));
  // Stagnation ramp: velocity → 0 at the leading edge.
  const stag = Math.min(1, Math.sqrt(x / 0.015));
  const v = (1 + ut + (suction ? dCp / 4 : -dCp / 4)) * stag;
  return Math.max(-6, 1 - v * v);
}

/** Flapwise bending moment at span station [MN·m] for rotor thrust [MN]. */
export function flapMomentMNm(span: number, thrustMN: number): number {
  const R = ROTOR_RADIUS;
  const rh = HUB_RADIUS;
  const r = Math.min(R, HUB_RADIUS + Math.max(0, span) * BLADE_DRAW_SCALE);
  const k = (2 * (thrustMN / 3)) / (R * R - rh * rh);
  return Math.max(0, k * (R ** 3 / 3 - (r * R * R) / 2 + r ** 3 / 6));
}

// ─── Colour scales (perceptual, sampled at 0…1) ───────────────────────────

type Stop = [number, number, number, number]; // t, r, g, b (0–1)

// Inferno-like: deep violet → red → orange → pale yellow (low end lifted
// from black so the cool inner blade still reads as a surface)
const INFERNO: Stop[] = [
  [0.0, 0.2, 0.12, 0.42], [0.25, 0.42, 0.1, 0.5], [0.5, 0.73, 0.21, 0.33],
  [0.75, 0.97, 0.55, 0.04], [1.0, 0.99, 0.96, 0.6],
];
// Cool-warm diverging: blue (suction) → grey (p∞) → red (pressure); the
// neutral is mid-grey, not white, so it does not wash out under the sun
const COOLWARM: Stop[] = [
  [0.0, 0.08, 0.16, 0.62], [0.25, 0.2, 0.45, 0.9], [0.5, 0.66, 0.67, 0.7],
  [0.75, 0.93, 0.42, 0.26], [1.0, 0.68, 0.04, 0.1],
];
// Viridis-like: dark blue → teal → green → yellow
const VIRIDIS: Stop[] = [
  [0.0, 0.27, 0.0, 0.33], [0.25, 0.23, 0.32, 0.55], [0.5, 0.13, 0.57, 0.55],
  [0.75, 0.37, 0.79, 0.38], [1.0, 0.99, 0.91, 0.14],
];

const SCALES: Record<ActiveBladeField, Stop[]> = {
  thermal: INFERNO,
  pressure: COOLWARM,
  bending: VIRIDIS,
};

export function sampleScale(mode: ActiveBladeField, t: number, out: THREE.Color): THREE.Color {
  const stops = SCALES[mode];
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < stops.length; i++) {
    const [t1, r1, g1, b1] = stops[i];
    if (x <= t1) {
      const [t0, r0, g0, b0] = stops[i - 1];
      const f = (x - t0) / (t1 - t0);
      return out.setRGB(r0 + (r1 - r0) * f, g0 + (g1 - g0) * f, b0 + (b1 - b0) * f, THREE.SRGBColorSpace);
    }
  }
  const [, r, g, b] = stops[stops.length - 1];
  return out.setRGB(r, g, b, THREE.SRGBColorSpace);
}

/** CSS linear-gradient of a scale, for the HTML legend. */
export function scaleGradientCss(mode: ActiveBladeField): string {
  const stops = SCALES[mode]
    .map(([t, r, g, b]) => `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)}) ${t * 100}%`)
    .join(",");
  return `linear-gradient(90deg,${stops})`;
}

/**
 * Fixed colour ranges so slider changes read as intensity changes.
 * Thermal and pressure scale with W² ∝ r², so a linear map leaves the inner
 * half of the blade colourless; they use a signed square-root map instead
 * (colour linear in ~r), bending stays linear.
 */
export const FIELD_RANGE: Record<ActiveBladeField, { min: number; max: number; unit: string; sqrt: boolean }> = {
  thermal: { min: 0, max: 6, unit: "K", sqrt: true }, // rise above air
  pressure: { min: -10, max: 10, unit: "kPa", sqrt: true }, // p − p∞
  bending: { min: 0, max: 80, unit: "MN·m", sqrt: false },
};

/** Field value → position 0…1 on the colour bar. */
export function fieldToUnit(mode: ActiveBladeField, value: number): number {
  const { min, max, sqrt } = FIELD_RANGE[mode];
  if (!sqrt) return Math.min(1, Math.max(0, (value - min) / (max - min)));
  if (min < 0) {
    const m = Math.max(-max, min);
    const f = Math.sqrt(Math.min(1, Math.abs(value) / Math.max(max, -m)));
    return 0.5 + 0.5 * Math.sign(value) * f;
  }
  return Math.sqrt(Math.min(1, Math.max(0, (value - min) / (max - min))));
}

/** Position 0…1 on the colour bar → field value (legend ticks). */
export function unitToField(mode: ActiveBladeField, t: number): number {
  const { min, max, sqrt } = FIELD_RANGE[mode];
  if (!sqrt) return min + (max - min) * t;
  if (min < 0) {
    const f = 2 * t - 1;
    return Math.sign(f) * f * f * max;
  }
  return min + (max - min) * t * t;
}

// ─── Per-vertex evaluation ────────────────────────────────────────────────

export interface FieldSummary {
  mode: ActiveBladeField;
  /** Minimum / maximum of the field over the blade surface (field units). */
  min: number;
  max: number;
  /** Value at the root / tip (thermal: LE rise [K]; pressure: tip dynamic pressure q [kPa]). */
  root: number;
  tip: number;
  /** Tip relative wind [m/s] and angle of attack at 75 % span [deg]. */
  tipWindMs: number;
  alpha75Deg: number;
}

const N_SPAN_CACHE = 64;

/**
 * Fill `colors` (rgb per vertex) for `mode` over a blade geometry.
 * Returns the min / max and the reference values for the legend.
 */
export function evaluateBladeField(
  geom: THREE.BufferGeometry,
  mode: ActiveBladeField,
  op: BladeOperatingPoint,
  colors: Float32Array,
): FieldSummary {
  const pos = geom.attributes.position;
  const uv = geom.attributes.uv;
  const thrust = op.rpm > 0 ? v236ThrustMN(op.windMs) : 0;

  // Section states on a span grid (vertex lookups interpolate nearest).
  const sections: SectionState[] = [];
  for (let k = 0; k <= N_SPAN_CACHE; k++) sections.push(sectionState((BLADE_LENGTH_M * k) / N_SPAN_CACHE, op));
  const sectionAt = (span: number) =>
    sections[Math.round((Math.min(BLADE_LENGTH_M, Math.max(0, span)) / BLADE_LENGTH_M) * N_SPAN_CACHE)];

  const c = new THREE.Color();
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const sec = sectionAt(y);
    let value: number;
    if (mode === "bending") {
      value = flapMomentMNm(y, thrust);
    } else {
      const xi = chordFraction(x, y, z);
      if (mode === "thermal") {
        value = aeroHeatingK(sec.w, xi);
      } else {
        const suction = (uv ? uv.getX(i) : 0) < 0.5;
        value = (pressureCoefficient(xi, suction, sec.alphaDeg, thicknessRatio(y)) * sec.q) / 1000;
      }
    }
    if (value < min) min = value;
    if (value > max) max = value;
    sampleScale(mode, fieldToUnit(mode, value), c);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const tipSec = sectionState(BLADE_LENGTH_M, op);
  const s75 = sectionState((0.75 * ROTOR_RADIUS - HUB_RADIUS) / BLADE_DRAW_SCALE, op);
  const root =
    mode === "bending" ? flapMomentMNm(0, thrust) : mode === "thermal" ? aeroHeatingK(sectionState(0, op).w, 0) : 0;
  const tip = mode === "bending" ? 0 : mode === "thermal" ? aeroHeatingK(tipSec.w, 0) : tipSec.q / 1000;
  return {
    mode,
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : 0,
    root,
    tip,
    tipWindMs: tipSec.w,
    alpha75Deg: s75.alphaDeg,
  };
}
