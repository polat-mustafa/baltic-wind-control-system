/**
 * Numbers quoted in lessons, panels, tours and page text must match the backend (evidence
 * programme B5). src/data/plantFacts.json is written and checked by the backend test
 * tests/test_plant_facts.py; here every phrase that quotes an SB-510 number is compared with
 * it, at the precision the text uses (10.66 m/s matches 10.6594).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { DEAD_BAND_PU, K_FACTOR, PSE_FRT_PROFILE } from "../../src/academy/frt";
import facts from "../../src/data/plantFacts.json";

type Fact = { [K in keyof typeof facts]: (typeof facts)[K] extends number ? K : never }[keyof typeof facts];
const SRC = resolve(__dirname, "../../src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? sourceFiles(p) : /\.tsx?$/.test(name) ? [p] : [];
  });
}

const CHECKS: { fact: Fact; re: RegExp }[] = [
  { fact: "turbines", re: /\b(\d+) ?× ?15 ?MW\b/g },
  { fact: "capacity_mw", re: /\b(\d+) ?MW farm\b/g },
  { fact: "export_km", re: /\b(\d+(?:\.\d+)?) ?km (?:export|cable)\b/g },
  { fact: "reactors", re: /\b(\d+) ?× ?180 ?(?:MVA[Rr]|Mvar)\b/g },
  { fact: "statcom_mvar", re: /±(\d+) ?(?:MVA[Rr]|Mvar) STATCOM|STATCOM ±(\d+)/g },
  { fact: "cable_charging_mvar", re: /\b(\d+) ?(?:MVA[Rr]|Mvar) (?:of )?(?:cable )?charging\b/g },
  { fact: "rotor_diameter_m", re: /\b(\d+(?:\.\d+)?) ?m rotor\b/g },
  { fact: "cut_in_ms", re: /cut-in (?:speed )?(?:of )?(\d+(?:\.\d+)?) ?m\/s/g },
  { fact: "rated_ms", re: /rated (?:wind )?speed (?:of )?(\d+(?:\.\d+)?) ?m\/s/g },
  { fact: "cut_out_ms", re: /cut-out (?:speed )?(?:of )?(\d+(?:\.\d+)?) ?m\/s/g },
  { fact: "max_rotor_rpm", re: /\b\d+(?:\.\d+)? ?[–-] ?(\d+(?:\.\d+)?) ?rpm\b/g },
  { fact: "programme_steps", re: /\b(\d+)[- ]step (?:switching )?programme\b/g },
];

/** Deliberate other numbers: design alternatives, a string of turbines, another machine. */
const ALLOW: [file: string, snippet: string][] = [
  ["constants/education/library/statcomSizing.ts", "±720 MVAR STATCOM"],
  ["constants/education/library/statcomSizing.ts", "±520 MVAR STATCOM"],
  ["constants/education/library/statcomSizing.ts", "2 × 180 MVAR"],
  ["constants/education/library/cableCrossSection.ts", "6 × 15 MW"],
  ["constants/education/p1/capacityFactor.ts", "107 m rotor"],
  // the learner's own farm in an Academy mission, not SB-510
  ["academy/courses.ts", "500 MW farm"],
  // DT reference model: rated speed of the official table = 95 m/s tip speed (7.518 rpm),
  // the ROSCO pitch reference is 7.56 rpm (digital_twin/reference_model.py)
  ["components/digital-twin/ReferenceCurvePanel.tsx", "5.0–7.52 rpm"],
];

/** The quoted number equals the fact rounded to as many decimals as the text shows. */
function agrees(quoted: string, fact: number): boolean {
  const decimals = quoted.split(".")[1]?.length ?? 0;
  return Number(quoted) === Number(fact.toFixed(decimals));
}

describe("plant facts in prose", () => {
  it("every quoted SB-510 number matches the backend", () => {
    const wrong: string[] = [];
    let seen = 0;
    for (const file of sourceFiles(SRC)) {
      const rel = relative(SRC, file).replace(/\\/g, "/");
      const text = readFileSync(file, "utf-8");
      for (const { fact, re } of CHECKS) {
        for (const m of text.matchAll(re)) {
          const quoted = m[1] ?? m[2];
          if (ALLOW.some(([f, s]) => f === rel && m[0] === s)) continue;
          seen += 1;
          if (!agrees(quoted, facts[fact])) wrong.push(`${rel}: "${m[0]}" (backend ${fact} = ${facts[fact]})`);
        }
      }
    }
    expect(wrong).toEqual([]);
    expect(seen).toBeGreaterThan(40); // the patterns still find the prose
  });

  it("allow-listed exceptions still exist (remove them when the text changes)", () => {
    for (const [file, snippet] of ALLOW) expect(readFileSync(join(SRC, file), "utf-8")).toContain(snippet);
  });

  it("the Academy FRT mission uses the backend's PSE profile and fast fault current rule", () => {
    expect(PSE_FRT_PROFILE).toEqual(facts.pse_frt_profile);
    expect(K_FACTOR).toBe(facts.frt_k_min);
    expect(DEAD_BAND_PU).toBe(facts.frt_dead_band_pu);
  });
});
