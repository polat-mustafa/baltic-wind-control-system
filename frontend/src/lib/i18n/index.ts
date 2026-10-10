/**
 * UI language, gettext style: the English text IS the key. Each language other
 * than English is a dictionary English → that language (./tr/ for Türkçe); a
 * text with no entry stays English, so a new or renamed label never breaks — it
 * just waits for its translation.
 *
 * How: when a translated language is on, a MutationObserver translates the
 * rendered DOM in place — text nodes and the title / aria-label / placeholder /
 * alt attributes — and keeps the English original next to each node. React is
 * not involved: nothing re-renders or remounts on a switch, so every store,
 * form field, result, open dialog and tutor chat stays exactly as it was. Back
 * to English restores the originals and stops the observer.
 *
 * React only ever writes a text node or attribute when its own value changes,
 * so a write we did not make is a new English original — it is recorded and
 * translated again. Dynamic text uses `{name}` placeholders in the key
 * ("{n} Critical" → "{n} Kritik"). The text children of one element are
 * translated as one string, so JSX like `{n} turbines` matches "{n} turbines".
 *
 * <html lang> stays "en"; each translated element gets its own lang (screen
 * readers, language-aware upper-casing). Skipped: <code>, <pre>, sub/sup,
 * formulas, editable fields and anything marked translate="no".
 *
 * Adding a language (e.g. German):
 *   1. copy ./tr/ to ./de/ and translate the values (keys stay English);
 *   2. add one line to LANGUAGES below: `de: { label: "DE", name: "Deutsch", load: () => import("./de") }`;
 *   3. `npm run i18n:missing -- de` lists the visible text still in English.
 * The header button cycles through LANGUAGES; tests/lib/i18n.test.tsx checks every
 * dictionary (keys still exist in the source, placeholders match).
 */

import { create } from "zustand";

import { readStored, writeStored } from "../storage";

export type Dictionary = Record<string, string>;

interface LanguageInfo {
  /** Short code on the header button. */
  label: string;
  /** Own name of the language, for the button tooltip. */
  name: string;
  /** The dictionary, loaded on first use (its own chunk). English has none. */
  load?: () => Promise<{ default: Dictionary }>;
}

/** Every UI language, in the order the header button cycles through them. */
export const LANGUAGES = {
  en: { label: "EN", name: "English" },
  tr: { label: "TR", name: "Türkçe", load: () => import("./tr") },
} satisfies Record<string, LanguageInfo>;

export type Lang = keyof typeof LANGUAGES;

export const LANG_KEY = "of.lang.v1";

const CODES = Object.keys(LANGUAGES) as Lang[];
const isLang = (v: string | null): v is Lang => v !== null && v in LANGUAGES;

/** The language after `lang` (the header button). */
export const nextLanguage = (lang: Lang): Lang => CODES[(CODES.indexOf(lang) + 1) % CODES.length];

// ── Lookup ───────────────────────────────────────────────────────────

/** Numeric placeholders ({n}, {n1}, {n2}…) match only a number; any other name matches any text. */
const NUMERIC = /^n\d*$/;
/** Placeholders kept verbatim (ids, names, titles); any other text placeholder must be a known label. */
const FREE = /^(id|name|list|design|topic|title|scenario|need|node|mark\d*)$/;

interface Pattern {
  re: RegExp;
  names: string[];
  value: string;
  numeric: boolean;
}

/** A loaded dictionary with its `{name}` keys compiled: "{n} Critical" → /^([-−+]?\d[\d.,]*) Critical$/. */
interface Compiled {
  dict: Dictionary;
  patterns: Pattern[];
  /** Pattern results, so live values re-rendered every second cost one Map hit. */
  cache: Map<string, string | undefined>;
}

const loaded = new Map<Lang, Compiled>();

