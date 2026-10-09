/**
 * Zustand store for the wind farm map landing page.
 *
 * Manages simulated live data for the turbines of the live fleet
 * (lib/fleet.ts: SB-510's 34 or the own project's), 2 transformers,
 * export cable, and farm KPIs. A new fleet resets the plant. Uses setInterval to jitter values
 * every 5 seconds, creating a "live SCADA" feel without backend.
 *
 * Data is stored as Record<string, TurbineData> with a stable
 * turbineIds array. Each TurbineIcon subscribes individually
 * via selectTurbine(id) — only re-renders when its own data changes.
 */

import { create } from "zustand";

import { FAULT_TYPES } from "../constants/faultCategories";
import { liveFleet, pathToOss, useFleetStore, type Fleet } from "../lib/fleet";
import { useFaultBus } from "./faultBus";
import type {
  CableData,
  EnvironmentData,
  FarmKPI,
  TransformerData,
  TurbineData,
  TurbineStatus,
} from "../types/landing";
import type { TurbineFaultType } from "../types/scada";
import type { LiveWeather } from "../services/openMeteoApi";
import { frequencyEvent, voltageDipEvent, type GridEventKind, type GridSample } from "../utils/gridEvents";
import {
  V236,
  exportCableState,
  farmWakeDeficits,
  plantNet,
  v236PitchDeg,
  turbinePowerMW,
  v236RotorRpm,
} from "../utils/landingPhysics";

// ── Constants ──────────────────────────────────────────────────

// Turbine model (IEA 15 MW power curve, rotor speed, pitch) lives in utils/landingPhysics
// so the store, detail panel, curtailment inference and 3D viewer agree.
const RATED_POWER_MW = V236.ratedMW;

// Ramp rate limits per tick (5s) — realistic 15 MW turbine can't jump instantly
const MAX_POWER_RAMP_MW_PER_TICK = 1.5; // ≈0.30 MW/s
const MAX_ROTOR_RAMP_RPM_PER_TICK = 0.7;
const MAX_PITCH_RAMP_DEG_PER_TICK = 7.0;

// ── Helpers ────────────────────────────────────────────────────

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Gradually move `current` toward `target` by at most `maxStep`. */
function rampToward(current: number, target: number, maxStep: number): number {
  const delta = target - current;
  return current + clamp(delta, -maxStep, maxStep);
}

// ── Physics-based turbine simulation ───────────────────────────

/** Rotor speed [rpm] — 0 when stopped (fault/offline). */
/** Yaw error above which the turbine stops producing and just yaws [°]. */
export const YAW_PAUSE_DEG = 45;

/** Power fraction at yaw error γ: cos^1.88 γ (Fleming et al. 2017). */
export function yawPowerFactor(yawErrDeg: number): number {
  const c = Math.cos((yawErrDeg * Math.PI) / 180);
  return c > 0 ? c ** 1.88 : 0;
}

function computeRotorSpeed(windMs: number, status: TurbineStatus): number {
  if (status === "fault" || status === "offline") return 0;
  return v236RotorRpm(windMs);
}

/** Blade pitch [deg] — feathered (90°) when stopped. */
function computePitchAngle(windMs: number, status: TurbineStatus): number {
  if (status === "fault" || status === "offline") return 90;
  return v236PitchDeg(windMs);
}

/** Electrical power [MW] from the V236 curve; curtailed units run at 60 %. */
function computePower(windMs: number, status: TurbineStatus): number {
  if (status === "fault" || status === "offline") return 0;
  const p = turbinePowerMW(windMs);
  return status === "curtailed" ? p * 0.6 : p;
}

// ── Beaufort scale lookup ─────────────────────────────────────

const BEAUFORT: { max: number; desc: string }[] = [
  { max: 0.2, desc: "Calm" },
  { max: 1.5, desc: "Light air" },
  { max: 3.3, desc: "Light breeze" },
  { max: 5.4, desc: "Gentle breeze" },
  { max: 7.9, desc: "Moderate breeze" },
  { max: 10.7, desc: "Fresh breeze" },
  { max: 13.8, desc: "Strong breeze" },
  { max: 17.1, desc: "Near gale" },
  { max: 20.7, desc: "Gale" },
  { max: 24.4, desc: "Strong gale" },
  { max: 28.4, desc: "Storm" },
  { max: 32.6, desc: "Violent storm" },
  { max: Infinity, desc: "Hurricane" },
];

/** Compute environment / sea state from the 10 m wind speed + elapsed sim time. */
function computeEnvironment(windMs: number, elapsedS: number): EnvironmentData {
  // Beaufort scale
  const bIdx = BEAUFORT.findIndex((b) => windMs <= b.max);
  const beaufortScale = bIdx >= 0 ? bIdx : 12;
  const beaufortDesc = BEAUFORT[beaufortScale].desc;

  // Pierson-Moskowitz (fully developed sea) Hs ≈ 0.024 × U10² — an upper
  // bound for the fetch-limited Baltic; U10 is the 10 m wind, not hub wind.
  const significantWaveHeightM = round1(0.024 * windMs * windMs);
  // Peak period: Tp ≈ 5.6 × √Hs
  const wavePeriodS = round1(5.6 * Math.sqrt(Math.max(significantWaveHeightM, 0.1)));

  // Compressed day cycle — 24 h in ~5 min (300 s)
  const simulatedHour = ((elapsedS / 300) * 24) % 24;

  // Air temp: 8–15 °C, peak at ~14:00
  const airTemperatureC = round1(
    11.5 + 3.5 * Math.sin(((simulatedHour - 6) / 12) * Math.PI),
  );
  // Baltic sea surface: ~9–11 °C, slow diurnal lag
  const seaTemperatureC = round1(
    10 + 1.0 * Math.sin(((simulatedHour - 15) / 12) * Math.PI),
  );

  // Visibility reduces with wind / spray
  const visibilityKm = round1(clamp(22 - windMs * 0.9, 2, 25));

  // Cloud cover: varies 20–80 %, noisier in afternoon
  const cloudCoverPct = Math.round(
    clamp(45 + 25 * Math.sin(((simulatedHour - 2) / 12) * Math.PI), 15, 95),
  );

  // Barometric pressure: slow sinusoidal drift around 1013 hPa
  const pressureHpa = round1(1013 + 6 * Math.sin((elapsedS / 600) * Math.PI));

  return {
    beaufortScale,
    beaufortDesc,
    significantWaveHeightM,
    wavePeriodS,
    airTemperatureC,
    seaTemperatureC,
    visibilityKm,
    cloudCoverPct,
    pressureHpa,
    simulatedHour,
  };
}

