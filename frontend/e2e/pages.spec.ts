import { expect, test, type Page } from "@playwright/test";

const ROUTES = [
  ["overview", "/"],
  ["p1-wind-resource", "/wind-resource"],
  ["p2-hv-grid", "/hv-grid"],
  ["p3-scada", "/scada"],
  ["p4-forecast", "/forecast"],
  ["p5-commissioning", "/commissioning"],
  ["digital-twin", "/digital-twin"],
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
    },
    [theme, welcome] as const,
  );
  await page.goto(path);
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
}

test("3D turbine viewer and drawings open without runtime errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !IGNORED.some((r) => r.test(m.text()))) errors.push(m.text());
  });
  await open(page, "/", "storybook");
  await page.locator(".leaflet-turbine-marker").nth(8).click();
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /Full view/ }).click();
  await expect(page.getByText(/Live analytics/)).toBeVisible();
  await page.waitForTimeout(3000); // a few hundred frames of the flow / wake / farm scene
  await page.keyboard.press("s"); // 3D ↔ drawings
  for (const sheet of [/E-01/, /M-01/, /P-01/]) {
    await page.getByRole("tab", { name: sheet }).click();
    await expect(page.getByText(/SB5-WTG-/)).toBeVisible();
  }
  expect(errors, errors.join("\n")).toEqual([]);
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
  await page.locator(".leaflet-turbine-marker").nth(8).click();
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
      await open(page, path, theme);
      await page.waitForTimeout(800);
      await expect(page).toHaveScreenshot(`${name}-${theme}.png`, {
        fullPage: false,
        // live values: clock, KPIs, map tiles and the simulated farm move every tick
        mask: [
          page.locator("header"),
          page.locator(".leaflet-container"),
          page.locator("[class*='tabular-nums'], .font-mono"),
        ],
      });
    });
  }
}
