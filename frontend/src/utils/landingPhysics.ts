/**
 * Simplified plant physics for the landing-page simulation (no backend call).
 *
 * One source for the numbers the map markers, the KPI ribbon and the detail
 * panels all show, so they can never disagree. The full load-flow model is
 * the P2 backend (pandapower, `services/p2/network_model.py`); the network
 * numbers come from its design of the live fleet (lib/fleet.ts: SB-510 or the
 * own project, GET /grid/network-spec).
 */

import { liveFleet, type Fleet } from "../lib/fleet";
import { operatingPoint, powerKw, REFERENCE_TURBINE, thrustCoefficient } from "./turbineCurves";
import { computeWakeLosses } from "./wakeModel";

// ── Reactive power balance at the OSS 220 kV busbar ─────────────
// Sign convention (domain rule 4): generating Q positive, absorbing negative.

/**
 * SB-510 series I²X absorption at rated output [MVAr]: OSS trafos (vk 12.5 %,
 * 600 MVA) ≈ 54, onshore trafos (vk 14 %) ≈ 61, export cables (2 × 76.5 km)
 * ≈ 27, array cables ≈ 5. Scales with I² ≈ (P / P_rated)² at near-nominal voltage.
 */
const SB510_SERIES_LOSS_AT_RATED_MVAR = 146;

/** Network of the live fleet (SB-510: 510 MW, 2 × 76.5 km, 442 MVAr, 4 × 120 MVAr, ±120 MVAr, 2 × 300 MVA). */
export function plantNet(f: Fleet = liveFleet()) {
  const n = f.net;
  return {
    ratedMW: n.total_capacity_mw,
    /** Charging of all export circuits, Q = ωCV²L [MVAr, generating]. */
    chargingMVAr: n.cable_q_mvar,
    /** Shunt reactors: one per export circuit at each cable end (onshore + OSS); none on a short export. */
    reactorCount: n.num_reactors,
    reactorUnitMVAr: n.reactor_unit_mvar,
    statcomMVAr: n.statcom_rating_mvar,
    ossTxMVA: n.oss_trafo_mva,
    onsTxMVA: n.onshore_trafo_mva,
    circuits: n.num_export_cables,
    exportKm: n.export_length_km,
    // ponytail: scaled with capacity like backend historian (trafos sized ∝ capacity); a load flow is exact
    seriesLossAtRatedMVAr: (SB510_SERIES_LOSS_AT_RATED_MVAR * n.total_capacity_mw) / 510,
  };
}

/** Share of the STATCOM rating above which a reactor is switched out, keeping headroom (SB-510: 60 MVAr). */
const REACTOR_SWITCH_OUT_SHARE = 0.5;

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
 * losses dominate, so reactors are switched out (while the STATCOM would
 * inject more than half its rating) and the STATCOM injects.
 */
export function reactiveBalance(totalMW: number, net = plantNet()): ReactiveBalance {
  const p = Math.max(0, Math.min(1, totalMW / net.ratedMW));
  const loss = net.seriesLossAtRatedMVAr * p * p;
  const statcomFor = (n: number) => n * net.reactorUnitMVAr + loss - net.chargingMVAr;

  let n = net.reactorCount;
  // switch out only while it actually relieves the STATCOM (not swinging it past −rating)
  while (n > 0 && statcomFor(n) > REACTOR_SWITCH_OUT_SHARE * net.statcomMVAr && Math.abs(statcomFor(n - 1)) < statcomFor(n)) n -= 1;
  const statcom = Math.max(-net.statcomMVAr, Math.min(net.statcomMVAr, statcomFor(n)));

  return {
    cableMVAr: net.chargingMVAr,
    reactorsMVAr: -n * net.reactorUnitMVAr,
    seriesLossMVAr: -loss,
    statcomMVAr: statcom,
    reactorsInService: n,
  };
}

// ── 220 kV export cables (backend EXPORT_CABLE_1000; circuits and length from plantNet) ──