// ── Initial Data ──────────────────────────────────────────────

function createInitialTurbineMap(f: Fleet): Record<string, TurbineData> {
  const map: Record<string, TurbineData> = {};
  for (const pos of f.turbines) {
    const windMs = rand(10, 12);
    const status: TurbineStatus = "operating";
    map[pos.id] = {
      id: pos.id,
      stringNumber: pos.stringNumber,
      position: { x: pos.x, y: pos.y },
      status,
      powerOutputMW: round1(computePower(windMs, status)),
      windSpeedMs: round1(windMs),
      rotorSpeedRpm: round1(computeRotorSpeed(windMs, status)),
      nacellePositionDeg: Math.round(225 + rand(-5, 5)),
      pitchAngleDeg: round1(computePitchAngle(windMs, status)),
      availabilityPct: 100,
      energyTodayMWh: round1(rand(180, 280)),
      vibrationMmS: round1(rand(0.5, 1.8)),
      bearingTempC: round1(rand(38, 48)),
      operatingHours: Math.round(rand(15000, 22000)),
    };
  }
  return map;
}

function createInitialTransformers(f: Fleet): Record<string, TransformerData> {
  return {
    "OSS-TX1": {
      name: "TX-OSS-01/02",
      type: "Three-phase ONAN/ONAF",
      ratingMVA: f.net.oss_trafo_mva,
      units: 2,
      hvKV: 220,
      lvKV: 66,
      tapPosition: 0,
      totalTaps: 17,
      oilTemperatureC: 52,
      windingTempHVC: 62,
      windingTempLVC: 58,
      loadPercent: 78,
      coolingStatus: "ONAF-1",
      buchholzStatus: "Normal",
      dgaStatus: "Normal",
      operatingHours: 18500,
    },
    "ONS-TX1": {
      name: "TX-ON-01/02",
      type: "Three-phase ONAN/ONAF",
      ratingMVA: f.net.onshore_trafo_mva,
      units: 2,
      hvKV: 400,
      lvKV: 220,
      tapPosition: -1,
      totalTaps: 19,
      oilTemperatureC: 48,
      windingTempHVC: 58,
      windingTempLVC: 54,
      loadPercent: 72,
      coolingStatus: "ONAN",
      buchholzStatus: "Normal",
      dgaStatus: "Normal",
      operatingHours: 18500,
    },
  };
}

function createInitialCable(f: Fleet): CableData {
  const net = plantNet(f);
  return {
    type:
      f.source === "sb510"
        ? "2 × 3-core XLPE, 63.5 km subsea + 13 km land (parallel circuits)"
        : `${net.circuits} × 3-core XLPE, ${net.exportKm.toFixed(0)} km (parallel circuits, route not yet surveyed)`,
    voltageRatingKV: 220,
    currentRatingA: 825, // per circuit — matches backend EXPORT_CABLE_1000 (ABB/NKT datasheet)
    lengthKm: net.exportKm,
    thermalLoadingPct: 68,
    crossSectionMm2: 1000,
    manufacturer: "Nexans",
    insulationType: "Cross-linked polyethylene (XLPE)",
    burialDepthM: 1.5,
  };
}

/** Compute aggregated farm KPIs from turbine map. */
function computeKPIs(turbineMap: Record<string, TurbineData>): FarmKPI {
  const turbines = Object.values(turbineMap);
  const totalOutputMW = turbines.reduce((sum, t) => sum + t.powerOutputMW, 0);
  const averageWindSpeedMs =
    turbines.reduce((sum, t) => sum + t.windSpeedMs, 0) / turbines.length;
  const operatingCount = turbines.filter(
    (t) => t.status === "operating" || t.status === "curtailed",
  ).length;
  const availabilityPercent = (operatingCount / turbines.length) * 100;
  const activeAlerts = turbines.filter(
    (t) => t.status === "fault" || t.status === "curtailed",
  ).length;
  const capacityFactorPct = (totalOutputMW / (turbines.length * RATED_POWER_MW)) * 100;
  // Grid frequency: mean-reverting walk (updated per tick), shown to 1 mHz
  const gridFrequencyHz = Math.round(_gridFreq * 1000) / 1000;
  // Revenue: spot price ~€80/MWh × energy produced today (sum of turbines)
  const totalEnergyMWh = turbines.reduce((sum, t) => sum + t.energyTodayMWh, 0);
  const revenueTodayEUR = Math.round(totalEnergyMWh * 80);

  return {
    totalOutputMW,
    averageWindSpeedMs,
    freestreamWindMs: _baseWindSpeed,
    availabilityPercent,
    activeAlerts,
    windDirectionDeg: _windDirDeg,
    capacityFactorPct,
    gridFrequencyHz,
    revenueTodayEUR,
  };
}

// ── Wind simulation state (module-level for continuity) ─────────

let _simStartTime = Date.now();
/** Grid frequency [Hz]: slow mean-reverting walk (normal CE operation ±≈ 50 mHz). */
let _gridFreq = 50;
/** Δ-reserve held by the power plant controller [% of available]. */
let _reservePct = 0;
let _weatherSource: "sim" | "live" = "sim";
let _live: LiveWeather | null = null;
/** Instructor / 3D-viewer override of the wind FROM bearing [°], null = sim/live. */
let _manualWindDir: number | null = null;

