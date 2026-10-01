import { describe, expect, it } from "vitest";

import { studyCsv, summary, susGrade, susScore } from "../../src/store/studyStore";

describe("SUS scoring (Brooke 1996)", () => {
  it("scores the extremes and the neutral answer", () => {
    expect(susScore([5, 1, 5, 1, 5, 1, 5, 1, 5, 1])).toBe(100);
    expect(susScore([1, 5, 1, 5, 1, 5, 1, 5, 1, 5])).toBe(0);
    expect(susScore(Array(10).fill(3))).toBe(50);
    expect(Number.isNaN(susScore([3, 3]))).toBe(true);
  });
  it("grades on the Sauro & Lewis curve", () => {
    expect(susGrade(68)).toBe("C");
    expect(susGrade(85)).toBe("A+");
    expect(susGrade(40)).toBe("F");
  });
  it("summarises with mean, SD and a t-based CI", () => {
    const s = summary([60, 70, 80]);
    expect(s.mean).toBe(70);
    expect(s.sd).toBeCloseTo(10, 6);
    expect(s.ci95).toBeCloseTo((4.3 * 10) / Math.sqrt(3), 6);
  });
  it("exports RFC 4180 CSV with quoted fields", () => {
    const csv = studyCsv(
      [{ participant: "P1", scenarioId: "x", title: 'A "b"', score: 90, timeS: 60, mistakes: 0, at: "t" }],
      [],
    );
    expect(csv.runs.split("\n")[1]).toContain('"A ""b"""');
  });
});
