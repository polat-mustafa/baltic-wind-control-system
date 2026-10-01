import { describe, expect, it } from "vitest";

import { boost, makeData, powerCurve, predictBoosted, treeRules } from "../../../src/components/p4/academy/boosting";

describe("teaching gradient boosting", () => {
  const train = makeData(120, 1);
  const test = makeData(120, 2);

  it("generates physical toy data (0 ≤ P ≤ 15 MW, zero below cut-in)", () => {
    expect(train.every((s) => s.p >= 0 && s.p <= 15)).toBe(true);
    expect(powerCurve(2.5)).toBe(0);
    expect(powerCurve(12)).toBe(15);
  });

  it("lowers the training error with every tree (η ≤ 1, squared loss)", () => {
    const { history } = boost(train, test, 40, 0.3, 2);
    for (let i = 1; i < history.length; i++) expect(history[i].train).toBeLessThanOrEqual(history[i - 1].train + 1e-9);
    expect(history.at(-1)!.train).toBeLessThan(history[0].train * 0.1);
  });

  it("learns the power curve: rated region near 15 MW, below cut-in near 0", () => {
    const { model } = boost(train, test, 80, 0.3, 2);
    expect(predictBoosted(model, 18)).toBeGreaterThan(13.5);
    expect(predictBoosted(model, 1)).toBeLessThan(1.5);
  });

  it("explains a tree as readable rules", () => {
    const { model } = boost(train, test, 1, 1, 1);
    const rules = treeRules(model.trees[0], 1);
    expect(rules).toHaveLength(2);
    expect(rules[0]).toMatch(/u < \d+\.\d → [+-]\d+\.\d\d MW/);
  });
});
