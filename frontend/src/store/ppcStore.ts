/**
 * Zustand store for the PPC (Power Plant Controller) tab.
 *
 * The user sets a TSO command, wind/availability, the reactive mode and an
 * optional grid event; the dashboard re-runs POST /ppc/simulate (≈ 1200
 * steps of 0.1 s, a few tens of ms) whenever a control changes.
 */

import { create } from "zustand";

import { currentNetwork } from "./gridStore";
import * as api from "../services/ppcApi";
import type {
  ActivePowerMode,
  PPCSimulationResponse,
  PPCStatusResponse,
  ReactivePowerMode,
  TSOSetpoint,
} from "../types/ppc";

/** Grid events the simulation can apply at t = 60 s. */
export type PPCEvent = "none" | "over_frequency" | "under_frequency" | "voltage_dip" | "voltage_rise";

export const PPC_EVENTS: Record<PPCEvent, { label: string; frequency?: number; voltageStep?: number }> = {
  none: { label: "No grid event" },
  over_frequency: { label: "Frequency → 50.5 Hz", frequency: 50.5 },
  under_frequency: { label: "Frequency → 49.7 Hz", frequency: 49.7 },
  voltage_dip: { label: "Grid voltage −3 %", voltageStep: -0.03 },
  voltage_rise: { label: "Grid voltage +3 %", voltageStep: 0.03 },
};

interface PPCState {
  status: PPCStatusResponse | null;
  simulation: PPCSimulationResponse | null;

  powerSetpointMW: number;
  windSpeedMS: number;
  availableTurbines: number;
  initialPowerMW: number;
  deltaReserveMW: number;
  absoluteLimitMW: number;
  rampRateMWPerMin: number;
  frequencyHz: number;

  activePowerMode: ActivePowerMode;
  reactivePowerMode: ReactivePowerMode;
  voltageSetpointPU: number;
  reactiveSetpointMVAR: number;
  powerFactor: number;
  event: PPCEvent;

  simulationDurationS: number;

  loading: boolean;
  error: string | null;
  simulationRun: boolean;

  setPowerSetpointMW: (v: number) => void;
  setWindSpeedMS: (v: number) => void;
  setAvailableTurbines: (v: number) => void;
  setDeltaReserveMW: (v: number) => void;
  setAbsoluteLimitMW: (v: number) => void;
  setRampRateMWPerMin: (v: number) => void;
  setFrequencyHz: (v: number) => void;
  setActivePowerMode: (m: ActivePowerMode) => void;
  setReactivePowerMode: (m: ReactivePowerMode) => void;
  setVoltageSetpointPU: (v: number) => void;
  setReactiveSetpointMVAR: (v: number) => void;
  setPowerFactor: (v: number) => void;
  setEvent: (e: PPCEvent) => void;
  setSimulationDurationS: (v: number) => void;

  fetchStatus: () => Promise<void>;
  runSimulation: () => Promise<void>;
  clearError: () => void;
}

/** TSO command for the selected modes — only the fields that mode uses. */
export function buildTSOSetpoint(s: PPCState): TSOSetpoint {
  const tso: TSOSetpoint = {};
  if (s.activePowerMode === "delta_control") tso.delta_reserve_mw = s.deltaReserveMW;
  else if (s.activePowerMode === "absolute_limitation") tso.absolute_limit_mw = s.absoluteLimitMW;
  else tso.active_power_mw = s.powerSetpointMW;
  if (s.activePowerMode === "ramp_rate_control") tso.ramp_rate_mw_per_min = s.rampRateMWPerMin;
  if (s.reactivePowerMode === "voltage_control" || s.reactivePowerMode === "q_v_droop")
    tso.voltage_setpoint_pu = s.voltageSetpointPU;
  if (s.reactivePowerMode === "reactive_power") tso.reactive_power_mvar = s.reactiveSetpointMVAR;
  if (s.reactivePowerMode === "power_factor") tso.power_factor = s.powerFactor;
  return tso;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export const usePPCStore = create<PPCState>((set, get) => ({
  status: null,
  simulation: null,

  powerSetpointMW: 300,
  windSpeedMS: 12,
  availableTurbines: 34,
  initialPowerMW: 510,
  deltaReserveMW: 50,
  absoluteLimitMW: 400,
  rampRateMWPerMin: 100,
  frequencyHz: 50.0,

  activePowerMode: "power_reference",
  reactivePowerMode: "voltage_control",
  voltageSetpointPU: 1.0,
  reactiveSetpointMVAR: 0,
  powerFactor: 1.0,
  event: "over_frequency",

  simulationDurationS: 120,

  loading: false,
  error: null,
  simulationRun: false,

  setPowerSetpointMW: (v) => set({ powerSetpointMW: v }),
  setWindSpeedMS: (v) => set({ windSpeedMS: v }),
  setAvailableTurbines: (v) => set({ availableTurbines: v }),
  setDeltaReserveMW: (v) => set({ deltaReserveMW: v }),
  setAbsoluteLimitMW: (v) => set({ absoluteLimitMW: v }),
  setRampRateMWPerMin: (v) => set({ rampRateMWPerMin: v }),
  setFrequencyHz: (v) => set({ frequencyHz: v }),
  setActivePowerMode: (m) => set({ activePowerMode: m }),
  setReactivePowerMode: (m) => set({ reactivePowerMode: m }),
  setVoltageSetpointPU: (v) => set({ voltageSetpointPU: v }),
  setReactiveSetpointMVAR: (v) => set({ reactiveSetpointMVAR: v }),
  setPowerFactor: (v) => set({ powerFactor: v }),
  setEvent: (e) => set({ event: e }),
  setSimulationDurationS: (v) => set({ simulationDurationS: v }),

  fetchStatus: async () => {
    try {
      set({ status: await api.getPPCStatus() });
    } catch (err) {
      set({ error: message(err) });
    }
  },

  runSimulation: async () => {
    const s = get();
    const ev = PPC_EVENTS[s.event];
    set({ loading: true, error: null });
    try {
      const simulation = await api.runPPCSimulation({
        tso_setpoint: buildTSOSetpoint(s),
        active_power_mode: s.activePowerMode,
        reactive_power_mode: s.reactivePowerMode,
        wind_speed_ms: s.windSpeedMS,
        available_turbines: Math.min(s.availableTurbines, currentNetwork().num_turbines),
        initial_power_mw: Math.min(s.initialPowerMW, currentNetwork().total_capacity_mw),
        simulation_duration_s: s.simulationDurationS,
        time_step_s: 0.1,
        setpoint_time_s: 10,
        frequency_event_hz: ev.frequency ?? null,
        voltage_step_pu: ev.voltageStep ?? null,
        event_time_s: 60,
      });
      set({ simulation, simulationRun: true });
    } catch (err) {
      set({ error: message(err) });
    } finally {
      set({ loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