/** Beaufort and sea state are defined at 10 m: U10 = U150·(10/150)^0.1. */
function hubTo10m(hubMs: number): number {
  return hubMs * (10 / 150) ** 0.1;
}

/** Environment panel from Open-Meteo data (sim values kept where it has none). */
function liveEnvironment(sim: EnvironmentData, w: LiveWeather): EnvironmentData {
  const bIdx = BEAUFORT.findIndex((b) => w.wind10Ms <= b.max);
  const beaufortScale = bIdx >= 0 ? bIdx : 12;
  return {
    ...sim,
    beaufortScale,
    beaufortDesc: BEAUFORT[beaufortScale].desc,
    significantWaveHeightM: w.waveHeightM ?? sim.significantWaveHeightM,
    wavePeriodS: w.wavePeriodS ?? sim.wavePeriodS,
    airTemperatureC: round1(w.airTempC),
    seaTemperatureC: w.seaTempC ?? sim.seaTemperatureC,
    visibilityKm: round1(w.visibilityKm),
    cloudCoverPct: Math.round(w.cloudPct),
    pressureHpa: round1(w.pressureHpa),
  };
}

/**
 * Faults that need technicians on site (component damage / inspection).
 * The others are cleared by a remote reset from the control room, which is
 * how most turbine stops are resolved in practice.
 */
export const SITE_VISIT_FAULTS: TurbineFaultType[] = ["PITCH_CONTROL_FAULT", "BEARING_OVERTEMP", "GENERATOR_WINDING_TEMP"];

export interface RepairJob {
  crew: string;
  startedAt: number;
  durationMs: number;
}

export interface GridEventState {
  kind: GridEventKind;
  startedAt: number;
  /** Playback speed: 1 = real time; FRT is shown ×10 slower. */
  slowMo: number;
  reservePct: number;
  traj: GridSample[];
}
let _windDirDeg = 225; // current wind direction (meteorological)
let _baseWindSpeed = 11.0; // farm-level base wind speed

// ── Module-level interval ───────────────────────────────────────

let _tickInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Smoothed FREESTREAM wind per turbine [m/s]. Kept separately because
 * recovering it as windSpeed / (1 − δ) breaks whenever the wind direction
 * crosses a 5° wake bin: δ jumps, the "freestream" inflates and a newly
 * waked turbine keeps near-rated output while its wake badge shows −50 %.
 */
const _freeWind = new Map<string, number>();

// ── Array-cable fault scenario ──────────────────────────────────
// Radial 66 kV string: a cable fault trips the feeder CB at the OSS, so
// every turbine on the string loses its grid. After the fault is located,
// the switch on the OSS side of the faulted section is opened and the
// feeder re-closed: turbines between the OSS and the fault come back,
// the ones beyond it stay out until the cable is repaired.

/** Fault location + isolation time, time-compressed for the demo [ms]. */
export const ARRAY_FAULT_ISOLATION_MS = 20_000;

export interface ArrayCableFault {
  segmentKey: string;
  stringNumber: number;
  /** Turbines beyond the fault — out until repair. */
  beyondIds: string[];
  /** Turbines on the string not beyond the fault — back after isolation. */
  restorableIds: string[];
  /** Fault passage indicators lit: the switchgear between the fault and the OSS. */
  litIds: string[];
  stage: "tripped" | "isolated";
  /** Training: isolation is left to the operator. */
  manual: boolean;
  /** Epoch ms of the trip / of the re-energisation. */
  trippedAt: number;
  isolatedAt: number | null;
}

/** Turbines held offline by the scenario (tick and random toggler respect it). */
const _outOfService = new Set<string>();
/** Turbines currently held de-energised: SCADA switching ∪ the not-commissioned plant. */
const _deenergised = new Set<string>();
/** Turbines whose feeder SCADA switching has opened (P3 single-line). */
let _scadaOff: string[] = [];
/** The whole plant is held dead until it is commissioned. */
let _notCommissioned = false;
let _faultToken = 0;

/** Open the switch on the OSS side of the fault and re-close the feeder CB. */
function isolate(): void {
  const f = useLandingStore.getState().arrayFault;
  if (!f || f.stage !== "tripped") return;
  for (const id of f.restorableIds) _outOfService.delete(id);
  useLandingStore.setState((state) => {
    if (!state.arrayFault) return state;
    const turbineMap = setStatuses(state.turbineMap, f.restorableIds, "operating", false);
    return {
      turbineMap,
      kpis: computeKPIs(turbineMap),
      arrayFault: { ...state.arrayFault, stage: "isolated", isolatedAt: Date.now() },
    };
  });
}

function setStatuses(
  map: Record<string, TurbineData>,
  ids: Iterable<string>,
  status: TurbineStatus,
  zeroPower: boolean,
): Record<string, TurbineData> {
  const next = { ...map };
  for (const id of ids) {
    const t = next[id];
    if (t) next[id] = { ...t, status, faultType: undefined, ...(zeroPower ? { powerOutputMW: 0 } : {}) };
  }
  return next;
}

// ── Store Interface ─────────────────────────────────────────────

interface LandingState {
  turbineMap: Record<string, TurbineData>;
  turbineIds: string[];
  transformers: Record<string, TransformerData>;
  cable: CableData;
  kpis: FarmKPI;
  environment: EnvironmentData;

