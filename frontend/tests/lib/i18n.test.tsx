import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { applyLanguage, LANGUAGES, loadLanguage, nextLanguage, translate, type Dictionary, type Lang } from "../../src/lib/i18n";

/** MutationObserver callbacks run as microtasks. */
const flush = () => act(() => Promise.resolve());

/** Every translated language with its dictionary. */
const DICTS: [Lang, Dictionary][] = [];

beforeAll(async () => {
  for (const [code, info] of Object.entries(LANGUAGES) as [Lang, { load?: () => Promise<{ default: Dictionary }> }][]) {
    if (!info.load) continue;
    await loadLanguage(code);
    DICTS.push([code, (await info.load()).default]);
  }
});

afterEach(() => applyLanguage("en"));

describe("languages", () => {
  it("the header button cycles through every language and back", () => {
    const codes = Object.keys(LANGUAGES) as Lang[];
    let l: Lang = "en";
    for (let i = 0; i < codes.length; i++) l = nextLanguage(l);
    expect(l).toBe("en");
    expect(codes.length).toBeGreaterThan(1);
  });
});

describe("translate", () => {
  it("looks up exact text, keeps surrounding whitespace, falls back to English", () => {
    expect(translate("tr", "Wind Resource")).toBe("Rüzgâr Kaynağı");
    expect(translate("tr", " Wind Resource ")).toBe(" Rüzgâr Kaynağı ");
    expect(translate("tr", "No such label")).toBe("No such label");
    expect(translate("en", "Wind Resource")).toBe("Wind Resource");
  });

  it("fills placeholders; numeric ones match numbers only", () => {
    expect(translate("tr", "3 Critical")).toBe("3 Kritik");
    expect(translate("tr", "many Critical")).toBe("many Critical");
    // A placeholder that is a known label is translated too
    expect(translate("tr", "Layout (locked)")).toBe("Yerleşim (kilitli)");
    // ...and an unknown one stops the pattern: no half-English, half-Turkish text
    expect(translate("tr", "Something new (locked)")).toBe("Something new (locked)");
    // free placeholders (ids, names) pass through as they are
    expect(translate("tr", "Rename My wind farm")).toBe("Yeniden adlandır: My wind farm");
  });
});

function Counter() {
  const [n, setN] = useState(1);
  const [text, setText] = useState("");
  return (
    <div>
      <h1 title="Wind Resource">Wind Resource</h1>
      <p data-testid="count">{n} Critical</p>
      <code>Layout</code>
      <p data-testid="formula">
        P<sub>max</sub> at <span translate="no">Layout</span>
      </p>
      <input aria-label="typed" value={text} onChange={(e) => setText(e.target.value)} />
      <button onClick={() => setN(n + 1)}>Next</button>
    </div>
  );
}

describe("applyLanguage (DOM layer)", () => {
  it("translates in place, follows React updates and restores English without remounting", async () => {
    render(<Counter />);
    const input = screen.getByLabelText("typed") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "kept" } });

    await applyLanguage("tr");
    expect(screen.getByRole("heading").textContent).toBe("Rüzgâr Kaynağı");
    expect(screen.getByRole("heading").getAttribute("title")).toBe("Rüzgâr Kaynağı");
    expect(screen.getByRole("heading").getAttribute("lang")).toBe("tr");
    expect(screen.getByTestId("count").textContent).toBe("1 Kritik");
    expect(screen.getByText("Layout", { selector: "code" })).toBeTruthy(); // skipped
    // formulas and symbols stay as written: "max" in a subscript is not "maks"
    expect(screen.getByTestId("formula").textContent).toBe("Pmax at Layout");
    expect(input.value).toBe("kept");

    // React updates one text node of the group: the new value is translated again
    act(() => screen.getByText("İleri").click());
    await flush();
    expect(screen.getByTestId("count").textContent).toBe("2 Kritik");

    await applyLanguage("en");
    expect(screen.getByRole("heading").textContent).toBe("Wind Resource");
    expect(screen.getByRole("heading").hasAttribute("lang")).toBe(false);
    expect(screen.getByTestId("count").textContent).toBe("2 Critical");
    expect(screen.getByText("Next")).toBeTruthy();
    expect(input.value).toBe("kept");
  });

  it("the last request wins when the switches overlap", async () => {
    render(<h2>Collapse</h2>);
    const slow = applyLanguage("tr");
    await applyLanguage("en");
    await slow;
    expect(screen.getByRole("heading").textContent).toBe("Collapse");
  });

  it("translates elements added later", async () => {
    await applyLanguage("tr");
    const el = document.createElement("span");
    el.textContent = "Collapse";
    document.body.appendChild(el);
    await flush();
    expect(el.textContent).toBe("Daralt");
    el.remove();
  });
});

/** Chart toolbar labels that come from plotly.js itself. */
const PLOTLY = ["Download plot as a PNG", "Share chart...", "Autoscale", "Reset axes"];

/** Frontend and backend source as one normalised string: dictionary keys must appear in it. */
function sourceText(): string {
  const files: string[] = [];
  const walk = (d: string) =>
    readdirSync(d).forEach((f) => {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx?|py|json)$/.test(f) && !p.includes(join("lib", "i18n"))) files.push(p);
    });
  walk("src");
  // Text the backend sends (check findings, notes) is translated too
  walk("../backend/app");
  return (
    files
      // Python joins adjacent literals: "a " "b" is one string; TS content splits long text with "a " + "b"
      .map((f) =>
        readFileSync(f, "utf8")
          .replace(/"\s*\n\s*"/g, "")
          .replace(/(["'])\s*\+\s*\1/g, ""),
      )
      .join("\n")
      // escapes as the runtime string has them (turbinePartEducation.ts spells non-ASCII as \uXXXX)
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\(["'])/g, "$1")
      .replace(/&amp;/g, "&")
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<")
      .replace(/\s+/g, " ")
  );
}

describe("dictionaries", () => {
  it("every key is English text that still exists in the source", () => {
    const source = sourceText();
    for (const [code, dict] of DICTS) {
      const stale = Object.keys(dict).filter((k) => !k.includes("{") && !source.includes(k) && !PLOTLY.includes(k));
      expect(stale, code).toEqual([]);
    }
  });

  it("every placeholder in a key appears in its translation", () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const [code, dict] of DICTS) for (const [k, v] of Object.entries(dict)) expect(names(v), `${code}: ${k}`).toEqual(names(k));
  });
});
