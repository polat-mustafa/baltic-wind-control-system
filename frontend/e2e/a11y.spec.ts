/**
 * Accessibility gate (redesign phase 6): every page, in both themes, has no
 * serious or critical WCAG 2.x A / AA violation found by axe-core — colour
 * contrast ≥ 4.5:1, names on controls, focusable scroll regions, valid roles.
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const ROUTES = [
  "/",
  "/develop",
  "/develop/layout",
  "/wind-resource",
  "/report",
  "/projects",
  "/hv-grid",
  "/turbine-physics",
  "/build",
  "/commissioning",
  "/build/handover",
  "/scada",
  "/forecast",
  "/digital-twin",
  "/decommission",
  "/academy",
];

for (const theme of ["hmi", "storybook"] as const) {
  for (const path of ROUTES) {
    test(`a11y ${theme} ${path}`, async ({ page }) => {
      await page.addInitScript((t) => {
        localStorage.setItem("of.mapTheme", t);
        localStorage.setItem("of.tour.v1", JSON.stringify({ completed: [], welcomeDismissed: true }));
        localStorage.setItem("of.mode.v1", "reference");
      }, theme);
      await page.goto(path);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      await page.waitForTimeout(1500);
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const blocking = violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(" ")}`);
      expect(blocking, blocking.join("\n")).toEqual([]);
    });
  }
}
