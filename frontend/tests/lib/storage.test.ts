/**
 * Tests for the localStorage helpers: legacy `bw.` → `of.` key migration.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { readStored, writeStored } from "../../src/lib/storage";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("readStored", () => {
  it("returns the value under the new key", () => {
    localStorage.setItem("of.mapTheme", "hmi");
    expect(readStored("of.mapTheme")).toBe("hmi");
  });

  it("migrates a legacy bw. value once and removes the old key", () => {
    localStorage.setItem("bw.mapTheme", "hmi");
    expect(readStored("of.mapTheme")).toBe("hmi");
    expect(localStorage.getItem("of.mapTheme")).toBe("hmi");
    expect(localStorage.getItem("bw.mapTheme")).toBeNull();
  });

  it("prefers the new key over a stale legacy value", () => {
    localStorage.setItem("of.academyLang", "en");
    localStorage.setItem("bw.academyLang", "tr");
    expect(readStored("of.academyLang")).toBe("en");
  });

  it("returns null when nothing is stored", () => {
    expect(readStored("of.study.v1")).toBeNull();
  });

  it("returns null when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readStored("of.mapTheme")).toBeNull();
  });
});

describe("writeStored", () => {
  it("writes and reports success", () => {
    expect(writeStored("of.mapTheme", "storybook")).toBe(true);
    expect(localStorage.getItem("of.mapTheme")).toBe("storybook");
  });

  it("reports failure when storage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(writeStored("of.mapTheme", "hmi")).toBe(false);
  });
});
