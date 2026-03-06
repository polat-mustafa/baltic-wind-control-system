/**
 * Zustand store for Turbine Physics dashboard state.
 *
 * Manages simulation parameters, results from the turbine physics API,
 * and Cp surface data. Builds wind arrays client-side for constant /
 * oscillating scenarios; uses step-response endpoint for ramps.
 *
 * Selector discipline: only destructure primitives to avoid React #185
 * infinite re-render loops (filter/map return new array refs every call).
 */

import { create } from "zustand";

import * as api from "../services/turbinePhysicsApi";
import type {
  CpSurfaceResponse,
  SimulationResponse,
  TurbinePhysicsConfig,
} from "../services/turbinePhysicsApi";

// ── Types ────────────────────────────────────────────────────────

type Scenario = "constant" | "step_response" | "oscillating";

interface TurbinePhysicsState {
  // Data from API
  config: TurbinePhysicsConfig | null;
  cpSurface: CpSurfaceResponse | null;
  simulation: SimulationResponse | null;

  // User parameters — wind scenario
  scenario: Scenario;
  constantWindMs: number;
  stepInitMs: number;
  stepFinalMs: number;
  stepRampS: number;
  stepTotalS: number;
  oscMeanMs: number;
  oscAmplitudeMs: number;
  oscPeriodS: number;
  oscDurationS: number;

  // User parameters — simulation settings
  dt: number;
  initialRotorSpeedRpm: number;
  airDensityKgM3: number;

  // UI state
  loading: boolean;
  error: string | null;
  analysisRun: boolean;
  progress: number;
  progressMessage: string;

  // Param setters
  setScenario: (s: Scenario) => void;
  setConstantWindMs: (v: number) => void;
  setStepInitMs: (v: number) => void;
  setStepFinalMs: (v: number) => void;
  setStepRampS: (v: number) => void;
  setStepTotalS: (v: number) => void;
  setOscMeanMs: (v: number) => void;
  setOscAmplitudeMs: (v: number) => void;
  setOscPeriodS: (v: number) => void;
  setOscDurationS: (v: number) => void;
  setDt: (v: number) => void;
  setInitialRotorSpeedRpm: (v: number) => void;
  setAirDensityKgM3: (v: number) => void;

  // Data actions
  fetchConfig: () => Promise<void>;
  fetchCpSurface: () => Promise<void>;
  runSimulation: () => Promise<void>;

  // Utility
  clearError: () => void;
}

// ── Store Implementation ─────────────────────────────────────────

export const useTurbinePhysicsStore = create<TurbinePhysicsState>(
  (set, get) => ({
    // Data
    config: null,
    cpSurface: null,
    simulation: null,

    // Scenario defaults
    scenario: "step_response",
    constantWindMs: 10,
    stepInitMs: 8,
    stepFinalMs: 14,
    stepRampS: 10,
    stepTotalS: 120,
    oscMeanMs: 10,
    oscAmplitudeMs: 3,
    oscPeriodS: 30,
    oscDurationS: 120,

    // Simulation settings
    dt: 0.1,
    initialRotorSpeedRpm: 7.0,
    airDensityKgM3: 1.225,

    // UI
    loading: false,
    error: null,
    analysisRun: false,
    progress: 0,
    progressMessage: "",

    // ── Param setters ──────────────────────────────────────────

    setScenario: (s) => set({ scenario: s }),
    setConstantWindMs: (v) => set({ constantWindMs: v }),
    setStepInitMs: (v) => set({ stepInitMs: v }),
    setStepFinalMs: (v) => set({ stepFinalMs: v }),
    setStepRampS: (v) => set({ stepRampS: v }),
    setStepTotalS: (v) => set({ stepTotalS: v }),
    setOscMeanMs: (v) => set({ oscMeanMs: v }),
    setOscAmplitudeMs: (v) => set({ oscAmplitudeMs: v }),
    setOscPeriodS: (v) => set({ oscPeriodS: v }),
    setOscDurationS: (v) => set({ oscDurationS: v }),
    setDt: (v) => set({ dt: v }),
    setInitialRotorSpeedRpm: (v) => set({ initialRotorSpeedRpm: v }),
    setAirDensityKgM3: (v) => set({ airDensityKgM3: v }),

    // ── Data actions ───────────────────────────────────────────

    fetchConfig: async () => {
      try {
        const config = await api.getConfig();
        set({ config });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    },

    fetchCpSurface: async () => {
      try {
        const cpSurface = await api.getCpSurface();
        set({ cpSurface });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    },

    runSimulation: async () => {
      const state = get();
      set({
        loading: true,
        error: null,
        progress: 0,
        progressMessage: "Preparing simulation...",
      });

      try {
        let simulation: SimulationResponse;

        if (state.scenario === "step_response") {
          set({ progress: 20, progressMessage: "Running step-response..." });
          simulation = await api.postStepResponse(
            state.stepInitMs,
            state.stepFinalMs,
            state.stepRampS,
            state.stepTotalS,
            state.dt,
          );
        } else {
          // Build wind array client-side
          let windSpeeds: number[];
          const numSteps = state.scenario === "constant"
            ? Math.ceil(60 / state.dt) // 60s for constant
            : Math.ceil(state.oscDurationS / state.dt);

          if (state.scenario === "constant") {
            windSpeeds = Array(numSteps).fill(state.constantWindMs);
          } else {
            // Oscillating: mean + amplitude * sin(2π * t / period)
            windSpeeds = Array.from({ length: numSteps }, (_, i) => {
              const t = i * state.dt;
              return (
                state.oscMeanMs +
                state.oscAmplitudeMs * Math.sin((2 * Math.PI * t) / state.oscPeriodS)
              );
            });
          }

          set({ progress: 20, progressMessage: "Running simulation..." });
          simulation = await api.postSimulate(
            windSpeeds,
            state.dt,
            state.initialRotorSpeedRpm,
            state.airDensityKgM3,
          );
        }

        set({
          simulation,
          analysisRun: true,
          progress: 100,
          progressMessage: "Simulation complete",
        });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      } finally {
        set({ loading: false });
      }
    },

    // ── Utility ────────────────────────────────────────────────

    clearError: () => set({ error: null }),
  }),
);