  // ── 3D viewer state ─────────────────────────────────────────────
  selectedTurbinePart: import("../constants/turbinePartEducation").TurbinePartId | null;
  viewerMode: "normal" | "cutaway" | "exploded";
  /** 3D scene vs. 2D isometric schematic (Phase 3.3) */
  interiorView: "3d" | "schematic";
  showAnnotationLayer: boolean;
  /** D1 — thermal temperature colour overlay */
  showThermalOverlay: boolean;
  /** D2 — CMS sensor marker spheres */
  showSensorMarkers: boolean;
  /** D3 — power flow particle animation */
  showPowerFlow: boolean;
  /** D5 — wind-field visualization (freestream arrow, streamlines, wake ribbon) */
  showWindField: boolean;
  /** Always-on wind direction arrow (separate from heavier Wind Field overlay) */
  showWindDirection: boolean;
  /** D5 — Pythagorean apparent-wind triangle at blade radii */
  showWindTriangle: boolean;
  /** D6 — blade surface vertex-color field (off | thermal | pressure | bending — model/bladeField) */
  bladeFieldMode: "off" | "thermal" | "pressure" | "bending";
  /** D7 — power-loss cascade HUD (Sankey-style breakdown) */
  showLossHUD: boolean;
  /** D8 — Cp(λ, β) mini-plot */
  showCpWidget: boolean;
  /** Scene environment — sun position driven by simulated time (0..24 h). */
  timeOfDay: number;
  /** Scene environment — sky preset (weather / time-of-day atmosphere). */
  skyPreset: "overcast" | "golden" | "night";
  setSelectedTurbinePart: (id: import("../constants/turbinePartEducation").TurbinePartId | null) => void;
  setViewerMode: (mode: "normal" | "cutaway" | "exploded") => void;
  setInteriorView: (v: "3d" | "schematic") => void;
  setShowAnnotationLayer: (visible: boolean) => void;
  setShowThermalOverlay: (v: boolean) => void;
  setShowSensorMarkers: (v: boolean) => void;
  setShowPowerFlow: (v: boolean) => void;
  setShowWindField: (v: boolean) => void;
  setShowWindDirection: (v: boolean) => void;
  setShowWindTriangle: (v: boolean) => void;
  setBladeFieldMode: (m: "off" | "thermal" | "pressure" | "bending") => void;
  setShowLossHUD: (v: boolean) => void;
  setShowCpWidget: (v: boolean) => void;
  setTimeOfDay: (hour: number) => void;
  setSkyPreset: (p: "overcast" | "golden" | "night") => void;

  startSimulation: () => void;
  stopSimulation: () => void;

  /** Reset all 3D viewer state (overlays, modes, sky, selection) to defaults. */
  resetViewerDefaults: () => void;

  /** Set a turbine to fault state (called by faultBus sync from SCADA). */
  setTurbineFault: (turbineId: string, faultType: TurbineFaultType) => void;
  /** Clear a turbine fault back to operating (called by faultBus sync from SCADA). */
  clearTurbineFault: (turbineId: string) => void;

  /**
   * SCADA switching: the turbines whose 66 kV feeder is currently dead.
   * They drop to 0 MW and stay offline until the feeder is re-energised.
   */
  setDeenergised: (ids: string[]) => void;

  /**
   * False until the farm has been commissioned (own project before the P5
   * programme is complete): every turbine is held de-energised at 0 MW and
   * the control room shows a still, dead plant.
   */
  commissioned: boolean;
  setCommissioned: (on: boolean) => void;
  /** Epoch ms when the energisation sequence overlay was started, else null. */
  energisationAt: number | null;
  playEnergisation: () => void;
  closeEnergisation: () => void;

  /** Active 66 kV array-cable fault scenario, if any. */
  arrayFault: ArrayCableFault | null;
  /** Fault on one array segment: trip the string, isolate, restore the healthy part. */
  injectArrayFault: (f: {
    segmentKey: string;
    stringNumber: number;
    stringIds: string[];
    beyondIds: string[];
    /** Training: no automatic isolation — the operator must find the section. */
    manual?: boolean;
  }) => void;
  /** Cable repaired: re-energise the whole string. */
  restoreArrayFault: () => void;
  /** Training: operator opens the switch at a chosen section. True if it was the faulted one. */
  isolateArrayFault: (segmentKey: string) => boolean;

  /** Weather source: time-compressed simulation or live Open-Meteo data. */
  weatherSource: "sim" | "live";
  liveWeather: LiveWeather | null;
  setWeatherSource: (src: "sim" | "live") => void;
  setLiveWeather: (w: LiveWeather) => void;
  /** Force the farm wind direction (°, FROM) — turbines then yaw at ≤ 1 °/s. null = release. */
  manualWindDirDeg: number | null;
  setManualWindDir: (deg: number | null) => void;

  /** Δ-reserve [%] held by the PPC (headroom for LFSM-U / FCR). */
  deltaReservePct: number;
  setDeltaReserve: (pct: number) => void;

  /** Active grid event (frequency / voltage dip), precomputed trajectory. */
  gridEvent: GridEventState | null;
  triggerGridEvent: (kind: GridEventKind) => void;
  clearGridEvent: () => void;

  /** Technicians working on a turbine (crew on site). */
  repairs: Record<string, RepairJob>;
  startRepair: (turbineId: string, crew: string, durationMs: number) => void;
  completeRepair: (turbineId: string) => void;
  /** Crew leaves before finishing (weather limit): the fault stays. */
  cancelRepair: (turbineId: string) => void;
}

// ── Viewer defaults — single source for the Reset button ───────

const VIEWER_DEFAULTS = {
  selectedTurbinePart: null,
  viewerMode: "normal" as const,
  interiorView: "3d" as const,
  showAnnotationLayer: false,
  showThermalOverlay: false,
  showSensorMarkers: false,
  showPowerFlow: false,
  showWindField: false,
  showWindDirection: true,
  showWindTriangle: false,
  bladeFieldMode: "off" as const,
  showLossHUD: false,
  showCpWidget: false,
  skyPreset: "overcast" as const,
};

// ── Store Implementation ────────────────────────────────────────

/** Fresh plant for a fleet: every turbine running, no scenario, no crews. */
function plantFor(f: Fleet) {
  const turbineMap = createInitialTurbineMap(f);
  return {
    turbineMap,
    turbineIds: f.turbines.map((t) => t.id),
    transformers: createInitialTransformers(f),
    cable: createInitialCable(f),
    kpis: computeKPIs(turbineMap),
  };
}

