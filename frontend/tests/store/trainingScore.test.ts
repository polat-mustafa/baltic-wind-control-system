import { describe, expect, it } from "vitest";

import { scoreOf } from "../../src/store/trainingStore";

describe("training score", () => {
  it("is 100 for a clean run within par", () => {
    expect(scoreOf(0, 60, 90)).toBe(100);
  });
  it("costs 15 points per mistake and 1 point per 10 s over par, never below 0", () => {
    expect(scoreOf(2, 90, 90)).toBe(70);
    expect(scoreOf(0, 190, 90)).toBe(90);
    expect(scoreOf(10, 900, 90)).toBe(0);
  });
});
