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
 * TypeScript consumers still receive the correct types from @types/react-plotly.js.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import createPlotlyComponent from "react-plotly.js/factory";
// @ts-expect-error — plotly.js-dist-min has no TypeScript declarations
import Plotly from "plotly.js-dist-min";

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

export default deref(createPlotlyComponent)(derefPlotly(Plotly));
