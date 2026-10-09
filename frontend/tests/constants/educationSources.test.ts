/**
 * The (i) / cap-icon panels cite backend code and standards. Keep those citations honest:
 * every "code" reference must point at a file that exists, and a standard is never
 * sourced to Wikipedia (link the publisher, a DOI, or nothing).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = resolve(__dirname, "../../..");
const SRC = resolve(__dirname, "../../src");

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? tsFiles(p) : /\.tsx?$/.test(name) ? [p] : [];
  });
}

const files = [...tsFiles(join(SRC, "constants")), ...tsFiles(join(SRC, "components"))];

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
});
