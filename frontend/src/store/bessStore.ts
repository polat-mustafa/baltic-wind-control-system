/**
 * BESS tab store — frequency event, ramp smoothing, degradation, dispatch.
 *
 * Every study re-runs when its inputs change (each is a few ms on the server).
 * Battery power positive = discharging.
 */

import { create } from "zustand";

import { liveFleet } from "../lib/fleet";
import * as api from "../services/bessApi";
import type {
  BESSDispatchResponse,
  DegradationResponse,
  FrequencyResponseResult,
  RampSmoothingResult,
} from "../types/bess";

/** 1 s frequency traces, 300 s. Illustrative shapes, not recorded events. */
const t = Array.from({ length: 300 }, (_, i) => i);
const incident = (scale: number) =>
  t.map((i) => {
    if (i < 5) return 50;
    const s = i - 5;
    // quasi-steady −200 mHz plus a dynamic dip peaking at 8 s (−800 mHz in total at scale 1)
    const df = -0.2 * (1 - Math.exp(-s / 3)) - 0.6 * (s / 8) * Math.exp(1 - s / 8);
    return +(50 + scale * df).toFixed(4);
  });

export const FREQUENCY_EVENTS = {
  reference: {
    label: "3 GW loss (CE reference incident)",
    note: "Design case of the CE area: ≤ 800 mHz dynamic, 200 mHz quasi-steady deviation.",
    trace: incident(1),
  },
  overfrequency: {
    label: "Load loss — over-frequency",
    note: "Mirror event: the battery charges.",
    trace: incident(-0.6),
  },
  normal: {
    label: "Normal-day fluctuation",
    note: "±60 mHz drift: FCR works continuously at a fraction of capacity.",
    trace: t.map((i) => +(50 + 0.04 * Math.sin((2 * Math.PI * i) / 90) + 0.02 * Math.sin((2 * Math.PI * i) / 23)).toFixed(4)),
  },
} as const;
export type FrequencyEvent = keyof typeof FREQUENCY_EVENTS;

/** Wind output of SB-510 (510 MW) during a front passage, 1 min steps, 120 min [MW]: two 65 MW/min ramps. */
const WIND_KEYPOINTS: [number, number][] = [
  [0, 260], [20, 260], [23, 455], [45, 455], [53, 300], [70, 300], [73, 105], [95, 105], [119, 250],
];
export const WIND_TRACE_MW = Array.from({ length: 120 }, (_, i) => {
  const k = WIND_KEYPOINTS.findIndex(([m]) => m >= i);
  const [m0, p0] = WIND_KEYPOINTS[Math.max(0, k - 1)];
  const [m1, p1] = WIND_KEYPOINTS[k];
  const base = m1 === m0 ? p1 : p0 + ((p1 - p0) * (i - m0)) / (m1 - m0);
  return +(base + 12 * Math.sin(i / 3)).toFixed(1);
});

const SB510_MW = 510;

/** The front-passage trace scaled to a farm of `capMw` (same shape, same ramps in % of the farm per minute). */
export const windTrace = (capMw: number): number[] =>
  capMw === SB510_MW ? WIND_TRACE_MW : WIND_TRACE_MW.map((p) => +((p * capMw) / SB510_MW).toFixed(1));

/** Farm-dependent defaults: ramp limit 10 % of the farm per minute (example setting), dispatch case at ≈ 59 / 75 %. */
export const farmDefaults = (capMw: number) => ({
  farmMw: capMw,
  rampLimitMwPerMin: Math.max(5, Math.round(capMw / 10)),
  pTargetMw: 5 * Math.round((capMw * 0.59) / 5),
  pAvailableMw: 5 * Math.round((capMw * 0.745) / 5),
});

interface Params {
  /** Farm rating the farm-dependent defaults were set for [MW]. */
  farmMw: number;
  event: FrequencyEvent;
  fcrCapacityMw: number;
  ffrEnabled: boolean;
  initialSocPct: number;
  rampLimitMwPerMin: number;
  annualCycles: number;
  avgDodPct: number;
  pTargetMw: number;
  pAvailableMw: number;
}

interface BESSState extends Params {
  fcr: FrequencyResponseResult | null;
  ramp: RampSmoothingResult | null;
  degradation: DegradationResponse | null;
  dispatch: BESSDispatchResponse | null;
  error: string | null;

  setParams(p: Partial<Params>): void;
  runFcr(): Promise<void>;
  runRamp(): Promise<void>;
  runDegradation(): Promise<void>;
  runDispatch(): Promise<void>;
  clearError(): void;
}

const FFR_THRESHOLD_HZ = 49.5;

export const useBESSStore = create<BESSState>((set, get) => {
  const guard = async (fn: () => Promise<Partial<BESSState>>) => {
    try {
      set(await fn());
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  };
  return {
    fcr: null,
    ramp: null,
    degradation: null,
    dispatch: null,
    error: null,

    event: "reference",
    fcrCapacityMw: 50,
    ffrEnabled: false,
    initialSocPct: 50,
    annualCycles: 365,
    avgDodPct: 70,
    ...farmDefaults(SB510_MW),

    setParams: (p) => set(p),
    runFcr: () => {
      const { event, fcrCapacityMw, ffrEnabled, initialSocPct } = get();
      return guard(async () => ({
        fcr: await api.simFrequencyResponse({
          frequency_trace_hz: [...FREQUENCY_EVENTS[event].trace],
          fcr_capacity_mw: fcrCapacityMw,
          ffr_threshold_hz: ffrEnabled ? FFR_THRESHOLD_HZ : null,
          initial_soc_pct: initialSocPct,
        }),
      }));
    },
    runRamp: () => {
      const { rampLimitMwPerMin, initialSocPct } = get();
      return guard(async () => ({
        ramp: await api.simRampSmoothing({
          wind_power_trace_mw: windTrace(liveFleet().net.total_capacity_mw),
          max_ramp_rate_mw_per_min: rampLimitMwPerMin,
          initial_soc_pct: initialSocPct,
        }),
      }));
    },
    runDegradation: () => {
      const { annualCycles, avgDodPct } = get();
      return guard(async () => ({
        degradation: await api.calcDegradation({ years: 25, annual_cycles: annualCycles, avg_dod_pct: avgDodPct }),
      }));
    },
    runDispatch: () => {
      const { pTargetMw, pAvailableMw, initialSocPct } = get();
      return guard(async () => ({
        dispatch: await api.dispatchBESS({ p_target_mw: pTargetMw, p_available_wtg_mw: pAvailableMw, current_soc_pct: initialSocPct }),
      }));
    },
    clearError: () => set({ error: null }),
  };
});

export { FFR_THRESHOLD_HZ };
