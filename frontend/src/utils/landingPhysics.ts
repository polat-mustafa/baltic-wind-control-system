/**
 * Simplified plant physics for the landing-page simulation (no backend call).
 *
 * One source for the numbers the map markers, the KPI ribbon and the detail
 * panels all show, so they can never disagree. The full load-flow model is
 * the P2 backend (pandapower, `services/p2/network_model.py`); the constants
 * below mirror it.
 */

// ── Reactive power balance at the OSS 220 kV busbar ─────────────
// Sign convention (domain rule 4): generating Q positive, absorbing negative.

/** Charging of 2 × 45 km 220 kV export cables, Q = ωCV²L [MVAr, generating]. */
export const CABLE_CHARGING_MVAR = 260;
/** Shunt reactors: one per export cable + one spare (N+1). */
export const REACTOR_COUNT = 3;
export const REACTOR_UNIT_MVAR = 80;
/** STATCOM rating [±MVAr]. */
export const STATCOM_RATING_MVAR = 120;
/** Farm rating [MW] and installed transformer capacity per substation [MVA]. */
export const FARM_RATED_MW = 510;
export const TX_UNIT_MVA = 300;

/**
 * Series I²X absorption at rated output [MVAr]: OSS trafos (vk 12.5 %, 600 MVA)
 * ≈ 54, onshore trafos (vk 14 %) ≈ 61, export cables ≈ 16, array cables ≈ 5.
 * Scales with I² ≈ (P / P_rated)² at near-nominal voltage.
 */
const SERIES_LOSS_AT_RATED_MVAR = 135;

/** STATCOM output above which one reactor is switched out, keeping headroom. */
const REACTOR_SWITCH_OUT_MVAR = 60;

export interface ReactiveBalance {
  /** Cable charging, generating [MVAr] (positive). */
  cableMVAr: number;
  /** Shunt reactors in service, absorbing [MVAr] (negative). */
  reactorsMVAr: number;
  /** Series I²X losses of transformers and cables, absorbing [MVAr] (negative). */
  seriesLossMVAr: number;
  /** STATCOM output that closes the balance [MVAr], clamped to its rating. */
  statcomMVAr: number;
  reactorsInService: number;
}

/**
 * Reactive balance that keeps Q ≈ 0 at the grid connection:
 *   Q_cable + Q_statcom − Q_reactors − Q_losses = 0
 * At low output the cable surplus is absorbed; near rated output the series
 * losses dominate, so one reactor is switched out and the STATCOM injects.
 */
export function reactiveBalance(totalMW: number): ReactiveBalance {
  const p = Math.max(0, Math.min(1, totalMW / FARM_RATED_MW));
  const loss = SERIES_LOSS_AT_RATED_MVAR * p * p;
  const statcomFor = (n: number) =>
    n * REACTOR_UNIT_MVAR + loss - CABLE_CHARGING_MVAR;

  let n = REACTOR_COUNT;
  if (statcomFor(n) > REACTOR_SWITCH_OUT_MVAR) n -= 1;
  const statcom = Math.max(
    -STATCOM_RATING_MVAR,
    Math.min(STATCOM_RATING_MVAR, statcomFor(n)),
  );

  return {
    cableMVAr: CABLE_CHARGING_MVAR,
    reactorsMVAr: -n * REACTOR_UNIT_MVAR,
    seriesLossMVAr: -loss,
    statcomMVAr: statcom,
    reactorsInService: n,
  };
}

// ── 220 kV export cables (backend EXPORT_CABLE_1000, 2 circuits) ──

export const EXPORT_CABLE = {
  circuits: 2,
  lengthKm: 45,
  kV: 220,
  ratedA: 950,
  /** AC resistance at 90 °C [Ω/km]: 0.0176 × 1.039 (skin) × (1 + 0.00393·70). */
  rOhmPerKm: 0.0233,
  xOhmPerKm: 0.116,
  cNfPerKm: 190,
  /** XLPE conductor limit and seabed ambient [°C]. */
  maxConductorC: 90,
  seabedC: 15,
} as const;

export interface CableState {
  /** Per-circuit current at the loaded end [A]. */
  currentA: number;
  loadingPct: number;
  /** Steady-state conductor temperature [°C], θ = θ_amb + Δθ_rated·(I/I_r)². */
  conductorC: number;
  /** I²R losses, both circuits [MW]. */
  lossesMW: number;
  /** Charging per circuit, Q = ωCV²L [MVAr]. */
  chargingMVArPerCircuit: number;
}

