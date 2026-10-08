/** N-1 security store — the study is ~3 s of AC load flows, cached by the backend. */

import { create } from "zustand";

import { post } from "../services/apiClient";
import type { DynamicsRequest, DynamicsResponse, N1Request, N1Response } from "../types/n1Security";

export const runN1Study = (body: N1Request): Promise<N1Response> => post("/api/v1/grid/security/n1", body);

interface N1State extends N1Request {
  study: N1Response | null;
  loading: boolean;
  error: string | null;
  setParams(p: Partial<N1Request>): void;
  run(): Promise<void>;
  clearError(): void;
}

export const useN1Store = create<N1State>((set, get) => ({
  generation_fraction: 1.0,
  study: null,
  loading: false,
  error: null,
  setParams: (p) => set(p),
  run: async () => {
    const { generation_fraction, grid_ssc_mva } = get(); // grid_ssc_mva unset → the farm's
    set({ loading: true });
    try {
      set({ study: await runN1Study({ generation_fraction, grid_ssc_mva }), error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },
  clearError: () => set({ error: null }),
}));

/** Readable names for the pandapower elements. */
export const elementName = (name: string): string => {
  const head = /^Array_S(\d)_T1$/.exec(name);
  if (head) return `string ${head[1]} head cable`;
  const array = /^Array_S(\d)_T(\d)$/.exec(name);
  if (array) return `string ${array[1]} cable ${array[2]}`;
  return (
    { Export_220kV: "export cable", Trafo_66_220kV: "OSS transformer", Trafo_220_400kV: "onshore transformer" }[name] ?? name
  );
};

/** ANDES RMS event store — 4–12 s per run on the backend, so it runs on demand. */
interface DynamicsState extends DynamicsRequest {
  result: DynamicsResponse | null;
  loading: boolean;
  error: string | null;
  setParams(p: Partial<DynamicsRequest>): void;
  run(): Promise<void>;
}

export const useDynamicsStore = create<DynamicsState>((set, get) => ({
  event: "frequency",
  load_trip_mw: 3000,
  retained_voltage_pu: 0.05,
  result: null,
  loading: false,
  error: null,
  setParams: (p) => set(p),
  run: async () => {
    const { event, load_trip_mw, retained_voltage_pu } = get();
    set({ loading: true, error: null });
    try {
      set({ result: await post<DynamicsResponse>("/api/v1/grid/dynamics/andes", { event, load_trip_mw, retained_voltage_pu }) });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },
}));
