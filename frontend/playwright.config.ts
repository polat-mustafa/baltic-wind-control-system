/**
 * End-to-end checks in a real browser (system Chrome — no browser download):
 *   • every route renders without a runtime error in the console
 *     (catches stale-module / ReferenceError regressions unit tests miss);
 *   • visual regression of every route in both colour palettes
 *     (storybook / control room) against committed baselines.
 *
 *   npm run e2e            compare with the baselines
 *   npm run e2e:update     accept the current look as the new baseline
 *
 * Baselines are per-OS (file suffix); they are made on the dev machine, so
 * this suite runs locally, not in the Linux CI.
 */

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.03, animations: "disabled", caret: "hide" },
  },
  use: {
    baseURL: "http://localhost:5174",
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  },
  webServer: {
    command: "npx vite --port 5174 --strictPort",
    url: "http://localhost:5174",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
