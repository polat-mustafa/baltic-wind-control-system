// Lists the visible text still in English when a UI language is on (src/lib/i18n).
//
//   npm run dev                      (frontend, and the backend for the live pages)
//   npm run i18n:missing -- tr       → i18n-missing-tr.tsv: page, text
//
// Opens every menu page (constants/navigation.ts) and each of its tabs in system
// Chrome with the language set, and collects text the translator did not mark
// (elements it translates carry data-i18n). Numbers, units and ids show up too —
// skip what needs no translation; add the rest to src/lib/i18n/<lang>/.
// Pass a base URL as the second argument when the dev server is not on :5173.

import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const lang = process.argv[2];
const base = process.argv[3] ?? "http://localhost:5173";
if (!lang) {
  console.error("usage: npm run i18n:missing -- <lang> [base-url]");
  process.exit(1);
}

const nav = readFileSync(new URL("../src/constants/navigation.ts", import.meta.url), "utf8");
const pages = [...nav.matchAll(/path: "([^"]+)"/g)].map((m) => m[1]);

/** Runs in the page: text of elements the translator left alone. */
function untranslated() {
  const SKIP = "script,style,code,pre,textarea,kbd,samp,sub,sup,math,var,[translate='no'],[contenteditable='true']";
  const out = new Set();
  for (const el of document.body.querySelectorAll("*")) {
    if (el.closest(SKIP) || el.hasAttribute("data-i18n")) continue;
    const kids = [...el.childNodes];
    const texts = kids.filter((k) => k.nodeType === Node.TEXT_NODE);
    if (!texts.length) continue;
    const groups = texts.length === kids.length ? [texts.map((t) => t.nodeValue).join("")] : texts.map((t) => t.nodeValue);
    for (const g of groups) {
      const s = g.replace(/\s+/g, " ").trim();
      if (/[a-z]{3}/.test(s)) out.add(s);
    }
  }
  return [...out];
}

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.addInitScript((l) => {
  localStorage.setItem("of.lang.v1", l);
  localStorage.setItem("of.mode.v1", "reference");
  localStorage.setItem("of.tour.v1", JSON.stringify({ completed: [], welcomeDismissed: true }));
}, lang);
const page = await context.newPage();

const found = new Map(); // text → first page
for (const path of pages) {
  await page.goto(base + path, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(2500);
  const seen = new Set(await page.evaluate(untranslated));
  const tabs = page.locator('[role="tab"]');
  for (let i = 0, n = await tabs.count(); i < n; i++) {
    await tabs.nth(i).click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(1500);
    (await page.evaluate(untranslated)).forEach((s) => seen.add(s));
  }
  for (const s of seen) if (!found.has(s)) found.set(s, path);
  console.log(`${path}: ${seen.size}`);
}
await browser.close();

const file = `i18n-missing-${lang}.tsv`;
writeFileSync(file, [...found].map(([s, p]) => `${p}\t${s}`).join("\n") + "\n");
console.log(`${found.size} texts → ${file}`);
