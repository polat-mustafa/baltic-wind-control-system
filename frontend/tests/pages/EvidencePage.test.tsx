import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import evidence from "../../src/data/evidence.json";
import { GAPS, KINDS, type EvidenceItem } from "../../src/data/evidenceCoverage";
import EvidencePage from "../../src/pages/EvidencePage";

const ITEMS = evidence.items as EvidenceItem[];
const REPO_ROOT = resolve(__dirname, "../../..");

describe("EvidencePage", () => {
  it("lists every check written by the backend tests, grouped by module", () => {
    render(<EvidencePage />);
    expect(ITEMS.length).toBeGreaterThanOrEqual(10);
    for (const area of new Set(ITEMS.map((i) => i.area))) expect(screen.getByRole("heading", { name: area })).toBeDefined();
    const areas = new Set(ITEMS.map((i) => i.area)).size;
    // area tables (header + rows) and the coverage matrix (header + one row per area + the gaps)
    expect(screen.getAllByRole("row")).toHaveLength(ITEMS.length + areas + 1 + areas + GAPS.length);
  });

  it("gives every check a known kind and shows the modules without a check", () => {
    for (const i of ITEMS) expect(KINDS.map((k) => k.id)).toContain(i.kind);
    render(<EvidencePage />);
    expect(screen.getAllByText("not validated")).toHaveLength(GAPS.length);
  });

  it("cites a test file that exists and a reference for each check", () => {
    for (const i of ITEMS) {
      expect(existsSync(resolve(REPO_ROOT, i.test)), i.test).toBe(true);
      expect(i.against.length).toBeGreaterThan(10);
      expect(Number.isFinite(i.value)).toBe(true);
    }
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
  });
});
