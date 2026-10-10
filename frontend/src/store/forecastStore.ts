/**
 * Zustand store for the P4 Forecasting page: the open view, the academy chapter and the
 * last real-data result (the academy's ensemble lesson quotes its scores).
 */

import { create } from "zustand";

import type { RealForecastResponse } from "../services/forecastApi";

export type ForecastTab = "real" | "academy" | "map";

interface ForecastState {
  tab: ForecastTab;
  /** Academy chapter to open (set by the concept map). */
  chapter: string;
  /** Last day-ahead result loaded on the Real data tab. */
  real: RealForecastResponse | null;
  setTab: (t: ForecastTab) => void;
  openChapter: (id: string) => void;
  setReal: (r: RealForecastResponse | null) => void;
}

export const useForecastStore = create<ForecastState>((set) => ({
  tab: "real",
  chapter: "why",
  real: null,
  setTab: (tab) => set({ tab }),
  openChapter: (chapter) => set({ chapter, tab: "academy" }),
  setReal: (real) => set({ real }),
}));
