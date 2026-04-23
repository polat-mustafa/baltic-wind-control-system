/**
 * Nacelle subsystems live data store.
 *
 * One Zustand slice keyed by turbineId. Each consumer mounts via
 * startPolling(turbineId) and unmounts via stopPolling(turbineId).
 * The poll loop reads the *current* turbine operating conditions from
 * landingStore and forwards them as query params to the backend, so
 * temperatures/pressures track the simulated farm state.
 */

import { create } from "zustand";

import {
  getNacelleSubsystems,
  type NacelleSubsystemsResponse,
} from "../services/nacelleSubsystemsApi";
import { useLandingStore } from "./landingStore";

interface PollHandle {
  intervalId: ReturnType<typeof setInterval>;
  refCount: number;
}

interface NacelleSubsystemsState {
  data: Record<string, NacelleSubsystemsResponse>;
  errors: Record<string, string | null>;
  startPolling: (turbineId: string, intervalMs?: number) => void;
  stopPolling: (turbineId: string) => void;
}

const _handles: Record<string, PollHandle> = {};

type Setter = (
  partial:
    | Partial<NacelleSubsystemsState>
    | ((s: NacelleSubsystemsState) => Partial<NacelleSubsystemsState>),
) => void;

async function fetchOnce(turbineId: string, set: Setter): Promise<void> {
  const t = useLandingStore.getState().turbineMap[turbineId];
  const env = useLandingStore.getState().environment;
  if (!t) return;

  const isOperating = t.status === "operating" || t.status === "curtailed";
  try {
    const response = await getNacelleSubsystems({
      power_mw: t.powerOutputMW,
      ambient_temp_c: env.airTemperatureC,
      rotor_speed_rpm: t.rotorSpeedRpm,
      pitch_deg: t.pitchAngleDeg,
      is_operating: isOperating,
      vibration_mm_s: t.vibrationMmS,
    });
    set((s) => ({
      data: { ...s.data, [turbineId]: response },
      errors: { ...s.errors, [turbineId]: null },
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    set((s) => ({
      errors: { ...s.errors, [turbineId]: msg },
    }));
  }
}

export const useNacelleSubsystemsStore = create<NacelleSubsystemsState>((set) => ({
  data: {},
  errors: {},

  startPolling: (turbineId, intervalMs = 2000) => {
    const existing = _handles[turbineId];
    if (existing) {
      existing.refCount += 1;
      return;
    }
    void fetchOnce(turbineId, set);
    const id = setInterval(() => {
      void fetchOnce(turbineId, set);
    }, intervalMs);
    _handles[turbineId] = { intervalId: id, refCount: 1 };
  },

  stopPolling: (turbineId) => {
    const handle = _handles[turbineId];
    if (!handle) return;
    handle.refCount -= 1;
    if (handle.refCount > 0) return;
    clearInterval(handle.intervalId);
    delete _handles[turbineId];
  },
}));

export const selectNacelleData = (turbineId: string) =>
  (state: NacelleSubsystemsState): NacelleSubsystemsResponse | undefined =>
    state.data[turbineId];