export const useLandingStore = create<LandingState>((set, get) => {
  /** Hold exactly the turbines that should be dead now (SCADA ∪ not commissioned). */
  const applyDeenergised = () => {
    const ids = _notCommissioned ? get().turbineIds : _scadaOff;
    const next = new Set(ids);
    const restored = [..._deenergised].filter((id) => !next.has(id));
    const dropped = ids.filter((id) => !_deenergised.has(id));
    if (!restored.length && !dropped.length) return;
    _deenergised.clear();
    for (const id of next) _deenergised.add(id);
    set((state) => {
      let turbineMap = setStatuses(state.turbineMap, dropped, "offline", true);
      turbineMap = setStatuses(turbineMap, restored, "operating", false);
      return { turbineMap, kpis: computeKPIs(turbineMap) };
    });
  };

  return {
    ...plantFor(liveFleet()),
    environment: computeEnvironment(hubTo10m(11.0), 0),

    // ── 3D viewer state ────────────────────────────────────────────
    ...VIEWER_DEFAULTS,
    timeOfDay: 14,          // default mid-afternoon (sim-driven, not in VIEWER_DEFAULTS)
    setSelectedTurbinePart: (id) => set({ selectedTurbinePart: id }),
    setViewerMode: (mode) => set({ viewerMode: mode }),
    setInteriorView: (v) => set({ interiorView: v }),
    setShowAnnotationLayer: (visible) => set({ showAnnotationLayer: visible }),
    setShowThermalOverlay: (v) => set({ showThermalOverlay: v }),
    setShowSensorMarkers: (v) => set({ showSensorMarkers: v }),
    setShowPowerFlow: (v) => set({ showPowerFlow: v }),
    setShowWindField: (v) => set({ showWindField: v }),
    setShowWindDirection: (v) => set({ showWindDirection: v }),
    setShowWindTriangle: (v) => set({ showWindTriangle: v }),
    setBladeFieldMode: (m) => set({ bladeFieldMode: m }),
    setShowLossHUD: (v) => set({ showLossHUD: v }),
    setShowCpWidget: (v) => set({ showCpWidget: v }),
    setTimeOfDay: (hour) => set({ timeOfDay: Math.max(0, Math.min(24, hour)) }),
    setSkyPreset: (p) => set({ skyPreset: p }),

    setTurbineFault: (turbineId, faultType) =>
      set((state) => {
        const t = state.turbineMap[turbineId];
        if (!t || t.status === "fault") return state;
        return {
          turbineMap: {
            ...state.turbineMap,
            [turbineId]: { ...t, status: "fault" as const, faultType },
          },
          kpis: computeKPIs({
            ...state.turbineMap,
            [turbineId]: { ...t, status: "fault" as const, faultType },
          }),
        };
      }),

    clearTurbineFault: (turbineId) =>
      set((state) => {
        const t = state.turbineMap[turbineId];
        if (!t || t.status !== "fault") return state;
        return {
          turbineMap: {
            ...state.turbineMap,
            [turbineId]: { ...t, status: "operating" as const, faultType: undefined },
          },
          kpis: computeKPIs({
            ...state.turbineMap,
            [turbineId]: { ...t, status: "operating" as const, faultType: undefined },
          }),
        };
      }),

    setDeenergised: (ids) => {
      _scadaOff = ids;
      applyDeenergised();
    },

    commissioned: true,
    setCommissioned: (on) => {
      _notCommissioned = !on;
      if (get().commissioned !== on) set({ commissioned: on });
      applyDeenergised();
    },
    energisationAt: null,
    playEnergisation: () => set({ energisationAt: Date.now() }),
    closeEnergisation: () => set({ energisationAt: null }),

    arrayFault: null,

    injectArrayFault: ({ segmentKey, stringNumber, stringIds, beyondIds, manual }) => {
      const token = ++_faultToken;
      _outOfService.clear();
      for (const id of stringIds) _outOfService.add(id);
      const restorableIds = stringIds.filter((id) => !beyondIds.includes(id));
      // fault current flows OSS → fault: along the cable path, not into other branches
      const onPath = new Set(beyondIds.flatMap((id) => pathToOss(liveFleet(), id)));
      const litIds = restorableIds.filter((id) => onPath.has(id));
      set((state) => {
        // Feeder CB trips (50/51, 50N/51N) within ~100 ms: output drops at once
        const turbineMap = setStatuses(state.turbineMap, stringIds, "offline", true);
        return {
          turbineMap,
          kpis: computeKPIs(turbineMap),
          arrayFault: {
            segmentKey,
            stringNumber,
            beyondIds,
            restorableIds,
            litIds,
            stage: "tripped",
            manual: !!manual,
            trippedAt: Date.now(),
            isolatedAt: null,
          },
        };
      });
      if (manual) return;
      setTimeout(() => {
        if (token !== _faultToken) return; // restored or replaced meanwhile
        isolate();
      }, ARRAY_FAULT_ISOLATION_MS);
    },

    isolateArrayFault: (segmentKey) => {
      const f = useLandingStore.getState().arrayFault;
      if (!f || f.stage !== "tripped" || f.segmentKey !== segmentKey) return false;
      _faultToken++; // cancel any pending auto-isolation
      isolate();
      return true;
    },

    weatherSource: "sim",
    liveWeather: null,
    setWeatherSource: (src) => {
      _weatherSource = src;
      set({ weatherSource: src });
    },
    setLiveWeather: (w) => {
      _live = w;
      set({ liveWeather: w });
    },
    manualWindDirDeg: null,
    setManualWindDir: (deg) => {
      _manualWindDir = deg === null ? null : ((deg % 360) + 360) % 360;
      set({ manualWindDirDeg: _manualWindDir });
    },

    deltaReservePct: 0,
    setDeltaReserve: (pct) => {
      _reservePct = clamp(pct, 0, 20);
      set({ deltaReservePct: _reservePct });
    },

    gridEvent: null,
    triggerGridEvent: (kind) => {
      const p = useLandingStore.getState().kpis.totalOutputMW;
      const pmax = liveFleet().net.total_capacity_mw;
      const traj = kind === "voltage-dip" ? voltageDipEvent(p, pmax) : frequencyEvent(kind, p, _reservePct, pmax);
      set({ gridEvent: { kind, startedAt: Date.now(), slowMo: kind === "voltage-dip" ? 10 : 1, reservePct: _reservePct, traj } });
    },
    clearGridEvent: () => set({ gridEvent: null }),

    repairs: {},
    startRepair: (turbineId, crew, durationMs) =>
      set((state) => ({ repairs: { ...state.repairs, [turbineId]: { crew, startedAt: Date.now(), durationMs } } })),
    cancelRepair: (turbineId) =>
      set((state) => {
        const repairs = { ...state.repairs };
        delete repairs[turbineId];
        return { repairs };
      }),
    completeRepair: (turbineId) =>
      set((state) => {
        const repairs = { ...state.repairs };
        delete repairs[turbineId];
        const t = state.turbineMap[turbineId];
        if (!t || t.status !== "fault") return { repairs };
        useFaultBus.getState().clearFault(turbineId, "landing");
        const turbineMap = { ...state.turbineMap, [turbineId]: { ...t, status: "operating" as const, faultType: undefined } };
        return { repairs, turbineMap, kpis: computeKPIs(turbineMap) };
      }),

    restoreArrayFault: () => {
      _faultToken++;
      const ids = [..._outOfService];
      _outOfService.clear();
      set((state) => {
        const turbineMap = setStatuses(state.turbineMap, ids, "operating", false);
        return { turbineMap, kpis: computeKPIs(turbineMap), arrayFault: null };
      });
    },

    startSimulation: () => {
      if (_tickInterval) return; // already running — idempotent
      _simStartTime = Date.now();

      _tickInterval = setInterval(() => {
        set((state) => {
          const newMap: Record<string, TurbineData> = {};

          // Farm-level wind direction: slow ±8° drift around 225° over ~60s with EWMA smoothing.
          // Previous generator (±30°, ±1° jitter, 20s period) produced visible flicker that
          // desynced from the compass/arrow visually. Smoothing keeps all consumers coherent.
          const elapsed = (Date.now() - _simStartTime) / 1000;
          const live = _weatherSource === "live" ? _live : null;
          const windDirTarget = _manualWindDir !== null
            ? _manualWindDir + rand(-1, 1)
            : live
            ? live.windDir100Deg + rand(-2, 2)
            : 225 + 8 * Math.sin(elapsed * (2 * Math.PI / 60)) + rand(-0.2, 0.2);
          const EWMA_ALPHA = _manualWindDir !== null ? 0.5 : 0.15; // a forced veer arrives within ~2 ticks
          // shortest angular step (the old linear EWMA broke across 0°/360°)
          const dirErr = ((windDirTarget - _windDirDeg + 540) % 360) - 180;
          _windDirDeg = (_windDirDeg + EWMA_ALPHA * dirErr + 360) % 360;

          // Grid frequency: mean-reverting random walk, ±≈ 50 mHz in normal operation
          _gridFreq = clamp(_gridFreq + (50 - _gridFreq) * 0.25 + rand(-0.012, 0.012), 49.95, 50.05);

          // Freestream wind: 3-min cycle + 15-min swell (time-compressed but
          // smooth — 36 ticks per cycle). The old 12 s period was sampled every
          // 5 s tick (below Nyquist), so the "mean" wind jumped ±3.5 m/s per tick.
          _baseWindSpeed = live
            ? // live: hub wind from Open-Meteo 100 m + short-term turbulence (TI ≈ 6 %)
              clamp(0.7 * _baseWindSpeed + 0.3 * (live.hubWindMs * (1 + rand(-0.06, 0.06))), 0, 40)
            : clamp(
                11.0 + 3.5 * Math.sin(elapsed * (2 * Math.PI / 180)) + 1.5 * Math.sin(elapsed * (2 * Math.PI / 900)),
                7, 15,
              );

          const wakeDeficits = farmWakeDeficits(_windDirDeg);
          const posById = new Map(liveFleet().turbines.map((p) => [p.id, p]));

          for (const id of state.turbineIds) {
            const t = state.turbineMap[id];

            // Per-turbine freestream varies slightly with position across the array
            const pos = posById.get(id);
            const posOffset = pos ? (pos.x * Math.cos(_windDirDeg * Math.PI / 180) + pos.y * Math.sin(_windDirDeg * Math.PI / 180)) / 800 : 0;
            const turbineBaseWind = _baseWindSpeed + posOffset * 0.5 + rand(-0.15, 0.15);
            // Smooth the FREESTREAM wind, then apply this turbine's wake deficit
            // (Bastankhah Gaussian, Katic root-sum-square, cached per 5° of direction) — the rotor sees u·(1−δ).
            const deficit = wakeDeficits.get(id) ?? 0;
            const prevFree = _freeWind.get(id) ?? t.windSpeedMs / (1 - deficit);
            const freeWind = clamp(prevFree * 0.5 + turbineBaseWind * 0.5, 0, 40);
            _freeWind.set(id, freeWind);
            const newWind = freeWind * (1 - deficit);

            // Compute TARGET values from physics — then ramp-limit for realism
            // Δ-reserve: the PPC holds back a share of the available power
            // Yaw misalignment γ between rotor axis and wind: the rotor only
            // uses the normal component, P ∝ cos^1.88 γ (Fleming et al. 2017,
            // LES + field fit). Beyond 45° the controller pauses production
            // (pitch towards feather, rotor idling) until the yaw drive has
            // caught up — the usual OEM yaw-error stop.
            const yawErrDeg = ((_windDirDeg - t.nacellePositionDeg + 540) % 360) - 180;
            const yawPause = Math.abs(yawErrDeg) > YAW_PAUSE_DEG && t.status !== "fault" && t.status !== "offline";
            const yawFactor = yawPause ? 0 : yawPowerFactor(yawErrDeg);
            const targetPower = computePower(newWind, t.status) * (1 - _reservePct / 100) * yawFactor;
            const targetRotor = computeRotorSpeed(newWind, t.status) * (yawPause ? 0.3 : 1);
            const targetPitch = yawPause ? 45 : computePitchAngle(newWind, t.status);

            // Apply ramp rate limits — a 15 MW turbine can't jump instantly.
            // Output can never exceed what the current wind supplies, though:
            // on a lull, power follows the wind down at once (Cp ≤ Betz).
            const newPower = Math.min(
              rampToward(t.powerOutputMW, targetPower, MAX_POWER_RAMP_MW_PER_TICK),
              turbinePowerMW(newWind) * yawFactor,
            );
            const newRotor = rampToward(t.rotorSpeedRpm, targetRotor, MAX_ROTOR_RAMP_RPM_PER_TICK);
            const newPitch = rampToward(t.pitchAngleDeg, targetPitch, MAX_PITCH_RAMP_DEG_PER_TICK);

            // Nacelle yaw: DNV-GL 6.10.2 limits yaw rate to ≤ 1 °/s with a small deadband
            // to prevent chatter. Tick interval is ~5s → max 5° travel per tick.
            // Deadband: ignore errors < 0.5° (below yaw-system resolution).
            const YAW_RATE_DEG_PER_S = 1.0;
            const YAW_DEADBAND_DEG = 0.5;
            const TICK_SECONDS = 5;
            const yawTarget = _windDirDeg;
            let yawError = yawTarget - t.nacellePositionDeg;
            yawError = ((yawError + 540) % 360) - 180; // shortest angular path
            const yawDelta =
              Math.abs(yawError) < YAW_DEADBAND_DEG
                ? 0
                : clamp(yawError, -YAW_RATE_DEG_PER_S * TICK_SECONDS, YAW_RATE_DEG_PER_S * TICK_SECONDS);
            const newYaw = (t.nacellePositionDeg + yawDelta + 360) % 360;

            // Vibration jitters (higher during fault onset)
            const baseVibr = t.status === "fault" ? rand(4, 8) : rand(0.6, 1.6);
            const newVibr = clamp(t.vibrationMmS * 0.7 + baseVibr * 0.3, 0.3, 10);

            // Bearing temp follows load
            const targetTemp = 35 + (newPower / RATED_POWER_MW) * 20 + (t.status === "fault" ? 25 : 0);
            const newBearingTemp = t.bearingTempC * 0.9 + targetTemp * 0.1;

            // Energy accumulates (~5s tick ≈ 0.001389 hr)
            const newEnergy = t.energyTodayMWh + newPower * (5 / 3600);

            // Round new values
            const rWind = round1(newWind);
            const rPower = round1(newPower);
            const rRotor = round1(newRotor);
            const rYaw = Math.round(newYaw);
            const rPitch = round1(newPitch);
            const rVibr = round1(newVibr);
            const rTemp = round1(newBearingTemp);
            const rEnergy = round1(newEnergy);

            // Preserve reference if nothing changed — prevents re-render
            if (
              t.windSpeedMs === rWind &&
              t.powerOutputMW === rPower &&
              t.rotorSpeedRpm === rRotor &&
              t.nacellePositionDeg === rYaw &&
              t.pitchAngleDeg === rPitch &&
              t.vibrationMmS === rVibr &&
              t.bearingTempC === rTemp &&
              t.energyTodayMWh === rEnergy
            ) {
              newMap[id] = t;
            } else {
              newMap[id] = {
                ...t,
                windSpeedMs: rWind,
                powerOutputMW: rPower,
                rotorSpeedRpm: rRotor,
                nacellePositionDeg: rYaw,
                pitchAngleDeg: rPitch,
                vibrationMmS: rVibr,
                bearingTempC: rTemp,
                energyTodayMWh: rEnergy,
              };
            }
          }

          // Randomly toggle 1 turbine status every tick
          const ids = state.turbineIds;
          const idx = Math.floor(Math.random() * ids.length);
          const targetId = ids[idx];
          const target = newMap[targetId];
          const roll = Math.random();

          if (_outOfService.has(targetId) || _deenergised.has(targetId)) {
            // held offline by the array-cable fault scenario or SCADA switching
          } else if (target.status === "operating") {
            if (roll < 0.01) {
              // Fault: set status but let ramp rates gradually bring power to 0
              // (computePower returns 0 for fault, ramp will catch up in 2-3 ticks)
              const faultType = FAULT_TYPES[Math.floor(Math.random() * FAULT_TYPES.length)];
              newMap[targetId] = { ...target, status: "fault", faultType, availabilityPct: round1(target.availabilityPct * 0.99) };
              // Publish to unified fault bus → syncs to SCADA
              useFaultBus.getState().publishFault(targetId, faultType, "landing");
            } else if (roll < 0.04) {
              newMap[targetId] = { ...target, status: "curtailed" };
            }
          } else if (target.status === "fault") {
            // remote reset works for most faults; component faults wait for the crew
            if (roll < 0.35 && !(target.faultType && SITE_VISIT_FAULTS.includes(target.faultType))) {
              newMap[targetId] = { ...target, status: "operating", faultType: undefined };
              // Clear from unified fault bus → syncs to SCADA
              useFaultBus.getState().clearFault(targetId, "landing");
            }
          } else if (target.status === "curtailed") {
            if (roll < 0.5) {
              newMap[targetId] = { ...target, status: "operating" };
            }
          } else if (target.status === "offline") {
            if (roll < 0.3) {
              newMap[targetId] = { ...target, status: "operating" };
            }
          }

          // Transformer loading = throughput / installed capacity (units × rating),
          // throughput ≈ P since the STATCOM keeps Q ≈ 0 at the grid connection.
          const kpis = computeKPIs(newMap);
          const txs = { ...state.transformers };
          for (const txId of Object.keys(txs)) {
            const tx = txs[txId];
            const loadPct = (kpis.totalOutputMW / (tx.units * tx.ratingMVA)) * 100;
            const targetOilTemp = 35 + (loadPct / 100) * 30 + rand(-1, 1);
            const cooling: TransformerData["coolingStatus"] = loadPct > 80 ? "ONAF-2" : loadPct > 55 ? "ONAF-1" : "ONAN";
            txs[txId] = {
              ...tx,
              loadPercent: round1(loadPct),
              oilTemperatureC: round1(tx.oilTemperatureC * 0.9 + targetOilTemp * 0.1),
              windingTempHVC: round1(tx.windingTempHVC * 0.9 + (targetOilTemp + 12) * 0.1),
              windingTempLVC: round1(tx.windingTempLVC * 0.9 + (targetOilTemp + 8) * 0.1),
              coolingStatus: cooling,
            };
          }

          // Export cable current loading (active + half charging current, per circuit)
          const cableThermal = exportCableState(kpis.totalOutputMW).loadingPct;

          // Environment / sea state
          let environment = computeEnvironment(hubTo10m(_baseWindSpeed), elapsed);
          if (_weatherSource === "live" && _live) environment = liveEnvironment(environment, _live);

          return {
            turbineMap: newMap,
            kpis,
            transformers: txs,
            cable: { ...state.cable, thermalLoadingPct: round1(cableThermal) },
            environment,
          };
        });
      }, 5000);
    },

    stopSimulation: () => {
      // No-op: simulation runs for the app's lifetime (3s interval, negligible cost).
      // Stopping caused race conditions with React Strict Mode and page navigation
      // where unmount/remount timing would kill the interval permanently.
    },

    resetViewerDefaults: () => set(VIEWER_DEFAULTS),
  };
});

