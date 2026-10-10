/**
 * The (i) / cap-icon panels cite backend code and standards. Keep those citations honest:
 * every "code" reference must point at a file that exists and name only functions and
 * constants that file really has, every topic shows real-world cases with a source and its
 * code, and a standard is never sourced to Wikipedia (link the publisher, a DOI, or nothing).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { arrayVoltageEducation } from "../../src/constants/education/library/arrayVoltage";
import { cableCrossSectionEducation } from "../../src/constants/education/library/cableCrossSection";
import { hvacVsHvdcEducation } from "../../src/constants/education/library/hvacVsHvdc";
import { statcomSizingEducation } from "../../src/constants/education/library/statcomSizing";
import { turbineSelectionEducation } from "../../src/constants/education/library/turbineSelection";
import * as p1 from "../../src/constants/education/p1";
import * as p2 from "../../src/constants/education/p2";
import type { EducationContent } from "../../src/types/education";

const REPO = resolve(__dirname, "../../..");
const SRC = resolve(__dirname, "../../src");

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? tsFiles(p) : /\.tsx?$/.test(name) ? [p] : [];
  });
}

const files = [...tsFiles(join(SRC, "constants")), ...tsFiles(join(SRC, "components"))];

const topics: EducationContent[] = [
  ...Object.values(p1),
  ...Object.values(p2),
  arrayVoltageEducation,
  cableCrossSectionEducation,
  hvacVsHvdcEducation,
  statcomSizingEducation,
  turbineSelectionEducation,
];

describe("education sources", () => {
  it("code references point at files that exist", () => {
    const missing: string[] = [];
    for (const f of files) {
      for (const m of readFileSync(f, "utf-8").matchAll(/file:\s*"((?:backend|frontend)\/[^"]+)"/g)) {
        if (!existsSync(join(REPO, m[1]))) missing.push(`${m[1]} (cited in ${f})`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("no standard or source links to Wikipedia", () => {
    const hits = files.filter((f) => readFileSync(f, "utf-8").includes("wikipedia.org"));
    expect(hits).toEqual([]);
  });

  it("every topic has sourced real-world cases and its code", () => {
    expect(topics.length).toBeGreaterThan(30);
    const gaps = topics.flatMap((t) => [
      ...(t.realWorldCases.length ? [] : [`${t.id}: no real-world case`]),
      ...t.realWorldCases.filter((c) => !c.source).map((c) => `${t.id}: "${c.title}" has no source`),
      ...(t.codeReferences?.length ? [] : [`${t.id}: no code reference`]),
    ]);
    expect(gaps).toEqual([]);
  });

  it("functions and constants named in a code reference exist in that file", () => {
    const wrong: string[] = [];
    for (const t of topics) {
      for (const ref of t.codeReferences ?? []) {
        const src = readFileSync(join(REPO, ref.file), "utf-8");
        // `name()` must be defined or called there; SCREAMING_CASE constants must appear
        const calls = [...ref.description.matchAll(/([A-Za-z_]\w*)\(\)/g)].map((m) => m[1]);
        const consts = [...ref.description.matchAll(/\b([A-Z][A-Z0-9]*_[A-Z0-9_]+)\b/g)].map((m) => m[1]);
        for (const n of calls) if (!new RegExp(`\\b${n}\\s*\\(`).test(src)) wrong.push(`${t.id}: ${n}() not in ${ref.file}`);
        for (const n of consts) if (!new RegExp(`\\b${n}\\b`).test(src)) wrong.push(`${t.id}: ${n} not in ${ref.file}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});