export const EXPORT_CABLE = {
  kV: 220,
  /** ABB/NKT 2GM5007 rev 5 Table 34: one cable 1 m deep, 20 °C seabed, 1.0 K·m/W. */
  ratedA: 825,
  ratedAmbientC: 20,
  /** AC resistance at 90 °C [Ω/km]: 0.0176 × 1.039 (skin) × (1 + 0.00393·70). */
  rOhmPerKm: 0.0233,
  /** ωL, L = 0.38 mH/km (Table 49). */
  xOhmPerKm: 0.1194,
  cNfPerKm: 190,
  /** XLPE conductor limit and seabed ambient [°C]. */
  maxConductorC: 90,
  seabedC: 15,
} as const;

export interface CableState {
  /** Per-circuit current at the loaded end [A]. */
  currentA: number;
  loadingPct: number;
  /** Steady-state conductor temperature [°C], θ = θ_amb + (90 − 20 °C)·(I/I_r)². */
  conductorC: number;
  /** I²R losses, all circuits [MW]. */
  lossesMW: number;
  /** Charging per circuit, Q = ωCV²L [MVAr]. */
  chargingMVArPerCircuit: number;
}

/**
 * Export cable state at a given farm output. Each of the n circuits carries
 * 1/n of the active current plus (with reactors at both ends) half its
 * charging current in quadrature: I = √(I_P² + (I_C/2)²).
 */
export function exportCableState(totalMW: number, net = plantNet()): CableState {
  const c = EXPORT_CABLE;
  const vLL = c.kV * 1e3;
  const chargingMVAr = (2 * Math.PI * 50 * c.cNfPerKm * 1e-9 * vLL ** 2 * net.exportKm) / 1e6;
  const iCharging = (chargingMVAr * 1e6) / (Math.sqrt(3) * vLL);
  const iActive = (Math.max(0, totalMW) * 1e6) / (Math.sqrt(3) * vLL * net.circuits);
  const current = Math.hypot(iActive, iCharging / 2);
  const ratio = current / c.ratedA;
  return {
    currentA: current,
    loadingPct: ratio * 100,
    conductorC: c.seabedC + (c.maxConductorC - c.ratedAmbientC) * ratio ** 2,
    lossesMW: (net.circuits * 3 * current ** 2 * c.rOhmPerKm * net.exportKm) / 1e6,
    chargingMVArPerCircuit: chargingMVAr,
  };
}

// ── 66 kV array cables (backend ARRAY_SECTIONS, graded by current) ──
// Ratings: ABB/NKT 2GM5007 rev 5 Table 33 (one cable 1 m deep, 20 °C seabed, 1.0 K·m/W).

export const ARRAY_KV = 66;
const ARRAY_CABLE_GRADES = [
  { mm2: 500, ratedA: 655 },
  { mm2: 630, ratedA: 715 },
  { mm2: 800, ratedA: 775 },
  { mm2: 1000, ratedA: 825 },
] as const;

/**
 * Cable grade of the k-th segment counted from the OSS (k = 0 is the
 * OSS-end cable carrying the whole string) — same rule as the backend
 * `_get_cable_grade`: the smallest section whose rating carries the turbines
 * downstream at rated power (SB-510: 1–4 → 500 mm², 5 → 630 mm², 6 → 1000 mm²).
 */
export function arrayCableGrade(segmentFromOss: number, stringLength: number) {
  const amps = arrayCableCurrentA((stringLength - segmentFromOss) * V236.ratedMW);
  return ARRAY_CABLE_GRADES.find((g) => g.ratedA >= amps - 1e-6) ?? ARRAY_CABLE_GRADES[ARRAY_CABLE_GRADES.length - 1];
}

/** Current [A] in a 66 kV cable carrying `mw` at unity power factor. */
export function arrayCableCurrentA(mw: number): number {
  return (Math.max(0, mw) * 1e6) / (Math.sqrt(3) * ARRAY_KV * 1e3);
}

// ── SB-510 turbine: V236 class, modelled with the IEA-15-240-RWT ──
// Power, thrust, rotor speed and pitch come from the official IEA 15 MW table
// (constants/turbineModels.ts, same table as backend services/p1/turbine_models.py)
// — Vestas publishes no V236 data. Low-speed direct drive: no gearbox, the
// 200-pole PMSG turns at rotor speed (backend services/turbine_physics).

