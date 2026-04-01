import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      // Shim that fixes Vite/Rollup production CJS interop for react-plotly.js.
      // react-plotly.js uses Object.defineProperty(__esModule) which Rollup's
      // static analyser misses → c(exports,1) wrapping → nT.default is the
      // entire CJS exports object (plain JS object) instead of the Plot class.
      // React throws error #130: "Element type is invalid: got: object".
      // Regex (^...$) ensures EXACT match — "react-plotly.js/factory" is NOT
      // aliased so the shim can import sub-paths without circular resolution.
      {
        find: /^react-plotly\.js$/,
        replacement: resolve(__dirname, "src/lib/Plot.tsx"),
      },
      // Keep plotly alias for any code that still resolves through the normal path
      {
        find: "plotly.js/dist/plotly",
        replacement: "plotly.js-dist-min",
      },
    ],
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        timeout: 600000,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
