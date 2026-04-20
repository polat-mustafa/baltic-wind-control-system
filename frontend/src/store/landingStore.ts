/**
 * Zustand store for the wind farm map landing page.
 *
 * Manages simulated live data for 34 turbines, 2 transformers,
 * export cable, and farm KPIs. Uses setInterval to jitter values
 * every 5 seconds, creating a "live SCADA" feel without backend.
 *
 * Data is stored as Record<string, TurbineData> with a stable
 * turbineIds array. Each TurbineIcon subscribes individually
 * via selectTurbine(id) — only re-renders when its own data changes.
 */

import { create } from "zustand";

import { FAULT_TYPES } from "../constants/faultCategories";
import { TURBINE_POSITIONS } from "../constants/windFarmLayout";
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

// ── Constants ──────────────────────────────────────────────────

const RATED_WIND_MS = 12.5;
const RATED_POWER_MW = 15.0;
const RATED_ROTOR_RPM = 9.55;
const CUT_IN_MS = 3.0;
const CUT_OUT_MS = 31.0;

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

/** Compute rotor speed from wind speed (proportional below rated). */
function computeRotorSpeed(windMs: number, status: TurbineStatus): number {
  if (status === "fault" || status === "offline") return 0;
  if (windMs < CUT_IN_MS || windMs > CUT_OUT_MS) return 0;
  return clamp((windMs / RATED_WIND_MS) * RATED_ROTOR_RPM, 0, RATED_ROTOR_RPM);
}

/** Compute blade pitch from wind speed (0 below rated, increases above). */
function computePitchAngle(windMs: number, status: TurbineStatus): number {
  if (status === "fault" || status === "offline") return 90; // feathered
  if (windMs <= RATED_WIND_MS) return 0;
  // Linear ramp from 0 at rated to 25 at cut-out
  return clamp(((windMs - RATED_WIND_MS) / (CUT_OUT_MS - RATED_WIND_MS)) * 25, 0, 25);
}