export const V236 = {
  ratedMW: REFERENCE_TURBINE.ratedKw / 1000,
  cutInMs: REFERENCE_TURBINE.cutInMs,
  ratedMs: REFERENCE_TURBINE.ratedMs,
  cutOutMs: REFERENCE_TURBINE.cutOutMs,
  /** Minimum / rated rotor speed [rpm] (ROSCO VS_MinOMSpd / PC_RefSpd); tip ≈ 95 m/s at rated. */
  minRpm: REFERENCE_TURBINE.minRotorRpm,
  ratedRpm: REFERENCE_TURBINE.maxRotorRpm,
  /** PMSG pole pairs (200 poles, Gaertner et al. 2020 Table 5-4): f_e = 100·n/60 = 12.6 Hz. */
  polePairs: 100,
} as const;

/**
 * Stage efficiencies of the direct-drive power chain. Generator 96.55 % (report
 * Table 5-4) × converter 99.18 % = 95.756 %, the mechanical-to-electrical
 * efficiency behind the official table (ROSCO VS_GenEff): the table's 15 MW is at
 * the converter terminals, so rated aerodynamic power is 15 / 0.95756 = 15.66 MW.
 * The nacelle transformer (99.5 %, illustrative — not part of the reference
 * turbine) steps it up to 66 kV.
 */
export const V236_ETA = {
  generator: 0.9655,
  converter: 0.9918,
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
  generator: PowerChainStage;
  converter: PowerChainStage;
  transformer: PowerChainStage;
  /** Main-shaft torque [kN·m]; the generator turns at rotor speed (direct drive). */
  rotorTorqueKNm: number;
  generatorRpm: number;
  /** Stator electrical frequency f_e = pole pairs · n / 60 [Hz]. */
  generatorHz: number;
}

/**
 * Rotor thrust coefficient from the reference table: ≈ 0.78 below rated
 * (near-optimal induction, a ≈ 0.27), then pitch sheds load and Ct falls —
 * the peak-at-rated thrust curve of pitch-regulated turbines. Zero outside
 * cut-in … cut-out.
 */
export function turbineThrustCoefficient(windMs: number): number {
  return thrustCoefficient(REFERENCE_TURBINE, windMs);
}

