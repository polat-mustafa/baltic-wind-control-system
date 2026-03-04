/**
 * Zustand store for the wind farm map landing page.
 *
 * Manages simulated live data for 34 turbines, 2 transformers,
 * export cable, and farm KPIs. Uses setInterval to jitter values
 * every 3 seconds, creating a "live SCADA" feel without backend.
 *
 * Data is stored as Record<string, TurbineData> with a stable
 * turbineIds array. Each TurbineIcon subscribes individually
 * via selectTurbine(id) — only re-renders when its own data changes.
 */

import { create } from "zustand";

import { TURBINE_POSITIONS } from "../constants/windFarmLayout";
import type {
  CableData,
  FarmKPI,
  TransformerData,
  TurbineData,
  TurbineStatus,
} from "../types/landing";

// ── Constants ──────────────────────────────────────────────────

const RATED_WIND_MS = 12.5;
const RATED_POWER_MW = 15.0;
const RATED_ROTOR_RPM = 9.55;
const CUT_IN_MS = 3.0;
const CUT_OUT_MS = 31.0;

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

  startSimulation: () => void;
  stopSimulation: () => void;
}

// ── Store Implementation ────────────────────────────────────────

export const useLandingStore = create<LandingState>((set) => {
  const initialMap = createInitialTurbineMap();

  return {
    turbineMap: initialMap,
    turbineIds: TURBINE_IDS,
    transformers: createInitialTransformers(),
    cable: createInitialCable(),
    kpis: computeKPIs(initialMap),

    startSimulation: () => {
      if (_tickInterval) return;
      _simStartTime = Date.now();

      _tickInterval = setInterval(() => {
        set((state) => {
          const newMap: Record<string, TurbineData> = {};

          // Update farm-level wind direction: sinusoidal drift ±30° around 225°, ~20s period + noise
          const elapsed = (Date.now() - _simStartTime) / 1000;
          _windDirDeg = (225 + 30 * Math.sin(elapsed * (2 * Math.PI / 20)) + rand(-2, 2) + 360) % 360;

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
            const turbineBaseWind = _baseWindSpeed + posOffset * 0.5 + rand(-0.3, 0.3);
            const newWind = clamp(t.windSpeedMs * 0.5 + turbineBaseWind * 0.5, 5, 16);
            const newPower = computePower(newWind, t.status);
            const newRotor = computeRotorSpeed(newWind, t.status);
            const newPitch = computePitchAngle(newWind, t.status);

            // Nacelle yaw drifts slowly toward dynamic wind direction
            const yawTarget = _windDirDeg;
            const yawDelta = clamp((yawTarget - t.nacellePositionDeg) * 0.1, -2, 2);
            const newYaw = (t.nacellePositionDeg + yawDelta + rand(-0.5, 0.5) + 360) % 360;

            // Vibration jitters (higher during fault onset)
            const baseVibr = t.status === "fault" ? rand(4, 8) : rand(0.5, 2.0);
            const newVibr = clamp(t.vibrationMmS * 0.7 + baseVibr * 0.3, 0.3, 10);

            // Bearing temp follows load
            const targetTemp = 35 + (newPower / RATED_POWER_MW) * 20 + (t.status === "fault" ? 25 : 0);
            const newBearingTemp = t.bearingTempC * 0.9 + targetTemp * 0.1;

            // Energy accumulates (~3s tick ≈ 0.000833 hr)
            const newEnergy = t.energyTodayMWh + newPower * (3 / 3600);

            newMap[id] = {
              ...t,
              windSpeedMs: round1(newWind),
              powerOutputMW: round1(newPower),
              rotorSpeedRpm: round1(newRotor),
              nacellePositionDeg: Math.round(newYaw),
              pitchAngleDeg: round1(newPitch),
              vibrationMmS: round1(newVibr),
              bearingTempC: round1(newBearingTemp),
              energyTodayMWh: round1(newEnergy),
            };
          }

          // Randomly toggle 1 turbine status every tick
          const ids = state.turbineIds;
          const idx = Math.floor(Math.random() * ids.length);
          const targetId = ids[idx];
          const target = newMap[targetId];
          const roll = Math.random();

          if (target.status === "operating") {
            if (roll < 0.05) {
              newMap[targetId] = { ...target, status: "fault", powerOutputMW: 0, rotorSpeedRpm: 0, pitchAngleDeg: 90, availabilityPct: round1(target.availabilityPct * 0.99) };
            } else if (roll < 0.15) {
              newMap[targetId] = { ...target, status: "curtailed" };
            }
          } else if (target.status === "fault") {
            if (roll < 0.3) {
              newMap[targetId] = { ...target, status: "operating" };
            }
          } else if (target.status === "curtailed") {
            if (roll < 0.4) {
              newMap[targetId] = { ...target, status: "operating" };
            }
          } else if (target.status === "offline") {
            if (roll < 0.2) {
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

          return {
            turbineMap: newMap,
            kpis,
            transformers: txs,
            cable: { ...state.cable, thermalLoadingPct: round1(cableThermal) },
          };
        });
      }, 3000);
    },

    stopSimulation: () => {
      if (_tickInterval) {
        clearInterval(_tickInterval);
        _tickInterval = null;
      }
    },
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
