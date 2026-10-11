import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KeyTerms } from "../../src/components/ui/KeyTerms";
import { GLOSSARY, termsIn } from "../../src/constants/glossary";
import tr from "../../src/lib/i18n/tr/glossary";

const TR = tr as Record<string, string>;
/** Acronyms and names read the same in Turkish and need no entry. */
const ACRONYM = /^[A-Z0-9][A-Z0-9 /]*$|^(Cp|Ct|nRMSE|NC RfG|IEC \d+|Weibull)$/;

// Radix positions the tooltip with ResizeObserver, which jsdom lacks
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("glossary", () => {
  it("has a Turkish definition for every term, and a Turkish name unless it is an acronym", () => {
    for (const g of GLOSSARY) {
      expect(TR[g.definition], g.term).toBeTruthy();
      if (!ACRONYM.test(g.term)) expect(TR[g.term], g.term).toBeTruthy();
    }
  });

  it("finds the terms a text uses, acronyms case-sensitive", () => {
    const found = termsIn("The wake of each rotor lowers AEP; the STATCOM and reactors handle cable Q.").map((t) => t.term);
    expect(found).toEqual(["AEP", "Wake", "STATCOM", "Shunt reactor"]);
    expect(termsIn("aep in lower case is not the acronym")).toEqual([]);
  });

  it("shows the definition of a key term on focus", async () => {
    render(<KeyTerms texts={["Ferranti rise on the export cable"]} />);
    const chip = screen.getByRole("button", { name: "Ferranti effect" });
    fireEvent.focus(chip);
    expect((await screen.findAllByText(/far end of a lightly loaded cable/)).length).toBeGreaterThan(0);
  });
});
