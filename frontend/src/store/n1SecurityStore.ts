/** N-1 security store — the study is ~3 s of AC load flows, cached by the backend. */

import { create } from "zustand";

import { post } from "../services/apiClient";
import type { N1Request, N1Response } from "../types/n1Security";

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
  grid_ssc_mva: 10_000,
  study: null,
  loading: false,
  error: null,
  setParams: (p) => set(p),
  run: async () => {
    const { generation_fraction, grid_ssc_mva } = get();
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
