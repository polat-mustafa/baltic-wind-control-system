/**
 * Tests for the P4 forecasting store: views, academy chapter, last real-data result.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { useForecastStore } from "../../src/store/forecastStore";

describe("forecastStore", () => {
  beforeEach(() => useForecastStore.setState({ tab: "real", chapter: "why", real: null }));

  it("opens on the real-data view", () => {
    expect(useForecastStore.getState().tab).toBe("real");
  });

  it("openChapter switches to the academy at that chapter", () => {
    useForecastStore.getState().openChapter("tft");
    expect(useForecastStore.getState()).toMatchObject({ tab: "academy", chapter: "tft" });
  });
});
