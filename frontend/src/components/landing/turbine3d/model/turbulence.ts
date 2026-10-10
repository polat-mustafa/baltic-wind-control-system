/**
 * Synthetic atmospheric turbulence for the 3D flow — spatially coherent, so
 * neighbouring streaks move together in eddies instead of jittering
 * independently (the old per-particle Ornstein–Uhlenbeck noise).
 *
 *   Random Fourier modes (Kraichnan 1970): u'(x) = Σ aₙ cos(kₙ·x + φₙ),
 *   with aₙ ⟂ kₙ so the field is divergence-free. Wavenumbers log-spaced
 *   from the integral scale to ~15 m; mode energy follows the von Kármán
 *   spectrum E(k) ∝ (kL)⁴ / (1 + (kL)²)^(17/6) — k^−5/3 inertial range.
 *   Frozen turbulence (Taylor's hypothesis): the field is advected with the
 *   mean wind, x_f = x + U·t·ê_downwind.
 *
 *   Scales at hub height offshore (IEC 61400-1 §6.3, Kaimal): longitudinal
 *   scale parameter Λ₁ = 0.7·min(z, 60 m) = 42 m, integral length
 *   L ≈ 8.1·Λ₁ ≈ 340 m; the field is normalised to σ = 1 per component so
 *   callers scale by σ_u = TI·U. Anisotropy σ_v/σ_u = 0.8, σ_w/σ_u = 0.5
 *   (IEC Kaimal model).
 *
 * Wake meandering (Larsen et al. 2008, Dynamic Wake Meandering): the wake is
 * a passive tracer moved sideways and up/down by eddies larger than ~2 D. A
 * wake parcel released at time t − s/U_c has drifted
 *   δ(s, t) = v_LS(rotor, t − s/U_c) · s / U_c,
 * with v_LS the large-scale part of the same field — so the far wake snakes,
 * as seen in LES and nacelle-lidar scans.
 *
 * Wake-added turbulence (WAKE_FIELD) is a second, small-scale field: it is
 * made in the wake's shear layer, so its eddies are about the size of that
 * layer (integral scale ≈ ¼ D ≈ 60 m, down to 6 m), not the 340 m
 * atmospheric eddies. Callers scale it by U·ΔTI (Crespo–Hernández).
 */

export const L_INTEGRAL = 340; // m
const LAMBDA_MIN = 15; // m, smallest resolved eddy
const N_MODES = 28;
const ANISO = [0.8, 0.5, 1.0]; // x (lateral), y (vertical), z (longitudinal) relative to σ_u

export interface TurbulenceField {
  kx: Float32Array;
  ky: Float32Array;
  kz: Float32Array;
  ax: Float32Array;
  ay: Float32Array;
  az: Float32Array;
  ph: Float32Array;
  /** Modes with wavelength > 2 D — drive wake meandering. */
  large: Uint8Array;
}

/** Deterministic PRNG (mulberry32) so the field is reproducible per seed. */
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeTurbulence(seed = 7, largeWavelength = 472, integral = L_INTEGRAL, lambdaMin = LAMBDA_MIN): TurbulenceField {
  const rand = rng(seed);
  const f: TurbulenceField = {
    kx: new Float32Array(N_MODES), ky: new Float32Array(N_MODES), kz: new Float32Array(N_MODES),
    ax: new Float32Array(N_MODES), ay: new Float32Array(N_MODES), az: new Float32Array(N_MODES),
    ph: new Float32Array(N_MODES), large: new Uint8Array(N_MODES),
  };
  const kMin = (2 * Math.PI) / (2 * integral);
  const kMax = (2 * Math.PI) / lambdaMin;
  const energy: number[] = [];
  for (let n = 0; n < N_MODES; n++) {
    // log-spaced |k|, Δk ∝ k → mode variance E(k)·k
    const k = kMin * (kMax / kMin) ** ((n + 0.5) / N_MODES);
    const kl = k * integral;
    energy.push(((kl ** 4) / (1 + kl * kl) ** (17 / 6)) * k);
    // random direction on the sphere
    const cz = rand() * 2 - 1;
    const phi = rand() * 2 * Math.PI;
    const sz = Math.sqrt(1 - cz * cz);
    const ux = sz * Math.cos(phi), uy = sz * Math.sin(phi), uz = cz;
    f.kx[n] = k * ux; f.ky[n] = k * uy; f.kz[n] = k * uz;
    // amplitude direction ⟂ k: cross k̂ with a random vector
    const rx = rand() - 0.5, ry = rand() - 0.5, rz = rand() - 0.5;
    let px = uy * rz - uz * ry, py = uz * rx - ux * rz, pz = ux * ry - uy * rx;
    const pn = Math.hypot(px, py, pz) || 1;
    px /= pn; py /= pn; pz /= pn;
    f.ax[n] = px; f.ay[n] = py; f.az[n] = pz;
    f.ph[n] = rand() * 2 * Math.PI;
    f.large[n] = (2 * Math.PI) / k > largeWavelength ? 1 : 0;
  }
  // normalise to unit variance per component: a random unit vector puts ⟨aᵢ²⟩ = ⅓
  // in each component and ⟨cos²⟩ = ½, so Σ ampₙ² = 6
  const total = energy.reduce((a, b) => a + b, 0);
  for (let n = 0; n < N_MODES; n++) {
    const amp = Math.sqrt((6 * energy[n]) / total);
    f.ax[n] *= amp * ANISO[0];
    f.ay[n] *= amp * ANISO[1];
    f.az[n] *= amp * ANISO[2];
  }
  return f;
}

/**
 * Turbulent velocity (σ_u = 1 units) at wind-frame point (x, y, z), time t,
 * mean wind U towards −z. `largeOnly` keeps the meandering scales.
 */
export function turbAt(
  f: TurbulenceField,
  x: number,
  y: number,
  z: number,
  t: number,
  U: number,
  out: { x: number; y: number; z: number },
  largeOnly = false,
) {
  const zf = z + U * t; // frozen field moving downwind (−z)
  let vx = 0, vy = 0, vz = 0;
  for (let n = 0; n < f.kx.length; n++) {
    if (largeOnly && !f.large[n]) continue;
    const c = Math.cos(f.kx[n] * x + f.ky[n] * y + f.kz[n] * zf + f.ph[n]);
    vx += f.ax[n] * c;
    vy += f.ay[n] * c;
    vz += f.az[n] * c;
  }
  out.x = vx;
  out.y = vy;
  out.z = vz;
  return out;
}

/** One field shared by the flow streaks and the wind-profile mast (same eddies). */
export const FIELD = makeTurbulence(7);
/** Wake shear-layer turbulence: ≈ ¼ D integral scale, eddies down to 6 m; no meandering modes. */
export const WAKE_FIELD = makeTurbulence(11, Infinity, 60, 6);
/** The 3D flow runs ×4 real time so the air crosses 8 D in ~40 s. */
export const FLOW_TIME_X = 4;
