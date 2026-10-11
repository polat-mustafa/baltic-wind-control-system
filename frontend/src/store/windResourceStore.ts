/**
 * Zustand store for P1 wind resource dashboard state.
 *
 * Manages user parameters (Weibull A/k, TI, price, layout),
 * computation results from all P1 API endpoints, and
 * loading/error states.
 *
 * Data flow: user sets parameters → clicks "Run Analysis" →
 * runFullAnalysis() calls all endpoints → results populate panels.
 *
 * Own-project mode with a layout: the wake run and AEP cascade use the
 * project's turbine positions (/wake-analysis-custom, /aep-cascade-custom)
 * and the site assessment's hub-height Weibull and wind rose; the
 * regular-vs-staggered comparison is SB-510's and is left out. Results
 * remember the farm they belong to (`farmFor`, see `p1Farm`).
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
import { SB510_WIND } from "../constants/sb510Wind";
import { farmPlan, type FarmPlan } from "../lib/lifecycle/farm";
import { centroid, dist, polygonArea, projection, type XY } from "../lib/layout/geometry";
import { useModeStore } from "./modeStore";
import { useProjectStore } from "./projectStore";
import { useSiteStore } from "./siteStore";
import type { SiteWind } from "../services/siteApi";

/** The farm P1 analyses: SB-510's named layouts, or the own layout in local metres with its site wind. */
export interface P1Farm {
  id: string;
  own: { xy: XY[]; areaKm2: number; wind: SiteWind | null } | null;
}

/** P1 farm of a farm plan (pure: the page passes `useFarmPlan()`, the store the current state). */
export function p1Farm(plan: FarmPlan, sitePoly: [number, number][] | null, wind: SiteWind | null): P1Farm {
  if (plan.source !== "project") return { id: "sb510", own: null };
  const proj = projection(centroid(plan.turbines.map((t) => [t.lon, t.lat])));
  const xy = plan.turbines.map((t) => proj.toXY([t.lon, t.lat]));
  const w = wind && !wind.approximate ? wind : null;
  const pos = xy.map((q) => `${q.x.toFixed(0)},${q.y.toFixed(0)}`).join(";");
  return {
    id: `${pos}|${w ? `${w.weibull_a},${w.weibull_k}` : "-"}`,
    own: { xy, areaKm2: sitePoly ? polygonArea(sitePoly.map(proj.toXY)) / 1e6 : 0, wind: w },
  };
}

function currentP1Farm(): P1Farm {
  if (useModeStore.getState().mode !== "own") return { id: "sb510", own: null };
  const { turbines, oss } = useProjectStore.getState();
  const { site, report, routeKm } = useSiteStore.getState();
  return p1Farm(farmPlan({ turbines, oss }, { site, report, routeKm }), site, report?.wind ?? null);
}

/**
 * The rose the own-project wake run uses: the site's 12 sector frequencies with one
 * Weibull(A, k) in every sector (backend `_rose_site`), so each sector has the same
 * speed classes and mean, and its energy share is its frequency.
 */
export function withSiteRose(rose: WindRoseResult, freqs: number[]): WindRoseResult {
  const total = freqs.reduce((s, f) => s + f, 0);
  if (rose.num_sectors !== freqs.length || total <= 0) return rose;
  const f = freqs.map((v) => v / total);
  const classes = rose.sector_speed_frequencies[0].map((_, c) => rose.sector_speed_frequencies.reduce((s, row) => s + row[c], 0));
  const mean = rose.mean_speeds_ms.reduce((s, v, i) => s + v * rose.frequencies[i], 0);
  const rad = (d: number) => (d * Math.PI) / 180;
  const cx = f.reduce((s, v, i) => s + v * Math.cos(rad(rose.sector_centres_deg[i])), 0);
  const cy = f.reduce((s, v, i) => s + v * Math.sin(rad(rose.sector_centres_deg[i])), 0);
  const r = Math.min(1, Math.hypot(cx, cy));
  return {
    ...rose,
    frequencies: f,
    mean_speeds_ms: f.map(() => mean),
    energy_fractions: f,
    dominant_direction_deg: rose.sector_centres_deg[f.indexOf(Math.max(...f))],
    circular_std_deg: r > 0 ? (Math.sqrt(-2 * Math.log(r)) * 180) / Math.PI : 180,
    sector_speed_frequencies: f.map((v) => classes.map((c) => v * c)),
  };
}

const minSpacing = (xy: XY[]) =>
  Math.min(...xy.flatMap((a, i) => xy.slice(i + 1).map((b) => dist(a, b))));

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
  /** `P1Farm.id` the results belong to (null before the first run). */
  farmFor: string | null;

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
  weibullA: SB510_WIND.weibullA,
  weibullK: SB510_WIND.weibullK,
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
  farmFor: null,

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
    const farm = currentP1Farm();
    // A new farm starts from its own site wind (SB-510: the reference climate)
    if (farm.id !== get().farmFor) {
      const w = farm.own?.wind;
      set({ weibullA: w ? w.weibull_a : SB510_WIND.weibullA, weibullK: w ? w.weibull_k : SB510_WIND.weibullK });
    }
    const { weibullA, weibullK, turbulenceIntensity, priceEurMwh, activeLayout } = get();

    set({ loading: true, error: null });

    try {
      const [weibullFit, windRose] = await Promise.all([
        api.fitWeibull(weibullA, weibullK),
        api.computeWindRose(weibullA, weibullK),
      ]);
      if (farm.own) {
        const { xy, areaKm2, wind } = farm.own;
        const x_m = xy.map((q) => q.x);
        const y_m = xy.map((q) => q.y);
        const rose = wind?.sector_frequencies ?? null;
        // Sequential: the cascade's wake run is then a cache hit on the backend
        const wakeAnalysis = await api.runCustomWakeAnalysis(x_m, y_m, weibullA, weibullK, turbulenceIntensity, undefined, rose);
        const aepCascade = await api.computeCustomAEPCascade({
          x_m,
          y_m,
          weibull_a: weibullA,
          weibull_k: weibullK,
          turbulence_intensity: turbulenceIntensity,
          price_eur_mwh: priceEurMwh,
          sector_frequencies: rose,
        });
        const layoutPositions: LayoutPositions = {
          name: "own layout",
          x_positions: x_m,
          y_positions: y_m,
          num_turbines: xy.length,
          min_spacing_m: xy.length > 1 ? minSpacing(xy) : 0,
          area_km2: areaKm2,
        };
        set({
          weibullFit,
          windRose: rose ? withSiteRose(windRose, rose) : windRose,
          wakeAnalysis,
          aepCascade,
          layoutComparison: null,
          layoutPositions,
        });
      } else {
        const [wakeAnalysis, aepCascade, layoutComparison, layoutPositions] = await Promise.all([
          api.runWakeAnalysis(activeLayout, weibullA, weibullK, turbulenceIntensity),
          api.computeAEPCascade(activeLayout, weibullA, weibullK, turbulenceIntensity, priceEurMwh),
          api.compareLayouts(weibullA, weibullK, turbulenceIntensity, priceEurMwh),
          api.getLayoutPositions(activeLayout),
        ]);
        set({ weibullFit, windRose, wakeAnalysis, aepCascade, layoutComparison, layoutPositions });
      }
      set({ analysisRun: true, farmFor: farm.id });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  // ── Utility ────────────────────────────────────────────────

  clearError: () => set({ error: null }),
}));