function compile(dict: Dictionary): Compiled {
  const patterns = Object.entries(dict)
    .filter(([k]) => k.includes("{"))
    .map(([k, v]) => {
      const names = [...k.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      const re = k
        .replace(/[.*+?^$()|[\]\\]/g, "\\$&")
        .replace(/\{(\w+)\}/g, (_, n: string) => (NUMERIC.test(n) ? "([-−+]?\\d[\\d.,]*)" : "(.+?)"));
      return { re: new RegExp(`^${re}$`, "s"), names, value: v, numeric: names.every((n) => NUMERIC.test(n)) };
    });
  return { dict, patterns, cache: new Map() };
}

/** Load (once) and compile `lang`'s dictionary; English needs none. */
export async function loadLanguage(lang: Lang): Promise<void> {
  const info: LanguageInfo = LANGUAGES[lang];
  if (!info.load || loaded.has(lang)) return;
  loaded.set(lang, compile((await info.load()).default));
}

function lookup(c: Compiled, key: string): string | undefined {
  const hit = c.dict[key];
  if (hit !== undefined) return hit;
  if (c.cache.has(key)) return c.cache.get(key);
  if (c.cache.size > 5000) c.cache.clear();
  const found = matchPattern(c, key);
  c.cache.set(key, found);
  return found;
}

function matchPattern(c: Compiled, key: string): string | undefined {
  const hasDigit = /\d/.test(key);
  next: for (const p of c.patterns) {
    if (p.numeric && !hasDigit) continue;
    const m = p.re.exec(key);
    if (!m) continue;
    const parts: Record<string, string> = {};
    for (const [i, n] of p.names.entries()) {
      const part = m[i + 1];
      const tr = NUMERIC.test(n) ? part : lookup(c, part);
      // A text placeholder must itself translate ("{label} fault" with a known label);
      // otherwise the result would be half English, half translated. Free names pass as-is.
      if (tr === undefined && !FREE.test(n)) continue next;
      parts[n] = tr ?? part;
    }
    return p.value.replace(/\{(\w+)\}/g, (_, n: string) => parts[n] ?? "");
  }
  return undefined;
}

/** `s` in `lang` (loaded with loadLanguage); surrounding whitespace is kept, unknown text comes back unchanged. */
export function translate(lang: Lang, s: string): string {
  const c = loaded.get(lang);
  if (!c || !/[A-Za-z]/.test(s)) return s;
  const [, lead, body, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(s) as RegExpExecArray;
  const hit = lookup(c, body.replace(/\s+/g, " "));
  return hit === undefined ? s : lead + hit + trail;
}

// ── DOM layer ────────────────────────────────────────────────────────

const ATTRS = ["title", "aria-label", "placeholder", "alt"];
const MARK = "data-i18n"; // elements we gave a lang attribute
// Formulas and symbols stay as written: sub/sup (P_max), MathML, var
const SKIP = "script,style,code,pre,textarea,kbd,samp,sub,sup,math,var,[translate='no'],[contenteditable='true']";

/** What each node shows now and its English original. */
const shownText = new WeakMap<Text, { orig: string; shown: string }>();
const shownAttr = new WeakMap<Element, Record<string, { orig: string; shown: string }>>();

let current: Lang = "en";
let observer: MutationObserver | null = null;

function skipped(el: Element | null): boolean {
  return !el || el.closest(SKIP) !== null;
}

/** Translate the text children of `el` as one string (or one node when mixed with elements). */
function doText(nodes: Text[]) {
  const origs = nodes.map((n) => {
    const rec = shownText.get(n);
    // Not what we wrote last → React (or the first render) put a new English value there.
    return rec && rec.shown === n.nodeValue ? rec.orig : (n.nodeValue ?? "");
  });
  const joined = origs.join("");
  const out = translate(current, joined);
  nodes.forEach((n, i) => {
    const show = out === joined ? origs[i] : i === 0 ? out : "";
    if (n.nodeValue !== show) n.nodeValue = show;
    shownText.set(n, { orig: origs[i], shown: show });
  });
  // lang on the translated element only: CSS `uppercase` then follows that language's
  // rules (Turkish i → İ) there, while English still waiting for a translation keeps I.
  const parent = nodes[0].parentElement;
  if (!parent) return;
  const ours = parent.hasAttribute(MARK);
  if (out !== joined && (ours || !parent.hasAttribute("lang"))) {
    parent.setAttribute("lang", current);
    parent.setAttribute(MARK, "");
  } else if (out === joined && ours && nodes.length === parent.childNodes.length) {
    parent.removeAttribute("lang");
    parent.removeAttribute(MARK);
  }
}

function doElementText(el: Element) {
  if (skipped(el)) return;
  const kids = [...el.childNodes];
  const texts = kids.filter((k): k is Text => k.nodeType === Node.TEXT_NODE);
  if (texts.length === 0) return;
  if (texts.length === kids.length) doText(texts);
  else texts.forEach((n) => doText([n]));
}

function doAttrs(el: Element) {
  if (skipped(el)) return;
  let recs = shownAttr.get(el);
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v === null) continue;
    recs ??= {};
    const rec = recs[a];
    const orig = rec && rec.shown === v ? rec.orig : v;
    const show = translate(current, orig);
    if (v !== show) el.setAttribute(a, show);
    recs[a] = { orig, shown: show };
  }
  if (recs) shownAttr.set(el, recs);
}

/** `root` and everything under it. */
function doTree(root: Element) {
  doElementText(root);
  doAttrs(root);
  for (const el of root.querySelectorAll("*")) {
    doElementText(el);
    doAttrs(el);
  }
}

function onMutations(records: MutationRecord[]) {
  for (const r of records) {
    if (r.type === "attributes") doAttrs(r.target as Element);
    else if (r.type === "characterData") {
      const parent = r.target.parentElement;
      if (parent) doElementText(parent);
    } else {
      if (r.target instanceof Element) doElementText(r.target);
      r.addedNodes.forEach((n) => n instanceof Element && doTree(n));
    }
  }
}

/** Show the whole page in `lang`; a translated language keeps watching for new text until switched off. */
let requested: Lang = "en";

export async function applyLanguage(lang: Lang): Promise<void> {
  requested = lang;
  await loadLanguage(lang);
  // A quick second click while this dictionary was loading wins
  if (requested !== lang) return;
  if (lang === "en" && current === "en") return; // nothing was translated
  current = lang;
  observer?.disconnect();
  observer = null;
  doTree(document.body);
  if (!loaded.has(lang)) {
    for (const el of document.querySelectorAll(`[${MARK}]`)) {
      el.removeAttribute("lang");
      el.removeAttribute(MARK);
    }
    return;
  }
  observer = new MutationObserver(onMutations);
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRS,
  });
}

// ── Store (the header button) ────────────────────────────────────────

interface LangStore {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const stored = readStored(LANG_KEY);

export const useLangStore = create<LangStore>((set) => ({
  lang: isLang(stored) ? stored : "en",
  setLang: (lang) => {
    writeStored(LANG_KEY, lang);
    set({ lang });
  },
}));
