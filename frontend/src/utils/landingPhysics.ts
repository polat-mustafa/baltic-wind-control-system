/**
 * Simplified plant physics for the landing-page simulation (no backend call).
 *
 * One source for the numbers the map markers, the KPI ribbon and the detail
 * panels all show, so they can never disagree. The full load-flow model is
 * the P2 backend (pandapower, `services/p2/network_model.py`); the constants
 * below mirror it.
 */

import { TURBINE_POSITIONS } from "../constants/windFarmLayout";
import { computeWakeLosses } from "./wakeModel";

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

// ── 66 kV array cables (backend ARRAY_CABLE_500/630/800, graded) ──

export const ARRAY_KV = 66;
const ARRAY_CABLE_GRADES = [
  { mm2: 500, ratedA: 715 },
  { mm2: 630, ratedA: 818 },
  { mm2: 800, ratedA: 900 },
] as const;

/**
 * Cable grade of the k-th segment counted from the OSS (k = 0 is the
 * OSS-end cable carrying the whole string) — same rule as the backend
 * `_get_cable_grade`: far third 500 mm², middle 630 mm², near OSS 800 mm².
 */
export function arrayCableGrade(segmentFromOss: number, stringLength: number) {
  const normalised = (stringLength - 1 - segmentFromOss) / Math.max(stringLength - 1, 1);
  return ARRAY_CABLE_GRADES[normalised < 0.4 ? 0 : normalised < 0.7 ? 1 : 2];
}

