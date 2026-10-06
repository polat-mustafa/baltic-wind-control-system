/**
 * FRT compliance mission: voltage dips at the connection point, judged
 * against the PSE fault-ride-through profile and the fast fault current rule.
 *
 * Requirements (mirror of backend services/p2/frt_simulation.py; PSE,
 * "Wymogi ogólnego stosowania wynikające z NC RfG", 18-12-2018, power park
 * module type D):
 *   - Art. 16(3)(a): U_ret = 0 pu until 0.15 s, then a straight line to
 *     0.85 pu at 2.5 s. The module may disconnect only if the voltage falls
 *     below this profile; on or above it, it must stay connected.
 *   - Art. 20(2)(b): additional reactive current Iq = K·ΔU outside a
 *     ±0.1 pu dead band, K adjustable 2…10 (K = 2 here), capped at the
 *     rated current (1 pu).
 *
 * The voltage shapes are synthetic teaching cases (retained voltage, fault
 * duration, recovery ramp), not simulation results.
 */

import { pickOne, rng, shuffle, type Rng } from "./random";

export const PSE_FRT_PROFILE: [number, number][] = [
  [0, 0],
  [0.15, 0],
  [2.5, 0.85],
];
export const PROFILE_END_S = 3;
export const K_FACTOR = 2;
export const DEAD_BAND_PU = 0.1;

/** Lowest connection-point voltage [pu] the plant must ride through, t after fault inception [s]. */
export function pseProfile(t: number): number {
  const [, [t1, u1], [t2, u2]] = PSE_FRT_PROFILE;
  if (t <= t1) return u1;
  if (t >= t2) return u2;
  return u1 + ((u2 - u1) * (t - t1)) / (t2 - t1);
}

/** Additional reactive current set-point [pu of rated current] for a dip ΔU = 1 − U_ret. */
export function iqSetpoint(du: number, k = K_FACTOR): number {
  const d = Math.round(du * 1000) / 1000;
  if (Math.abs(d) <= DEAD_BAND_PU) return 0;
  return Math.max(-1, Math.min(1, k * d));
}

export interface FrtCase {
  /** Retained voltage during the fault [pu]. */
  uRet: number;
  /** Fault duration until clearance [s]. */
  faultS: number;
  /** Voltage the grid recovers to [pu]. */
  uEnd: number;
  /** Linear recovery time after clearance [s]. */
  rampS: number;
}

/** Connection-point voltage [pu] at t [s] after fault inception (pre-fault 1 pu). */
export function voltageAt(c: FrtCase, t: number): number {
  if (t < 0) return 1;
  if (t < c.faultS) return c.uRet;
  if (t < c.faultS + c.rampS) return c.uRet + ((c.uEnd - c.uRet) * (t - c.faultS)) / c.rampS;
  return c.uEnd;
}

/** True when the voltage stays on or above the profile: the plant must ride through. */
export function mustRideThrough(c: FrtCase, dt = 0.005): boolean {
  for (let t = 0; t <= PROFILE_END_S + 1e-9; t += dt) if (voltageAt(c, t) < pseProfile(t) - 1e-4) return false;
  return true;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Answer options for the reactive current question, the correct one included, shuffled. */
export function iqOptions(c: FrtCase, r: Rng): number[] {
  const du = round2(1 - c.uRet);
  const correct = round2(iqSetpoint(du));
  const candidates = [du, K_FACTOR * du, 0, 1, round2(K_FACTOR * (du - DEAD_BAND_PU)), round2(Math.min(1, 4 * du)), round2(du / 2)]
    .map(round2)
    .filter((v, i, a) => v !== correct && a.indexOf(v) === i);
  return shuffle(r, [correct, ...shuffle(r, candidates).slice(0, 3)]);
}

const U_RET = [0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
const FAULT_S = [0.1, 0.15, 0.25, 0.4, 0.6, 0.9];
const U_END = [0.8, 0.85, 0.9, 0.95, 1];
const RAMP_S = [0.1, 0.3, 0.6, 1, 2];

export interface FrtQuestion {
  case: FrtCase;
  rideThrough: boolean;
  iq: number;
  iqOptions: number[];
}

/**
 * `n` cases from `seed`, at least two of each verdict, so guessing one
 * answer for every case cannot pass.
 */
export function frtQuestions(seed: number, n = 5): FrtQuestion[] {
  const r = rng(seed);
  const want = shuffle(r, Array.from({ length: n }, (_, i) => (i < 2 ? true : i < 4 ? false : r() < 0.5)));
  return want.map((target) => {
    for (;;) {
      const c: FrtCase = { uRet: pickOne(r, U_RET), faultS: pickOne(r, FAULT_S), uEnd: pickOne(r, U_END), rampS: pickOne(r, RAMP_S) };
      if (mustRideThrough(c) !== target) continue;
      return { case: c, rideThrough: target, iq: round2(iqSetpoint(1 - c.uRet)), iqOptions: iqOptions(c, r) };
    }
  });
}

export const FRT_POINTS = { verdict: 12, iq: 8 };

export interface FrtAnswer {
  rideThrough: boolean | null;
  iq: number | null;
}

/** 20 points per case: 12 for the verdict, 8 for the reactive current. */
export function scoreFrt(questions: FrtQuestion[], answers: FrtAnswer[]): number {
  const max = questions.length * (FRT_POINTS.verdict + FRT_POINTS.iq);
  const got = questions.reduce(
    (s, q, i) => s + (answers[i]?.rideThrough === q.rideThrough ? FRT_POINTS.verdict : 0) + (answers[i]?.iq === q.iq ? FRT_POINTS.iq : 0),
    0,
  );
  return max > 0 ? Math.round((100 * got) / max) : 0;
}