/** Compute power from wind (cubic below rated, constant above). */
function computePower(windMs: number, status: TurbineStatus): number {
  if (status === "fault" || status === "offline") return 0;
  const ratio = windMs / RATED_WIND_MS;
  const raw = ratio * ratio * ratio * RATED_POWER_MW;
  const capped = clamp(raw, 0, RATED_POWER_MW);
  return status === "curtailed" ? capped * 0.6 : capped;
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

/** Compute environment / sea state from wind speed + elapsed sim time. */
function computeEnvironment(windMs: number, elapsedS: number): EnvironmentData {
  // Beaufort scale
  const bIdx = BEAUFORT.findIndex((b) => windMs <= b.max);
  const beaufortScale = bIdx >= 0 ? bIdx : 12;
  const beaufortDesc = BEAUFORT[beaufortScale].desc;

  // Pierson-Moskowitz simplified: Hs ≈ 0.024 × U²
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

const TURBINE_IDS = TURBINE_POSITIONS.map((p) => p.id);

function createInitialTurbineMap(): Record<string, TurbineData> {
  const map: Record<string, TurbineData> = {};
  for (const pos of TURBINE_POSITIONS) {
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

function createInitialTransformers(): Record<string, TransformerData> {
  return {
    "OSS-TX1": {
      name: "OSS-TX1",
      type: "Three-phase ONAN/ONAF",
      ratingMVA: 300,
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
      name: "ONS-TX1",
      type: "Three-phase ONAN/ONAF",
      ratingMVA: 400,
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

function createInitialCable(): CableData {
  return {
    type: "3-core XLPE submarine",
    voltageRatingKV: 220,
    currentRatingA: 825,
    lengthKm: 45,
    thermalLoadingPct: 68,
    crossSectionMm2: 800,
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
  const capacityFactorPct = (totalOutputMW / 510) * 100;
  // Grid frequency: 50 Hz ± small random drift (±0.05 Hz)
  const gridFrequencyHz = round1(50.0 + (Math.random() - 0.5) * 0.1);
  // Revenue: spot price ~€80/MWh × energy produced today (sum of turbines)
  const totalEnergyMWh = turbines.reduce((sum, t) => sum + t.energyTodayMWh, 0);
  const revenueTodayEUR = Math.round(totalEnergyMWh * 80);

  return {
    totalOutputMW,
    averageWindSpeedMs,
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
let _windDirDeg = 225; // current wind direction (meteorological)
let _baseWindSpeed = 11.0; // farm-level base wind speed

// ── Module-level interval ───────────────────────────────────────

let _tickInterval: ReturnType<typeof setInterval> | null = null;

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
  /** D5 — Pythagorean apparent-wind triangle at blade radii */
  showWindTriangle: boolean;
  /** D6 — blade surface vertex-color field (off | thermal | pressure-Cp | strain) */
  bladeFieldMode: "off" | "thermal" | "pressure" | "strain";
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
  setShowWindTriangle: (v: boolean) => void;
  setBladeFieldMode: (m: "off" | "thermal" | "pressure" | "strain") => void;
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
  showWindTriangle: false,
  bladeFieldMode: "off" as const,
  showLossHUD: false,
  showCpWidget: false,
  skyPreset: "overcast" as const,
};

// ── Store Implementation ────────────────────────────────────────

export const useLandingStore = create<LandingState>((set) => {
  const initialMap = createInitialTurbineMap();

  return {
    turbineMap: initialMap,
    turbineIds: TURBINE_IDS,
    transformers: createInitialTransformers(),
    cable: createInitialCable(),
    kpis: computeKPIs(initialMap),
    environment: computeEnvironment(11.0, 0),

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

    startSimulation: () => {
      if (_tickInterval) return; // already running — idempotent
      _simStartTime = Date.now();

      _tickInterval = setInterval(() => {
        set((state) => {
          const newMap: Record<string, TurbineData> = {};

          // Update farm-level wind direction: sinusoidal drift ±30° around 225°, ~20s period + noise
          const elapsed = (Date.now() - _simStartTime) / 1000;
          _windDirDeg = (225 + 30 * Math.sin(elapsed * (2 * Math.PI / 20)) + rand(-1, 1) + 360) % 360;

          // Update base wind speed: gradual ramp with ~12s period
          _baseWindSpeed = clamp(
            11.0 + 3.5 * Math.sin(elapsed * (2 * Math.PI / 12)) + 1.5 * Math.sin(elapsed * (2 * Math.PI / 40)),
            7, 15,
          );

          for (const id of state.turbineIds) {
            const t = state.turbineMap[id];

            // Per-turbine wind varies based on position relative to wind direction (wake effect proxy)
            const pos = TURBINE_POSITIONS.find((p) => p.id === id);
            const posOffset = pos ? (pos.x * Math.cos(_windDirDeg * Math.PI / 180) + pos.y * Math.sin(_windDirDeg * Math.PI / 180)) / 800 : 0;
            const turbineBaseWind = _baseWindSpeed + posOffset * 0.5 + rand(-0.15, 0.15);
            const newWind = clamp(t.windSpeedMs * 0.5 + turbineBaseWind * 0.5, 5, 16);

            // Compute TARGET values from physics — then ramp-limit for realism
            const targetPower = computePower(newWind, t.status);
            const targetRotor = computeRotorSpeed(newWind, t.status);
            const targetPitch = computePitchAngle(newWind, t.status);

            // Apply ramp rate limits — a 15 MW turbine can't jump instantly
            const newPower = rampToward(t.powerOutputMW, targetPower, MAX_POWER_RAMP_MW_PER_TICK);
            const newRotor = rampToward(t.rotorSpeedRpm, targetRotor, MAX_ROTOR_RAMP_RPM_PER_TICK);
            const newPitch = rampToward(t.pitchAngleDeg, targetPitch, MAX_PITCH_RAMP_DEG_PER_TICK);

            // Nacelle yaw drifts slowly toward dynamic wind direction
            const yawTarget = _windDirDeg;
            const yawDelta = clamp((yawTarget - t.nacellePositionDeg) * 0.1, -2, 2);
            const newYaw = (t.nacellePositionDeg + yawDelta + rand(-0.25, 0.25) + 360) % 360;

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

          if (target.status === "operating") {
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
            if (roll < 0.35) {
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

          // Update transformer loading based on total power
          const kpis = computeKPIs(newMap);
          const loadPct = (kpis.totalOutputMW / 510) * 100;
          const txs = { ...state.transformers };
          for (const txId of Object.keys(txs)) {
            const tx = txs[txId];
            const targetOilTemp = 35 + (loadPct / 100) * 30 + rand(-1, 1);
            const cooling: TransformerData["coolingStatus"] = loadPct > 90 ? "ONAF-2" : loadPct > 70 ? "ONAF-1" : "ONAN";
            txs[txId] = {
              ...tx,
              loadPercent: round1(loadPct),
              oilTemperatureC: round1(tx.oilTemperatureC * 0.9 + targetOilTemp * 0.1),
              windingTempHVC: round1(tx.windingTempHVC * 0.9 + (targetOilTemp + 12) * 0.1),
              windingTempLVC: round1(tx.windingTempLVC * 0.9 + (targetOilTemp + 8) * 0.1),
              coolingStatus: cooling,
            };
          }

          // Cable thermal loading follows power
          const cableThermal = clamp((kpis.totalOutputMW / 510) * 85, 5, 100);

          // Environment / sea state
          const environment = computeEnvironment(_baseWindSpeed, elapsed);

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
