import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MathText } from "../../../src/components/ui/MathPaper";
import { formatMath } from "../../../src/lib/formatMath";
import * as p1 from "../../../src/constants/education/p1";
import * as p2 from "../../../src/constants/education/p2";
import { arrayVoltageEducation } from "../../../src/constants/education/library/arrayVoltage";
import { TURBINE_PART_EDUCATION } from "../../../src/constants/turbinePartEducation";

const html = (s: string) => render(<MathText text={s} />).container.innerHTML;

describe("formatMath", () => {
  it("turns _x into a subscript and ^x into a superscript", () => {
    expect(html("P_max")).toContain("P<sub>max</sub>");
    expect(html("(1+r)^−n")).toContain("(1+r)<sup>−n</sup>");
    expect(html("e^(−3R/X)")).toContain("e<sup>−3R/X</sup>");
    expect(html("S_i^Sobol")).toContain("S<sub>i</sub><sup>Sobol</sup>");
    expect(html("I_k,max")).toContain("I<sub>k,max</sub>");
  });

  it("leaves prose and Turkish suffixes alone", () => {
    expect(html("P_max'ın")).toContain("P<sub>max</sub>'ın");
    expect(html("a plain sentence, no maths")).not.toMatch(/<su[bp]>/);
  });

  it("formats every formula in the content: no bare _ or ^ left", () => {
    const formulas = [
      ...Object.values(p1),
      ...Object.values(p2),
      arrayVoltageEducation,
    ].flatMap((c) => (c && typeof c === "object" && "formulas" in c ? c.formulas : []));
    const parts = Object.values(TURBINE_PART_EDUCATION).flatMap((e) => e.formulas);
    const texts = [...formulas, ...parts].flatMap((f) => [f.expression, ...f.variables.map((v) => v.symbol)]);
    expect(texts.length).toBeGreaterThan(100);
    const bare = texts.filter((t) => {
      const plain = formatMath(t)
        .filter((n) => typeof n === "string")
        .join("");
      return /[_^]/.test(plain);
    });
    expect(bare).toEqual([]);
  });
});
