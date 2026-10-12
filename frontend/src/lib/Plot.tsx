/**
 * ESM shim for react-plotly.js — fixes Vite/Rollup production CJS interop.
 *
 * Root cause: react-plotly.js uses Object.defineProperty(exports,'__esModule',
 * {value:true}) which @rollup/plugin-commonjs does not detect statically.
 * Rollup therefore wraps the module with c(exports,1) — the production bundle
 * helper that sets nT.default = entire CJS exports object (a plain JS object),
 * not the PlotClass constructor.  React throws error #130:
 *   "Element type is invalid: expected a string or function but got: object"
 *
 * Fix strategy: alias "react-plotly.js" → this file in vite.config.ts.
 * Instead of importing the main entry (which triggers the bad c(exports,1)
 * path), we import via two sub-paths that Rollup handles correctly:
 *   - react-plotly.js/factory  — createPlotlyComponent factory function
 *   - plotly.js-dist-min       — the Plotly library object
 * Defensive runtime deref handles any remaining interop layers.
 *
 * All 40+ `import Plot from "react-plotly.js"` statements in the codebase
 * resolve here automatically — no component file needs to change.
 * tsconfig `paths` points TypeScript at this file too, so consumers get the
 * plotly.js-typed PlotParams below (react-plotly.js 4 types data/layout as unknown).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useSyncExternalStore, type ComponentType } from "react";
import type { Config, Data, Frame, Layout } from "plotly.js";
import createPlotlyComponent, { type PlotParams as LoosePlotParams } from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";

export type PlotParams = Omit<LoosePlotParams, "data" | "layout" | "frames" | "config"> & {
  data: Data[];
  layout: Partial<Layout>;
  frames?: Frame[];
  config?: Partial<Config>;
};

/**
 * Peel CJS interop layers until we reach the actual callable.
 * Handles the three shapes Rollup c() produces:
 *   1. fn              — already a function, return as-is
 *   2. {default: fn}   — single wrap (c without the 1 flag)
 *   3. {default:{default:fn}} — double wrap (c with the 1 flag + __esModule)
 */
function deref(v: unknown): (...args: any[]) => any {
  if (typeof v === "function") return v as any;
  const d = (v as any)?.default;
  if (typeof d === "function") return d;
  const dd = d?.default;
  if (typeof dd === "function") return dd;
  return v as any;
}

/**
 * Unwrap Plotly namespace — plotly.js-dist-min is plain UMD
 * (module.exports = PlotlyObj, no __esModule).  c(PlotlyObj,1) copies
 * all own props into {default:PlotlyObj,...ownProps}, so both the result
 * and result.default have the required .newPlot/.purge/etc methods.
 */
function derefPlotly(v: unknown): object {
  if (v && typeof v === "object" && "newPlot" in v) return v as object;
  const d = (v as any)?.default;
  if (d && typeof d === "object" && "newPlot" in d) return d;
  return v as object;
}

const BasePlot = deref(createPlotlyComponent)(derefPlotly(Plotly)) as ComponentType<PlotParams>;

const PHONE = "(max-width: 639px)";
const phoneQuery = () => window.matchMedia?.(PHONE);
const subscribe = (cb: () => void) => {
  const q = phoneQuery();
  q?.addEventListener("change", cb);
  return () => q?.removeEventListener("change", cb);
};
const isPhone = () => phoneQuery()?.matches ?? false;

/**
 * Phone layout for every chart in one place: the legend leaves the plot area
 * (a horizontal row under the chart, where it cannot cover the data), the side
 * margins shrink to what the tick labels need (a right-hand axis keeps its
 * room) and the text steps down a size.
 */
function phoneLayout(layout: PlotParams["layout"] = {}): PlotParams["layout"] {
  const m = layout.margin ?? {};
  const two = Object.keys(layout).some((k) => /^yaxis[2-9]$/.test(k));
  return {
    ...layout,
    font: { ...layout.font, size: Math.min(layout.font?.size ?? 12, 11) },
    margin: { ...m, l: Math.min(m.l ?? 80, 48), r: two ? (m.r ?? 80) : Math.min(m.r ?? 80, 12), b: (m.b ?? 40) + 8 },
    legend:
      layout.showlegend === false
        ? layout.legend
        : { ...layout.legend, orientation: "h", x: 0, xanchor: "left", xref: "container", y: 0, yanchor: "bottom", yref: "container", font: { size: 11 } },
  };
}

export default function Plot(props: PlotParams) {
  const phone = useSyncExternalStore(subscribe, isPhone, () => false);
  // Plotly writes its autorange result (range) into the layout object it is given. So:
  // - one copy per chart, never the shared DARK_PLOTLY_LAYOUT axes (written by one chart,
  //   read by the next);
  // - the same copy while the content is unchanged: a fresh object without that range on a
  //   re-render made Plotly.react skip the recalculation and draw default axes ([-1, 6]);
  // - a changed content gets a new copy and datarevision, which forces a full recalculation.
  const key = JSON.stringify((phone ? phoneLayout(props.layout) : props.layout) ?? {});
  const layout = useMemo(() => ({ ...JSON.parse(key), datarevision: key }), [key]);
  // phone: no modebar either (it covers the top of the plot; the chart's expand button stays)
  return phone ? (
    <BasePlot {...props} layout={layout} config={{ ...props.config, displayModeBar: false }} />
  ) : (
    <BasePlot {...props} layout={layout} />
  );
}