// A new live fleet (own project ↔ SB-510, edited layout) restarts the plant:
// scenario holds, crews and the faults of the old turbines are dropped.
useFleetStore.subscribe((s, prev) => {
  if (s.fleet === prev.fleet) return;
  _faultToken++;
  _outOfService.clear();
  _deenergised.clear();
  _scadaOff = [];
  _freeWind.clear();
  useFaultBus.setState({ activeFaults: {} });
  useLandingStore.setState({ ...plantFor(s.fleet), arrayFault: null, repairs: {} });
  // A plant that is not commissioned stays dead on the new fleet too
  useLandingStore.getState().setCommissioned(useLandingStore.getState().commissioned);
});

// ── Selectors ──────────────────────────────────────────────────

export const selectTurbine = (id: string) => (state: LandingState) =>
  state.turbineMap[id];

export const selectKPIs = (state: LandingState) => state.kpis;

export const selectTurbineIds = (state: LandingState) => state.turbineIds;

export const selectTransformer = (id: string) => (state: LandingState) =>
  state.transformers[id];

export const selectCable = (state: LandingState) => state.cable;

export const selectEnvironment = (state: LandingState) => state.environment;

// ── 3D viewer selectors ─────────────────────────────────────────
export const selectTurbinePart       = (state: LandingState) => state.selectedTurbinePart;
export const selectViewerMode        = (state: LandingState) => state.viewerMode;
export const selectInteriorView      = (state: LandingState) => state.interiorView;
export const selectAnnotationFlag    = (state: LandingState) => state.showAnnotationLayer;
export const selectThermalOverlay    = (state: LandingState) => state.showThermalOverlay;
export const selectSensorMarkers     = (state: LandingState) => state.showSensorMarkers;
export const selectPowerFlow         = (state: LandingState) => state.showPowerFlow;
export const selectWindField         = (state: LandingState) => state.showWindField;
export const selectWindDirection     = (state: LandingState) => state.showWindDirection;
export const selectWindTriangle      = (state: LandingState) => state.showWindTriangle;
export const selectBladeFieldMode    = (state: LandingState) => state.bladeFieldMode;
export const selectLossHUD           = (state: LandingState) => state.showLossHUD;
export const selectCpWidget          = (state: LandingState) => state.showCpWidget;
export const selectTimeOfDay         = (state: LandingState) => state.timeOfDay;
export const selectSkyPreset         = (state: LandingState) => state.skyPreset;

