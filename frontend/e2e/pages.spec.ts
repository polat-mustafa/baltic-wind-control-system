import { expect, test, type Page } from "@playwright/test";

const ROUTES = [
  ["overview", "/"],
  ["site-permits", "/develop"],
  ["layout", "/develop/layout"],
  ["p1-wind-resource", "/wind-resource"],
  ["report", "/report"],
  ["p2-hv-grid", "/hv-grid"],
  ["p3-scada", "/scada"],
  ["p4-forecast", "/forecast"],
  ["construction", "/build"],
  ["p5-commissioning", "/commissioning"],
  ["handover", "/build/handover"],
  ["digital-twin", "/digital-twin"],
  ["decommissioning", "/decommission"],
  ["academy", "/academy"],
] as const;

const THEMES = ["storybook", "hmi"] as const;

/** Network failures are expected when the backend (or AIS proxy) is not running. */
const IGNORED = [/Failed to load resource/i, /ERR_CONNECTION_REFUSED/i, /net::ERR_/i, /backend not reachable/i, /status of (4|5)\d\d/i];

async function open(page: Page, path: string, theme: (typeof THEMES)[number], welcome = false) {
  await page.addInitScript(
    ([t, w]) => {
      localStorage.setItem("of.mapTheme", t);
      // The first-visit tour welcome would cover every screenshot.
      if (!w) localStorage.setItem("of.tour.v1", JSON.stringify({ completed: [], welcomeDismissed: true }));
      // Reference mode: no project chooser, every module open.
      localStorage.setItem("of.mode.v1", "reference");
    },
    [theme, welcome] as const,
  );
  await page.goto(path);
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
}

test("3D turbine viewer, schematic and drawings open without runtime errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !IGNORED.some((r) => r.test(m.text()))) errors.push(m.text());
  });
  await open(page, "/", "storybook");
  // The map is a WebGL canvas: open WTG-09 from its keyboard / screen-reader button
  await page.getByRole("button", { name: /^WTG-09 ·/ }).dispatchEvent("click");
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /Full view/ }).click();
  await expect(page.getByText(/Live analytics/)).toBeVisible();
  await page.waitForTimeout(3000); // a few hundred frames of the flow / wake / farm scene
  await page.keyboard.press("s"); // Realistic → Schematic (live side view)
  await expect(page.getByRole("region", { name: "This rotor's wake" })).toBeVisible();
  await page.getByRole("radio", { name: "Drawings" }).click();
  for (const sheet of [/E-01/, /M-01/, /P-01/]) {
    await page.getByRole("tab", { name: sheet }).click();
    await expect(page.getByText(/SB5-WTG-/)).toBeVisible();
  }
  expect(errors, errors.join("\n")).toEqual([]);
});

test("Print / PDF shows the report, not blank pages", async ({ page }) => {
  await open(page, "/report", "hmi");
  await page.evaluate(() => document.querySelector(".print-doc")?.setAttribute("data-printing", ""));
  await page.emulateMedia({ media: "print" });
  const visible = await page.evaluate(() => {
    const doc = document.querySelector(".print-doc");
    const h = doc?.querySelector("h1, h2");
    return [doc, h].map((e) => (e ? getComputedStyle(e).visibility : "missing"));
  });
  expect(visible).toEqual(["visible", "visible"]);
});

test("guided tour: welcome, spotlight, turbine action step", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page, "/", "storybook", true);
  await page.getByRole("button", { name: /Start the tour/ }).click();
  await expect(page.getByRole("dialog", { name: /Welcome to OffshoreForge/ })).toBeVisible();
  await page.keyboard.press("ArrowRight"); // sidebar
  await expect(page.getByRole("dialog", { name: /Organised by lifecycle stage/ })).toBeVisible();
  await expect(page.locator("[data-testid=tour-overlay] path[marker-end]")).toBeVisible();
  await page.keyboard.press("ArrowRight"); // KPIs
  await page.keyboard.press("ArrowRight"); // action: open a turbine
  await expect(page.getByText(/Your turn: Click any turbine/)).toBeVisible();
  // The map is a WebGL canvas: open WTG-09 from its keyboard / screen-reader button
  await page.getByRole("button", { name: /^WTG-09 ·/ }).dispatchEvent("click");
  await expect(page.getByRole("dialog", { name: /Meet the turbine/ })).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("tour-overlay")).toHaveCount(0);
  expect(errors, errors.join("\n")).toEqual([]);
});

for (const [name, path] of ROUTES) {
  test(`${name}: renders without runtime errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && !IGNORED.some((r) => r.test(m.text()))) errors.push(m.text());
    });
    await open(page, path, "storybook");
    await expect(page.locator("main")).toBeVisible();
    await page.waitForTimeout(1500);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  for (const theme of THEMES) {
    test(`${name}: looks unchanged (${theme})`, async ({ page }) => {
      // Pages open with results (hooks/useAutoRun): wait until the page's own run has finished
      test.setTimeout(180_000);
      await open(page, path, theme);
      await page.waitForTimeout(1500); // a run may start after a first status call (Forecast: model cache)
      await page
        .waitForFunction(() => !/Running|Queued/.test(document.body.innerText), null, { timeout: 150_000, polling: 500 })
        .catch(() => undefined);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      await page.waitForTimeout(800);
      await expect(page).toHaveScreenshot(`${name}-${theme}.png`, {
        fullPage: false,
        // live values: clock, KPIs and the simulated farm move every tick
        mask: [
          page.locator("header"),
          page.locator("canvas"), // WebGL map and charts draw live values
          page.locator("[class*='tabular-nums'], .font-mono"),
          page.locator("[data-e2e-mask]"), // database-backed lists
        ],
      });
    });
  }
}