/** Current [A] in a 66 kV cable carrying `mw` at unity power factor. */
export function arrayCableCurrentA(mw: number): number {
  return (Math.max(0, mw) * 1e6) / (Math.sqrt(3) * ARRAY_KV * 1e3);
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

/**
 * Stage efficiencies of the V236 power chain (same values as the part
 * education cards). 15 MW nameplate is ELECTRICAL at the 66 kV terminals,
 * so rated aerodynamic power is 15 / Πη ≈ 16.3 MW.
 */
export const V236_ETA = {
  gearbox: 0.97,
  generator: 0.975,
  converter: 0.98,
  transformer: 0.995,
} as const;

export interface PowerChainStage {
  /** Power leaving this stage [MW]. */
  outMW: number;
  /** Power lost in this stage [MW]. */
  lossMW: number;
}

export interface PowerChain {
  /** Kinetic power through the rotor disk, ½ρAv³ [MW]. */
  windMW: number;
  /** Aerodynamic (rotor shaft) power [MW] and power coefficient Cp. */
  rotorMW: number;
  cp: number;
  gearbox: PowerChainStage;
  generator: PowerChainStage;
  converter: PowerChainStage;
  transformer: PowerChainStage;
  /** Low-speed shaft torque [kN·m] and generator speed [rpm]. */
  rotorTorqueKNm: number;
  generatorRpm: number;
}

/**
 * Walk the chain backwards from the measured electrical output, so every
 * stage is consistent with the MW the turbine reports:
 * P_el = P_rotor · η_gb · η_gen · η_conv · η_tr.
 */
/**
 * Rotor thrust coefficient: ≈ 0.8 below rated (near-optimal induction,
 * a ≈ 0.28), then pitch sheds load so thrust falls ∝ 1/v above rated
 * (Ct ∝ (v_r/v)³) — the usual peak-at-rated thrust curve of pitch-
 * regulated turbines. Zero outside cut-in … cut-out.
 */
export function v236ThrustCoefficient(windMs: number): number {
  if (windMs < V236.cutInMs || windMs > V236.cutOutMs) return 0;
  return windMs <= V236.ratedMs ? 0.8 : 0.8 * (V236.ratedMs / windMs) ** 3;
}

/** Rotor thrust T = ½ρAv²·Ct [MN] (2.6 MN at rated). */
export function v236ThrustMN(windMs: number): number {
  const area = Math.PI * (ROTOR_DIAMETER_M / 2) ** 2;
  return (0.5 * 1.225 * area * windMs ** 2 * v236ThrustCoefficient(windMs)) / 1e6;
}

/** Axial induction from Ct = 4a(1−a) (momentum theory, a ≤ 0.4). */
export function inductionFromCt(ct: number): number {
  return (1 - Math.sqrt(Math.max(0, 1 - Math.min(ct, 0.96)))) / 2;
}

/**
 * Static tower-top deflection under rotor thrust [m]: cantilever
 * δ = T·H³/(3·EI), H = 124 m, EI ≈ 2.5·10¹² N·m² (Ø 10 → 6.5 m steel
 * tube, t ≈ 60 mm), ×1.4 for monopile/soil rotation. ≈ 0.9 m at rated.
 */
export function v236TowerTopDeflectionM(thrustMN: number): number {
  const H = 124;
  const EI = 2.5e12;
  return ((thrustMN * 1e6 * H ** 3) / (3 * EI)) * 1.4;
}

/**
 * Flapwise blade-tip deflection [m], scaled from ≈ 10 m at rated thrust
 * (order reported for 15 MW-class 115–120 m blades); the prebend (5 m) is
 * what keeps the tip clear of the tower.
 */
export function v236TipDeflectionM(thrustMN: number): number {
  return (10 * thrustMN) / v236ThrustMN(V236.ratedMs);
}

export function v236PowerChain(electricalMW: number, windMs: number, rotorRpm: number): PowerChain {
  const p = Math.max(0, electricalMW);
  const trIn = p / V236_ETA.transformer;
  const convIn = trIn / V236_ETA.converter;
  const genIn = convIn / V236_ETA.generator;
  const rotorMW = genIn / V236_ETA.gearbox;
  const windMW = (0.5 * 1.225 * Math.PI * (ROTOR_DIAMETER_M / 2) ** 2 * Math.max(0, windMs) ** 3) / 1e6;
  const omega = (rotorRpm * 2 * Math.PI) / 60;
  return {
    windMW,
    rotorMW,
    cp: windMW > 0 ? Math.min(16 / 27, rotorMW / windMW) : 0,
    gearbox: { outMW: genIn, lossMW: rotorMW - genIn },
    generator: { outMW: convIn, lossMW: genIn - convIn },
    converter: { outMW: trIn, lossMW: convIn - trIn },
    transformer: { outMW: p, lossMW: trIn - p },
    rotorTorqueKNm: omega > 0 ? (rotorMW * 1e3) / omega : 0,
    generatorRpm: rotorRpm * V236.gearRatio,
  };
}

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

// ── Wakes (Jensen/Park, utils/wakeModel) ──────────────────────────

const WAKE_DIR_STEP_DEG = 5;
const wakeCache = new Map<number, Map<string, number>>();

/**
 * Velocity deficit Δu/u₀ per turbine for a wind direction, quantised to 5°
 * (same step as the map's wake layer) and cached — 34² geometry per step.
 * ponytail: constant Ct = 0.8; above rated a real rotor pitches and Ct drops,
 * so high-wind deficits are overstated. Use a Ct(v) table if that matters.
 */
export function farmWakeDeficits(windFromDeg: number): Map<string, number> {
  const dir = ((Math.round(windFromDeg / WAKE_DIR_STEP_DEG) * WAKE_DIR_STEP_DEG) % 360 + 360) % 360;
  let deficits = wakeCache.get(dir);
  if (!deficits) {
    const geo = TURBINE_POSITIONS.map(({ id, lat, lon }) => ({ id, lat, lon }));
    deficits = new Map(computeWakeLosses(geo, dir).map((w) => [w.turbineId, w.deficit]));
    wakeCache.set(dir, deficits);
  }
  return deficits;
}

/**
 * Live wake power loss [%] at a freestream wind: 1 − P(u·(1−δ)) / P(u).
 * Unlike the cubic rule of thumb this is right above rated too — a waked
 * turbine at 13 m/s freestream may still reach 15 MW and lose nothing.
 */
export function wakePowerLossPct(freestreamMs: number, deficit: number): number {
  const free = v236PowerMW(freestreamMs);
  if (free <= 0) return 0;
  return (1 - v236PowerMW(freestreamMs * (1 - deficit)) / free) * 100;
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

// ── Export cable DTS profile (same model as backend services/p2/cable_dts.py) ──
// IEC 60287 steady state per conductor, R_AC(T) self-consistent, dielectric
// loss counted (U0 = 127 kV): T_c − T_amb = (W_c + ½W_d)·T_int + (W_c + W_d)·R_ext.
// R_ext of the OSS J-tube is calibrated so 950 A at 15 °C gives exactly 90 °C;
// other zones are fixed ratios of it. Zones follow the real route: J-tube
// 0–0.3 km, subsea burial to 31.0 km, HDD landfall 31.0–31.8 km, land to 45 km.
const DTS_ALPHA = 0.00393;
const DTS_R_AC20_OHM_PER_M = (0.0176 * 1.039) / 1000;
const DTS_R_AC90_OHM_PER_M = DTS_R_AC20_OHM_PER_M * (1 + DTS_ALPHA * 70);
const DTS_W_D = 2 * Math.PI * 50 * 190e-12 * (220e3 / Math.sqrt(3)) ** 2 * 0.001; // ≈ 0.96 W/m
const DTS_T_INT = 0.5;
const DTS_W_C_RATED = 950 ** 2 * DTS_R_AC90_OHM_PER_M;
export const DTS_R_EXT_J_TUBE = (75 - (DTS_W_C_RATED + DTS_W_D / 2) * DTS_T_INT) / (DTS_W_C_RATED + DTS_W_D); // ≈ 2.92 K·m/W
export const DTS_ZONES = { jTubeEndKm: 0.3, hddStartKm: 31.0, hddEndKm: 31.8 } as const;

function dtsRExt(km: number): number {
  if (km <= DTS_ZONES.jTubeEndKm) return DTS_R_EXT_J_TUBE;
  if (km < DTS_ZONES.hddStartKm) return (DTS_R_EXT_J_TUBE / 1.4) * (1 + 0.05 * Math.sin((2 * Math.PI * km) / 8));
  if (km <= DTS_ZONES.hddEndKm) return (DTS_R_EXT_J_TUBE * 1.3) / 1.4;
  return (DTS_R_EXT_J_TUBE * 1.1) / 1.4;
}

export function dtsZoneName(km: number): string {
  if (km <= DTS_ZONES.jTubeEndKm) return "OSS J-tube (cable in air)";
  if (km < DTS_ZONES.hddStartKm) return "subsea burial";
  if (km <= DTS_ZONES.hddEndKm) return "HDD landfall, Zaleskie";
  return "land cable";
}

/** Conductor temperature [°C] at km from the OSS, per circuit current [A]; Infinity on thermal runaway. */
export function dtsTempC(km: number, currentA: number, ambientC: number): number {
  const a = currentA ** 2 * DTS_R_AC20_OHM_PER_M;
  const rExt = dtsRExt(km);
  const k = DTS_T_INT + rExt;
  const denom = 1 - a * k * DTS_ALPHA;
  if (denom <= 0) return Infinity;
  return (ambientC + a * k * (1 - 20 * DTS_ALPHA) + DTS_W_D * (DTS_T_INT / 2 + rExt)) / denom;
}
