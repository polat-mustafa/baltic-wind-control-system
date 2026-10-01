/**
 * Rolling SCADA history per turbine (10 min at the simulation's 5 s tick).
 *
 * One store subscription records every turbine on each tick, so switching the
 * viewed turbine shows its past straight away. Module-level buffers live as
 * long as the page; components re-render through useSyncExternalStore on the
 * version counter.
 */

import { useSyncExternalStore } from "react";

import { useLandingStore } from "../../../../store/landingStore";

export interface Sample {
  /** Epoch ms. */
  t: number;
  powerMW: number;
  windMs: number;
  freeWindMs: number;
  rotorRpm: number;
  pitchDeg: number;
  /** Nacelle heading − wind FROM bearing, shortest path [°]. */
  yawErrDeg: number;
}

export const HISTORY_SAMPLES = 120;

const buffers = new Map<string, Sample[]>();
const listeners = new Set<() => void>();
let version = 0;
let started = false;

function start() {
  if (started) return;
  started = true;
  let prev = useLandingStore.getState().turbineMap;
  useLandingStore.subscribe((s) => {
    if (s.turbineMap === prev) return;
    prev = s.turbineMap;
    const now = Date.now();
    const dir = s.kpis.windDirectionDeg;
    for (const [id, t] of Object.entries(s.turbineMap)) {
      const buf = buffers.get(id) ?? [];
      buf.push({
        t: now,
        powerMW: t.powerOutputMW,
        windMs: t.windSpeedMs,
        freeWindMs: s.kpis.freestreamWindMs,
        rotorRpm: t.rotorSpeedRpm,
        pitchDeg: t.pitchAngleDeg,
        yawErrDeg: ((t.nacellePositionDeg - dir + 540) % 360) - 180,
      });
      if (buf.length > HISTORY_SAMPLES) buf.shift();
      buffers.set(id, buf);
    }
    version++;
    listeners.forEach((l) => l());
  });
}

// Record from the moment the 3D chunk loads (LandingPage prefetches it), so
// the trends already hold minutes of data when the panel first opens.
start();

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getVersion = () => version;

/** Samples (oldest first) and a version that changes on every tick. */
export function useTurbineHistory(turbineId: string): { samples: readonly Sample[]; version: number } {
  const v = useSyncExternalStore(subscribe, getVersion);
  return { samples: buffers.get(turbineId) ?? [], version: v };
}
