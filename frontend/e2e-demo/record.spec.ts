/**
 * Walks every route — every tab on it, and every "Run / Simulate / Calculate" button
 * with its default inputs — the way a visitor would, recording each successful /api
 * response into demo-api/ (DEMO_CHECK=1: on the demo build, listing the requests that
 * have no recording instead). See playwright.demo.config.ts.
 *
 *   DEMO_ROUTES=hv-grid,scada   only these pages (re-record one page after a change)
 *   DEMO_VERBOSE=1              log every file written
 */

import { mkdirSync, writeFileSync } from "node:fs";

import { test, type BrowserContext, type Page } from "@playwright/test";

import { demoFile } from "../src/demo/demoKey";

const CHECK = process.env.DEMO_CHECK === "1";
const VERBOSE = process.env.DEMO_VERBOSE === "1";
const OUT = "demo-api";

const ALL_ROUTES = [
  "/",
  "/develop",
  "/develop/layout",
  "/wind-resource",
  "/report",
  "/hv-grid",
  "/scada",
  "/forecast",
  "/build",
  "/commissioning",
  "/build/handover",
  "/digital-twin",
  "/decommission",
  "/academy",
  "/turbine-physics",
  "/evidence",
];
const ROUTES = process.env.DEMO_ROUTES?.split(",").map((r) => `/${r.replace(/^\//, "")}`) ?? ALL_ROUTES;

/** Buttons that compute with the defaults on screen — never ones that delete, reset or train for minutes. */
const COMPUTE = /^(run|simulate|calculate|compute|analy[sz]e|solve|evaluate|check|assess|optimi[sz]e)\b/i;

async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
}

async function clickComputeButtons(page: Page, seen: Set<string>) {
  const buttons = page.locator("main button");
  const n = await buttons.count();
  for (let i = 0; i < n; i++) {
    const b = buttons.nth(i);
    const name = (await b.textContent().catch(() => null))?.trim() ?? "";
    if (!COMPUTE.test(name) || seen.has(name)) continue;
    if (!(await b.isVisible().catch(() => false)) || (await b.isDisabled().catch(() => true))) continue;
    seen.add(name);
    console.log(`    run "${name}"`);
    await b.click({ timeout: 5_000 }).catch(() => undefined);
    await settle(page);
  }
}

/** Click through every tab (nested tab bars appear as their parent opens), scrolling lazy sections in. */
async function walk(page: Page) {
  const seenTabs = new Set<string>();
  const seenButtons = new Set<string>();
  await clickComputeButtons(page, seenButtons);
  for (let round = 0; round < 3; round++) {
    const tabs = page.getByRole("tab");
    const n = await tabs.count();
    for (let i = 0; i < n; i++) {
      const tab = tabs.nth(i);
      const name = (await tab.textContent().catch(() => null))?.trim() ?? `#${i}`;
      if (seenTabs.has(name) || !(await tab.isVisible().catch(() => false))) continue;
      seenTabs.add(name);
      console.log(`  tab ${name}`);
      await tab.click({ timeout: 5_000 }).catch(() => undefined);
      await settle(page);
      await page.mouse.wheel(0, 20_000);
      await settle(page);
      await clickComputeButtons(page, seenButtons);
    }
  }
}

test("walk every page", async ({ context }) => {
  test.setTimeout(60 * 60_000);
  mkdirSync(OUT, { recursive: true });
  const missing = new Set<string>();
  const written = new Set<string>();

  await context.addInitScript(() => {
    localStorage.setItem("of.mode.v1", "reference");
    localStorage.setItem("of.tour.v1", JSON.stringify({ completed: [], welcomeDismissed: true }));
  });
  await instrument(context, missing, written);

  for (const route of ROUTES) {
    console.log(`${route}  (${written.size} files so far)`);
    // a fresh tab per page: a heavy page that crashes the renderer costs only itself
    const page = await context.newPage();
    try {
      await page.goto(route, { timeout: 60_000 });
      await settle(page);
      await page.mouse.wheel(0, 20_000);
      await settle(page);
      await walk(page);
    } catch (e) {
      console.log(`  ! ${route}: ${(e as Error).message.split("\n")[0]}`);
    } finally {
      await page.close().catch(() => undefined);
    }
  }
  console.log(CHECK ? `not recorded (${missing.size}):\n${[...missing].sort().join("\n")}` : `${written.size} files in ${OUT}/`);
});

async function instrument(context: BrowserContext, missing: Set<string>, written: Set<string>) {
  if (CHECK) {
    context.on("response", (res) => {
      const path = new URL(res.url()).pathname;
      // vite preview answers a missing file with index.html (200), GitHub Pages with 404
      const html = res.headers()["content-type"]?.includes("html");
      if (path.includes("/demo-api/") && (res.status() === 404 || html)) missing.add(path.split("/").pop()!);
    });
    return;
  }
  // At the network layer, not on("response"): Chrome drops bodies it no longer holds
  // (aborted or superseded requests) before they can be read back there.
  await context.route("**/api/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const res = await route.fetch({ timeout: 300_000 }).catch(() => null);
    if (!res) return route.abort().catch(() => undefined);
    const text = res.status() === 204 ? "null" : await res.text();
    await route.fulfill({ response: res, body: text }).catch(() => undefined);
    const file = demoFile(req.method(), url.pathname + url.search, req.postData());
    if (!res.ok() || written.has(file)) return;
    try {
      JSON.parse(text);
    } catch {
      return; // not JSON (a file download): the demo cannot replay it
    }
    written.add(file);
    writeFileSync(`${OUT}/${file}`, text);
    if (VERBOSE) console.log(`    ${file}`);
  });
}
