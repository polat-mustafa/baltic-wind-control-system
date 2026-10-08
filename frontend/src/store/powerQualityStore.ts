/**
 * Power Quality tab store — harmonics, resonance scan, flicker, filter.
 *
 * Inputs: the bus to assess, grid strength and a scale on the WTG emission
 * spectrum. Every study re-runs when an input changes (each is a few ms).
 */

import { create } from "zustand";

import { currentNetwork } from "./gridStore";
import * as api from "../services/powerQualityApi";
import type {
  FilterDesignResponse,
  FlickerResponse,
  HarmonicAnalysisResponse,
  ResonanceScanResponse,
} from "../types/powerQuality";

/** Illustrative full-converter WTG emission [% of rated current] — the V236 report is not public. */
export const TYPICAL_EMISSION: Record<number, number> = {
  2: 0.2, 3: 0.3, 5: 1.0, 7: 0.8, 11: 0.5, 13: 0.4, 17: 0.25, 19: 0.2, 23: 0.15, 25: 0.12,
};

export type PQBus = 400 | 220 | 66;

interface PowerQualityState {
  harmonics: HarmonicAnalysisResponse | null;
  resonance: ResonanceScanResponse | null;
  flicker: FlickerResponse | null;
  filterDesign: FilterDesignResponse | null;

  bus: PQBus;
  /** What-if grid short-circuit power [MVA]; null = the farm's (network spec). */
  gridSscMva: number | null;
  emissionScale: number;
  filterOrder: number;
  filterMvar: number;

  loading: boolean;
  error: string | null;

  setBus(b: PQBus): void;
  setGridSscMva(v: number): void;
  setEmissionScale(v: number): void;
  setFilterOrder(h: number): void;
  setFilterMvar(q: number): void;
  runAll(): Promise<void>;
  runFilter(): Promise<void>;
  clearError(): void;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export const usePowerQualityStore = create<PowerQualityState>((set, get) => ({
  harmonics: null,
  resonance: null,
  flicker: null,
  filterDesign: null,

  bus: 400,
  gridSscMva: null,
  emissionScale: 1,
  filterOrder: 17,
  filterMvar: 10,

  loading: false,
  error: null,

  setBus: (b) => set({ bus: b }),
  setGridSscMva: (v) => set({ gridSscMva: v }),
  setEmissionScale: (v) => set({ emissionScale: v }),
  setFilterOrder: (h) => set({ filterOrder: h }),
  setFilterMvar: (q) => set({ filterMvar: q }),

  runAll: async () => {
    const { bus, emissionScale } = get();
    const emission = Object.fromEntries(Object.entries(TYPICAL_EMISSION).map(([h, v]) => [h, v * emissionScale]));
    set({ loading: true, error: null });
    try {
      const farm = currentNetwork();
      const ratedMw = farm.total_capacity_mw;
      const gridSscMva = get().gridSscMva ?? farm.grid_ssc_mva;
      const [harmonics, resonance, flicker] = await Promise.all([
        api.analyzeHarmonics({ harmonic_magnitudes: emission, voltage_kv: bus, rated_mw: ratedMw, grid_fault_level_mva: gridSscMva }),
        api.runResonanceScan({ cable_length_km: farm.export_length_km, voltage_kv: bus, grid_fault_level_mva: gridSscMva, scan_max_hz: 2500 }),
        api.computeFlicker({ rated_mw: ratedMw, grid_fault_level_mva: gridSscMva, grid_impedance_angle_deg: 84.3, annual_switching_operations: 1000 }),
      ]);
      set({ harmonics, resonance, flicker });
    } catch (err) {
      set({ error: message(err) });
    } finally {
      set({ loading: false });
    }
  },

  runFilter: async () => {
    const { filterOrder, filterMvar } = get();
    try {
      const filterDesign = await api.designFilter({
        dominant_harmonic_order: filterOrder,
        harmonic_current_a: 50,
        system_voltage_kv: 66,
        rated_mvar: filterMvar,
      });
      set({ filterDesign });
    } catch (err) {
      set({ error: message(err) });
    }
  },

  clearError: () => set({ error: null }),
}));
