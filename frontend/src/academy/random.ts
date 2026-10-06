/**
 * Seeded pseudo-random numbers (mulberry32) so a mission attempt can be
 * replayed and tested: the same seed gives the same cases.
 */

export type Rng = () => number;

export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pickOne = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

/** Fisher–Yates shuffle (new array). */
export function shuffle<T>(r: Rng, xs: readonly T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const newSeed = () => Math.floor(Math.random() * 2 ** 31);