/**
 * Export cable state at a given farm output. Each circuit carries half the
 * active current plus (with reactors at both ends) half its charging current
 * in quadrature: I = √(I_P² + (I_C/2)²).
 */
export function exportCableState(totalMW: number): CableState {
  const c = EXPORT_CABLE;
  const vLL = c.kV * 1e3;
  const chargingMVAr = (2 * Math.PI * 50 * c.cNfPerKm * 1e-9 * vLL ** 2 * c.lengthKm) / 1e6;
  const iCharging = (chargingMVAr * 1e6) / (Math.sqrt(3) * vLL);
  const iActive = (Math.max(0, totalMW) * 1e6) / (Math.sqrt(3) * vLL * c.circuits);
  const current = Math.hypot(iActive, iCharging / 2);
  const ratio = current / c.ratedA;
  return {
    currentA: current,
    loadingPct: ratio * 100,
    conductorC: c.seabedC + (c.maxConductorC - c.seabedC) * ratio ** 2,
    lossesMW: (c.circuits * 3 * current ** 2 * c.rOhmPerKm * c.lengthKm) / 1e6,
    chargingMVArPerCircuit: chargingMVAr,
  };
}

// ── Vestas V236-15.0 MW operating model ─────────────────────────
// Mirrors the backend: power curve `services/p1/wake_model.py`
// (P = 15·(v/11.1)³ MW below rated), rotor limits `turbine_physics/rotor_dynamics.py`.

export const V236 = {
  ratedMW: 15,
  cutInMs: 3,
  ratedMs: 11.1,
  cutOutMs: 31,
  /** Minimum / rated rotor speed [rpm]; tip speed at rated ≈ 103 m/s. */
  minRpm: 4.0,
  ratedRpm: 8.33,
  /** Gearbox ratio (3-stage planetary) → generator 400 rpm at rated. */
  gearRatio: 48,
} as const;

const inOperatingRange = (v: number) => v >= V236.cutInMs && v <= V236.cutOutMs;

/** Electrical output [MW]: cubic below rated, flat at rated to cut-out. */
export function v236PowerMW(windMs: number): number {
  if (!inOperatingRange(windMs)) return 0;
  return Math.min(V236.ratedMW, V236.ratedMW * (windMs / V236.ratedMs) ** 3);
}

/** Rotor speed [rpm]: tracks optimum tip-speed ratio, clamped to 4.0–8.33 rpm. */
export function v236RotorRpm(windMs: number): number {
  if (!inOperatingRange(windMs)) return 0;
  return Math.max(V236.minRpm, Math.min(V236.ratedRpm, V236.ratedRpm * (windMs / V236.ratedMs)));
}

/**
 * Collective pitch [deg]: 0° below rated; above rated it pitches to shed
 * the excess aerodynamic power (≈ 10° at 15 m/s, ≈ 18° at 20, ≈ 25° at 25).
 * Feathered (90°) outside the operating range.
 */
export function v236PitchDeg(windMs: number): number {
  if (!inOperatingRange(windMs)) return 90;
  if (windMs <= V236.ratedMs) return 0;
  return Math.min(35, 25 * ((windMs - V236.ratedMs) / (25 - V236.ratedMs)) ** 0.75);
}

// ── Offshore wind statistics ──────────────────────────────────────

/** Hub height of the V236-15.0 MW in this project [m] (backend wake_model). */
export const HUB_HEIGHT_M = 150;
/** Rotor diameter [m]. */
export const ROTOR_DIAMETER_M = 236;
/** Offshore power-law shear exponent (neutral, low sea roughness). */
export const SHEAR_ALPHA = 0.1;

/** Offshore turbulence intensity [–]: falls with wind speed toward ~6 %. */
export function turbulenceIntensity(windMs: number): number {
  return 0.05 + 0.3 / Math.max(windMs, 3);
}

/** 3-second gust [m/s] from the 10-min mean: U · (1 + g · TI), peak factor g ≈ 3. */
export function gustMs(windMs: number): number {
  return windMs * (1 + 3 * turbulenceIntensity(windMs));
}

/** Wind speed at height z [m/s] from the hub-height value (power law). */
export function windAtHeight(hubWindMs: number, heightM: number): number {
  return hubWindMs * Math.pow(heightM / HUB_HEIGHT_M, SHEAR_ALPHA);
}
