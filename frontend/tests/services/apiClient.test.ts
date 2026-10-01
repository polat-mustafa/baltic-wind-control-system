import { describe, expect, it } from "vitest";

import { formatErrorDetail } from "../../src/services/apiClient";

describe("formatErrorDetail", () => {
  it("keeps string details", () => {
    expect(formatErrorDetail("Farm not found", 404)).toBe("Farm not found");
  });

  it("turns FastAPI 422 lists into readable text (was '[object Object]')", () => {
    const detail = [
      { loc: ["body", "farms", 0, "turbine_count"], msg: "Input should be greater than or equal to 1" },
      { loc: ["body"], msg: "Value error, Provide exactly one of farm_ids or farms" },
    ];
    expect(formatErrorDetail(detail, 422)).toBe(
      "farms.0.turbine_count: Input should be greater than or equal to 1; Value error, Provide exactly one of farm_ids or farms",
    );
  });

  it("falls back to the HTTP status", () => {
    expect(formatErrorDetail(undefined, 500)).toBe("HTTP 500");
  });
});
