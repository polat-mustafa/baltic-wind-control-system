/**
 * Tests for the Forecast API client (real-data day-ahead endpoints).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/services/forecastApi";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: "OK", json: () => Promise.resolve([]) });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("forecastApi", () => {
  it("getRealDayAhead asks for the site, URL-encoded", async () => {
    await api.getRealDayAhead("kriegers flak");
    expect(mockFetch.mock.calls[0][0]).toBe("/api/v1/forecast/real-data/day-ahead?site=kriegers%20flak");
  });

  it("getRealSites lists the real series", async () => {
    await api.getRealSites();
    expect(mockFetch.mock.calls[0][0]).toBe("/api/v1/forecast/real-data/sites");
  });
});
