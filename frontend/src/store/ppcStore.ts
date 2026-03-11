/**
 * Zustand store for PPC (Power Plant Controller) dashboard state.
 *
 * Manages TSO setpoint parameters, PPC control modes, simulation
 * results, and loading/error states.
 *
 * Data flow: user configures TSO setpoint + control modes →
 * runSimulation() calls POST /ppc/simulate → results populate panels.
 */

import { create } from "zustand";

import * as api from "../services/ppcApi";
import type {
  ActivePowerMode,
  PPCSimulationResponse,
  PPCStatusResponse,
  ReactivePowerMode,
} from "../types/ppc";

// ── Store Interface ────────────────────────────────────────────

interface PPCState {
  // Status snapshot
  status: PPCStatusResponse | null;

  // Simulation results
  simulation: PPCSimulationResponse | null;

  // TSO setpoint controls
  powerSetpointMW: number;
  windSpeedMS: number;
  availableTurbines: number;
  initialPowerMW: number;
  deltaReserveMW: number;
  absoluteLimitMW: number;
  frequencyHz: number;

  // Control modes
  activePowerMode: ActivePowerMode;
  reactivePowerMode: ReactivePowerMode;

  // Simulation params
  simulationDurationS: number;

  // UI state
  loading: boolean;
  error: string | null;
  simulationRun: boolean;

  // Setters
  setPowerSetpointMW: (v: number) => void;
  setWindSpeedMS: (v: number) => void;
  setAvailableTurbines: (v: number) => void;
  setDeltaReserveMW: (v: number) => void;
  setAbsoluteLimitMW: (v: number) => void;
  setFrequencyHz: (v: number) => void;
  setActivePowerMode: (m: ActivePowerMode) => void;
  setReactivePowerMode: (m: ReactivePowerMode) => void;
  setSimulationDurationS: (v: number) => void;

  // Actions
  fetchStatus: () => Promise<void>;
  runSimulation: () => Promise<void>;
  clearError: () => void;
}

// ── Store Implementation ───────────────────────────────────────

export const usePPCStore = create<PPCState>((set, get) => ({
  // Status
  status: null,

  // Simulation
  simulation: null,

  // TSO setpoint defaults
  powerSetpointMW: 300,
  windSpeedMS: 12.5,
  availableTurbines: 34,
  initialPowerMW: 510,
  deltaReserveMW: 30,
  absoluteLimitMW: 400,
  frequencyHz: 50.0,

  // Control modes
  activePowerMode: "power_reference",
  reactivePowerMode: "voltage_control",

  // Simulation params
  simulationDurationS: 600,

  // UI state
  loading: false,
  error: null,
  simulationRun: false,

  // ── Setters ──────────────────────────────────────────────────

  setPowerSetpointMW: (v) => set({ powerSetpointMW: v }),
  setWindSpeedMS: (v) => set({ windSpeedMS: v }),
  setAvailableTurbines: (v) => set({ availableTurbines: v }),
  setDeltaReserveMW: (v) => set({ deltaReserveMW: v }),
  setAbsoluteLimitMW: (v) => set({ absoluteLimitMW: v }),
  setFrequencyHz: (v) => set({ frequencyHz: v }),
  setActivePowerMode: (m) => set({ activePowerMode: m }),
  setReactivePowerMode: (m) => set({ reactivePowerMode: m }),
  setSimulationDurationS: (v) => set({ simulationDurationS: v }),

  // ── Actions ──────────────────────────────────────────────────

  fetchStatus: async () => {
    try {
      const status = await api.getPPCStatus();
      set({ status });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  runSimulation: async () => {
    const s = get();
    set({ loading: true, error: null });

    try {
      // Build TSO setpoint based on active power mode
      const tsoSetpoint: Record<string, unknown> = {};

      if (s.activePowerMode === "power_reference") {
        tsoSetpoint.active_power_mw = s.powerSetpointMW;
      } else if (s.activePowerMode === "delta_control") {
        tsoSetpoint.delta_reserve_mw = s.deltaReserveMW;
      } else if (s.activePowerMode === "absolute_limitation") {
        tsoSetpoint.absolute_limit_mw = s.absoluteLimitMW;
      } else {
        tsoSetpoint.active_power_mw = s.powerSetpointMW;
      }

      const simulation = await api.runPPCSimulation({
        tso_setpoint: tsoSetpoint,
        active_power_mode: s.activePowerMode,
        reactive_power_mode: s.reactivePowerMode,
        wind_speed_ms: s.windSpeedMS,
        available_turbines: s.availableTurbines,
        initial_power_mw: s.initialPowerMW,
        simulation_duration_s: s.simulationDurationS,
        time_step_s: 1.0,
      });

      set({ simulation, simulationRun: true });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