/** Rotor thrust T = ½ρAv²·Ct [MN] (≈ 2.5 MN at rated). */
export function v236ThrustMN(windMs: number): number {
  const area = Math.PI * (ROTOR_DIAMETER_M / 2) ** 2;
  return (0.5 * 1.225 * area * windMs ** 2 * turbineThrustCoefficient(windMs)) / 1e6;
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

/**
 * Power chain around the turbine's electrical output P (the official table, at the
 * converter terminals): backwards to the rotor, P_rotor = P / (η_gen·η_conv), and
 * forwards through the nacelle transformer to 66 kV, P_66 = P·η_tr.
 */
export function v236PowerChain(electricalMW: number, windMs: number, rotorRpm: number): PowerChain {
  const p = Math.max(0, electricalMW);
  const genOut = p / V236_ETA.converter;
  const rotorMW = genOut / V236_ETA.generator;
  const windMW = (0.5 * 1.225 * Math.PI * (ROTOR_DIAMETER_M / 2) ** 2 * Math.max(0, windMs) ** 3) / 1e6;
  const omega = (rotorRpm * 2 * Math.PI) / 60;
  return {
    windMW,
    rotorMW,
    cp: windMW > 0 ? Math.min(16 / 27, rotorMW / windMW) : 0,
    generator: { outMW: genOut, lossMW: rotorMW - genOut },
    converter: { outMW: p, lossMW: genOut - p },
    transformer: { outMW: p * V236_ETA.transformer, lossMW: p * (1 - V236_ETA.transformer) },
    rotorTorqueKNm: omega > 0 ? (rotorMW * 1e3) / omega : 0,
    generatorRpm: rotorRpm,
    generatorHz: (V236.polePairs * rotorRpm) / 60,
  };
}

/** Electrical output [MW] from the reference power curve (IEA 15 MW table). */
export function turbinePowerMW(windMs: number): number {
  return powerKw(REFERENCE_TURBINE, windMs) / 1000;
}

/**
 * Rotor speed [rpm] from the official table: 5.0 rpm (minimum) up to ≈ 7 m/s, then
 * λ = 9 tracking, 7.52 rpm (95 m/s tip speed) from rated. 0 when parked.
 */
export function v236RotorRpm(windMs: number): number {
  return operatingPoint(REFERENCE_TURBINE, windMs).rotorRpm;
}

/**
 * Collective pitch [deg] from the official table: 3.9° at cut-in (minimum-pitch
 * schedule), 0° from ≈ 6.9 m/s to rated, then pitched out to shed power (≈ 11.5° at
 * 15 m/s, 17.7° at 20, 22.8° at 25). Feathered (90°) outside the operating range.
 */
export function v236PitchDeg(windMs: number): number {
  return operatingPoint(REFERENCE_TURBINE, windMs).pitchDeg;
}

// ── Wakes (Jensen/Park, utils/wakeModel) ──────────────────────────

const WAKE_DIR_STEP_DEG = 5;
const wakeCache = new WeakMap<Fleet, Map<number, Map<string, number>>>();

/**
 * Velocity deficit Δu/u₀ per turbine for a wind direction, quantised to 5°
 * (same step as the map's wake layer) and cached per fleet — n² geometry per step.
 * ponytail: constant Ct = 0.8; above rated a real rotor pitches and Ct drops,
 * so high-wind deficits are overstated. Use a Ct(v) table if that matters.
 */
export function farmWakeDeficits(windFromDeg: number, f: Fleet = liveFleet()): Map<string, number> {
  const dir = ((Math.round(windFromDeg / WAKE_DIR_STEP_DEG) * WAKE_DIR_STEP_DEG) % 360 + 360) % 360;
  let byDir = wakeCache.get(f);
  if (!byDir) wakeCache.set(f, (byDir = new Map()));
  let deficits = byDir.get(dir);
  if (!deficits) {
    const geo = f.turbines.map(({ id, lat, lon }) => ({ id, lat, lon }));
    deficits = new Map(computeWakeLosses(geo, dir).map((w) => [w.turbineId, w.deficit]));
    byDir.set(dir, deficits);
  }
  return deficits;
}

/**
 * Live wake power loss [%] at a freestream wind: 1 − P(u·(1−δ)) / P(u).
 * Unlike the cubic rule of thumb this is right above rated too — a waked
 * turbine at 13 m/s freestream may still reach 15 MW and lose nothing.
 */
export function wakePowerLossPct(freestreamMs: number, deficit: number): number {
  const free = turbinePowerMW(freestreamMs);
  if (free <= 0) return 0;
  return (1 - turbinePowerMW(freestreamMs * (1 - deficit)) / free) * 100;
}

// ── Offshore wind statistics ──────────────────────────────────────

/** Hub height [m] (IEA 15 MW reference, backend wake_model). */
export const HUB_HEIGHT_M = REFERENCE_TURBINE.hubHeightM;
/** Rotor diameter [m] (IEA 15 MW reference, 241.35 m; nominal 240 m). */
export const ROTOR_DIAMETER_M = REFERENCE_TURBINE.rotorDiameterM;
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
// R_ext of the OSS J-tube is calibrated so the 825 A datasheet rating at its 20 °C
// reference gives exactly 90 °C;
// other zones are fixed ratios of it. Zones follow the real route: J-tube
// 0–0.3 km, subsea burial to 62.7 km, HDD landfall 62.7–63.5 km, land to 76.5 km.
const DTS_ALPHA = 0.00393;
const DTS_R_AC20_OHM_PER_M = (0.0176 * 1.039) / 1000;
const DTS_R_AC90_OHM_PER_M = DTS_R_AC20_OHM_PER_M * (1 + DTS_ALPHA * 70);
const DTS_W_D = 2 * Math.PI * 50 * 190e-12 * (220e3 / Math.sqrt(3)) ** 2 * 0.001; // ≈ 0.96 W/m
const DTS_T_INT = 0.5;
const DTS_W_C_RATED = EXPORT_CABLE.ratedA ** 2 * DTS_R_AC90_OHM_PER_M;
export const DTS_R_EXT_J_TUBE =
  (EXPORT_CABLE.maxConductorC - EXPORT_CABLE.ratedAmbientC - (DTS_W_C_RATED + DTS_W_D / 2) * DTS_T_INT) / (DTS_W_C_RATED + DTS_W_D); // ≈ 3.67 K·m/W
export const DTS_ZONES = { jTubeEndKm: 0.3, hddStartKm: 62.7, hddEndKm: 63.5 } as const;

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
