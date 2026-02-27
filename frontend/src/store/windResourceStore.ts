/**
 * Zustand store for P1 wind resource dashboard state.
 *
 * Manages user parameters (Weibull A/k, TI, price, layout),
 * computation results from all P1 API endpoints, and
 * loading/error states.
 *
 * Data flow: user sets parameters → clicks "Run Analysis" →
 * runFullAnalysis() calls all endpoints → results populate panels.
 */

import { create } from "zustand";

import * as api from "../services/windResourceApi";
import type {
  AEPCascadeResult,
  LayoutComparisonResult,
  LayoutPositions,
  TurbineSpec,
  WakeAnalysisResult,
  WeibullFitResult,
  WindRoseResult,
} from "../types/windResource";

// ── Store Interface ────────────────────────────────────────────

interface WindResourceState {
  // User parameters
  weibullA: number;
  weibullK: number;
  turbulenceIntensity: number;
  priceEurMwh: number;
  activeLayout: string;

  // Computation results
  turbineSpec: TurbineSpec | null;
  weibullFit: WeibullFitResult | null;
  windRose: WindRoseResult | null;
  wakeAnalysis: WakeAnalysisResult | null;
  aepCascade: AEPCascadeResult | null;
  layoutComparison: LayoutComparisonResult | null;
  layoutPositions: LayoutPositions | null;

  // UI state
  loading: boolean;
  error: string | null;
  analysisRun: boolean;

  // Parameter setters
  setWeibullA: (value: number) => void;
  setWeibullK: (value: number) => void;
  setTurbulenceIntensity: (value: number) => void;
  setPriceEurMwh: (value: number) => void;
  setActiveLayout: (layout: string) => void;

  // Data actions
  fetchTurbineSpec: () => Promise<void>;
  runFullAnalysis: () => Promise<void>;

  // Utility
  clearError: () => void;
}

// ── Store Implementation ───────────────────────────────────────

export const useWindResourceStore = create<WindResourceState>((set, get) => ({
  // Default parameters (Baltic Sea typical values)
  weibullA: 10.5,
  weibullK: 2.2,
  turbulenceIntensity: 0.06,
  priceEurMwh: 72.0,
  activeLayout: "regular",

  // Results
  turbineSpec: null,
  weibullFit: null,
  windRose: null,
  wakeAnalysis: null,
  aepCascade: null,
  layoutComparison: null,
  layoutPositions: null,

  // UI
  loading: false,
  error: null,
  analysisRun: false,

  // ── Parameter setters ──────────────────────────────────────

  setWeibullA: (value) => set({ weibullA: value }),
  setWeibullK: (value) => set({ weibullK: value }),
  setTurbulenceIntensity: (value) => set({ turbulenceIntensity: value }),
  setPriceEurMwh: (value) => set({ priceEurMwh: value }),
  setActiveLayout: (layout) => set({ activeLayout: layout }),

  // ── Data actions ───────────────────────────────────────────

  fetchTurbineSpec: async () => {
    try {
      const turbineSpec = await api.getTurbineSpec();
      set({ turbineSpec });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  runFullAnalysis: async () => {
    const { weibullA, weibullK, turbulenceIntensity, priceEurMwh, activeLayout } =
      get();

    set({ loading: true, error: null });

    try {
      // Run all analyses in parallel for speed
      const [weibullFit, windRose, wakeAnalysis, aepCascade, layoutComparison, layoutPositions] =
        await Promise.all([
          api.fitWeibull(weibullA, weibullK),
          api.computeWindRose(weibullA, weibullK),
          api.runWakeAnalysis(activeLayout, weibullA, weibullK, turbulenceIntensity),
          api.computeAEPCascade(
            activeLayout,
            weibullA,
            weibullK,
            turbulenceIntensity,
            priceEurMwh,
          ),
          api.compareLayouts(weibullA, weibullK, turbulenceIntensity, priceEurMwh),
          api.getLayoutPositions(activeLayout),
        ]);

      set({
        weibullFit,
        windRose,
        wakeAnalysis,
        aepCascade,
        layoutComparison,
        layoutPositions,
        analysisRun: true,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  // ── Utility ────────────────────────────────────────────────

  clearError: () => set({ error: null }),
}));
