/**
 * Zustand store for the wind farm map landing page.
 *
 * Manages simulated live data for 34 turbines + farm KPIs.
 * Uses setInterval to jitter values every 3 seconds, creating
 * a "live SCADA" feel without any backend dependency.
 *
 * Zustand selectors per-turbine minimise re-renders — only the
 * turbine whose data changed will re-render its icon.
 */

import { create } from "zustand";

import { TURBINE_POSITIONS } from "../constants/windFarmLayout";
import type { FarmKPI, TurbineData, TurbineStatus } from "../types/landing";

// ── Helper: random number in range ─────────────────────────────

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Clamp a value between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ── Initial turbine data ────────────────────────────────────────

function createInitialTurbines(): TurbineData[] {
  return TURBINE_POSITIONS.map((pos) => ({
    id: pos.id,
    stringNumber: pos.stringNumber,
    position: { x: pos.x, y: pos.y },
    status: "operating" as TurbineStatus,
    powerOutputMW: rand(12, 14),
    windSpeedMs: rand(10, 12),
  }));
}

/** Compute aggregated farm KPIs from turbine array. */
function computeKPIs(turbines: TurbineData[]): FarmKPI {
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

  return { totalOutputMW, averageWindSpeedMs, availabilityPercent, activeAlerts };
}

// ── Module-level interval (not in Zustand state) ────────────────

let _tickInterval: ReturnType<typeof setInterval> | null = null;

// ── Store Interface ─────────────────────────────────────────────

interface LandingState {
  turbines: TurbineData[];
  kpis: FarmKPI;

  /** Start the simulation tick (call on mount) */
  startSimulation: () => void;
  /** Stop the simulation tick (call on unmount) */
  stopSimulation: () => void;
}

// ── Store Implementation ────────────────────────────────────────

export const useLandingStore = create<LandingState>((set) => {
  const initialTurbines = createInitialTurbines();

  return {
    turbines: initialTurbines,
    kpis: computeKPIs(initialTurbines),

    startSimulation: () => {
      // Prevent double-start
      if (_tickInterval) return;

      _tickInterval = setInterval(() => {
        set((state) => {
          const newTurbines = state.turbines.map((t) => {
            // Jitter wind speed by ±0.5 m/s
            const newWind = clamp(t.windSpeedMs + rand(-0.5, 0.5), 6, 16);

            // Power follows wind (simplified cubic relationship, capped at 15 MW)
            const windRatio = newWind / 12.5; // rated wind speed
            const newPower =
              t.status === "fault" || t.status === "offline"
                ? 0
                : t.status === "curtailed"
                  ? clamp(windRatio * windRatio * windRatio * 15 * 0.6, 0, 9)
                  : clamp(windRatio * windRatio * windRatio * 15, 0, 15);

            return {
              ...t,
              windSpeedMs: Number(newWind.toFixed(1)),
              powerOutputMW: Number(newPower.toFixed(1)),
            };
          });

          // Randomly toggle 1 turbine status every tick
          const idx = Math.floor(Math.random() * newTurbines.length);
          const target = newTurbines[idx];
          const roll = Math.random();

          if (target.status === "operating") {
            // 5% chance → fault, 10% chance → curtailed
            if (roll < 0.05) {
              newTurbines[idx] = { ...target, status: "fault", powerOutputMW: 0 };
            } else if (roll < 0.15) {
              newTurbines[idx] = { ...target, status: "curtailed" };
            }
          } else if (target.status === "fault") {
            // 30% chance to recover
            if (roll < 0.3) {
              newTurbines[idx] = { ...target, status: "operating" };
            }
          } else if (target.status === "curtailed") {
            // 40% chance to return to normal
            if (roll < 0.4) {
              newTurbines[idx] = { ...target, status: "operating" };
            }
          } else if (target.status === "offline") {
            // 20% chance to come back online
            if (roll < 0.2) {
              newTurbines[idx] = { ...target, status: "operating" };
            }
          }

          return {
            turbines: newTurbines,
            kpis: computeKPIs(newTurbines),
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

// ── Selectors (minimise re-renders) ─────────────────────────────

/** Select a single turbine by ID — only re-renders when that turbine changes. */
export const selectTurbine = (id: string) => (state: LandingState) =>
  state.turbines.find((t) => t.id === id);

/** Select farm KPIs. */
export const selectKPIs = (state: LandingState) => state.kpis;
