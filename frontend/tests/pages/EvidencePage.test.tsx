import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import evidence from "../../src/data/evidence.json";
import EvidencePage, { type EvidenceItem } from "../../src/pages/EvidencePage";

const ITEMS = evidence.items as EvidenceItem[];
const REPO_ROOT = resolve(__dirname, "../../..");

describe("EvidencePage", () => {
  it("lists every check written by the backend tests, grouped by module", () => {
    render(<EvidencePage />);
    expect(ITEMS.length).toBeGreaterThanOrEqual(10);
    for (const area of new Set(ITEMS.map((i) => i.area))) expect(screen.getByRole("heading", { name: area })).toBeDefined();
    expect(screen.getAllByRole("row")).toHaveLength(ITEMS.length + new Set(ITEMS.map((i) => i.area)).size);
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
