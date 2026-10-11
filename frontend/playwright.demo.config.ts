/**
 * Records the static demo's API responses (needs the backend on :8000):
 *   npm run demo:record   → walks every page and tab, writes demo-api/*.json
 *   npm run demo:check    → same walk on the demo build, lists what is not recorded
 */

import { defineConfig } from "@playwright/test";

const CHECK = process.env.DEMO_CHECK === "1";
const PORT = CHECK ? 5176 : 5175;

export default defineConfig({
  testDir: "./e2e-demo",
  timeout: 15 * 60_000,
  reporter: [["list"]],
  // actionTimeout: a button that re-renders away mid-walk must not stall the run forever
  use: { baseURL: `http://localhost:${PORT}`, channel: "chrome", viewport: { width: 1440, height: 900 }, actionTimeout: 10_000 },
  webServer: {
    // check: the demo build served as on GitHub Pages (recordings copied next to it)
    command: CHECK
      ? `node scripts/build-demo.mjs && npx vite preview --outDir dist-demo --port ${PORT} --strictPort`
      : `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: CHECK ? { VITE_BASE: "/" } : {},
  },
});