// ── SLD-specific memoized selector ──────────────────────────────
// Extracts only fields SubstationSLD actually reads (power, wind, status).
// Returns the same object reference when none of those fields changed,
// preventing ReactFlow graph rebuild on every 3s tick.

export type TurbineSLDData = {
  powerOutputMW: number;
  windSpeedMs: number;
  status: string;
};

let _prevSLDMap: Record<string, TurbineSLDData> | null = null;

export const selectTurbineSLDMap = (state: LandingState): Record<string, TurbineSLDData> => {
  const raw = state.turbineMap;
  // Fast path: check if any SLD-relevant field changed
  if (_prevSLDMap) {
    let changed = false;
    for (const id of state.turbineIds) {
      const t = raw[id];
      const p = _prevSLDMap[id];
      if (!p || t.powerOutputMW !== p.powerOutputMW || t.windSpeedMs !== p.windSpeedMs || t.status !== p.status) {
        changed = true;
        break;
      }
    }
    if (!changed) return _prevSLDMap;
  }

  const next: Record<string, TurbineSLDData> = {};
  for (const id of state.turbineIds) {
    const t = raw[id];
    next[id] = { powerOutputMW: t.powerOutputMW, windSpeedMs: t.windSpeedMs, status: t.status };
  }
  _prevSLDMap = next;
  return next;
};
