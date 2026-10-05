/**
 * Permit decision and procedure script (simulation of a generic EU procedure).
 */

import { describe, expect, it } from "vitest";

import { decide, permitSteps, STANDARD_CONDITIONS, STAGES } from "../../../src/components/site/journey";
import { report } from "./fixtures";

describe("decide", () => {
  it("asks for a site when there is none", () => {
    expect(decide(null).outcome).toBe("more_information");
  });

  it("grants consent with the standard conditions when every check passes", () => {
    const d = decide(report());
    expect(d.outcome).toBe("approved");
    expect(d.conditions).toEqual(STANDARD_CONDITIONS);
    expect(d.appropriateAssessment).toBe(false);
  });

  it("refuses a site that fails a blocking check, naming the reason", () => {
    const d = decide(report({ shipping: "fail", natura2000: "warn" }));
    expect(d.outcome).toBe("refused");
    expect(d.reasons).toEqual(["Check shipping: detail shipping"]);
    expect(d.conditions).toEqual([]);
  });

  it("asks for more information when an essential check is unknown", () => {
    const d = decide(report({ depth: "unknown" }));
    expect(d.outcome).toBe("more_information");
    expect(d.reasons[0]).toContain("depth");
  });

  it("requires an appropriate assessment next to a Natura 2000 site", () => {
    const d = decide(report({ natura2000: "warn", cables: "warn" }));
    expect(d.outcome).toBe("approved_with_conditions");
    expect(d.appropriateAssessment).toBe(true);
    expect(d.conditions[0]).toContain("Art. 6(3)");
    expect(d.conditions.some((c) => c.startsWith("Check cables"))).toBe(true);
  });
});

describe("permitSteps", () => {
  it("adds the appropriate assessment only when needed", () => {
    expect(permitSteps(decide(report())).map((s) => s.id)).not.toContain("aa");
    expect(permitSteps(decide(report({ natura2000: "warn" }))).map((s) => s.id)).toContain("aa");
  });

  it("runs in order and inside the 3-year legal limit for offshore projects", () => {
    for (const r of [report(), report({ natura2000: "warn" }), report({ shipping: "fail" })]) {
      const steps = permitSteps(decide(r));
      const months = steps.map((s) => s.month);
      expect([...months].sort((a, b) => a - b)).toEqual(months);
      expect(months[months.length - 1]).toBeLessThanOrEqual(36);
      expect(steps.every((s) => s.reference.length > 0)).toBe(true);
    }
  });

  it("acknowledges completeness within 45 days and consults for at least 30 days", () => {
    const steps = permitSteps(decide(report()));
    expect(steps.find((s) => s.id === "complete")!.month).toBeLessThanOrEqual(1.5);
    expect(steps.find((s) => s.id === "consultation")!.note).toContain("30 days");
  });

  it("covers five stages", () => {
    expect(STAGES.map((s) => s.id)).toEqual(["screening", "investigation", "environment", "permit", "documents"]);
  });
});
