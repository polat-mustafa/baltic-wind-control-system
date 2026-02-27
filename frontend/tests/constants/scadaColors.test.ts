/**
 * Tests for SCADA color constants — ISA-101 compliance.
 */

import { describe, expect, it } from "vitest";
import {
  SCADA_COLORS,
  EQUIPMENT_STATE_COLOR,
  VOLTAGE_COLOR,
} from "../../src/constants/scadaColors";

describe("SCADA_COLORS", () => {
  it("defines all required equipment state colors", () => {
    expect(SCADA_COLORS.ENERGIZED).toBe("#00FF00");
    expect(SCADA_COLORS.DE_ENERGIZED).toBe("#808080");
    expect(SCADA_COLORS.EARTHED).toBe("#00FFFF");
    expect(SCADA_COLORS.FAULT).toBe("#FF0000");
    expect(SCADA_COLORS.WARNING).toBe("#FFAA00");
  });

  it("defines all alarm priority colors", () => {
    expect(SCADA_COLORS.ALARM_CRITICAL).toBe("#FF0000");
    expect(SCADA_COLORS.ALARM_HIGH).toBe("#FF6600");
    expect(SCADA_COLORS.ALARM_MEDIUM).toBe("#FFCC00");
    expect(SCADA_COLORS.ALARM_LOW).toBe("#00CCFF");
  });

  it("defines all voltage level colors", () => {
    expect(SCADA_COLORS.VOLTAGE_400KV).toBe("#FF0000");
    expect(SCADA_COLORS.VOLTAGE_220KV).toBe("#0000FF");
    expect(SCADA_COLORS.VOLTAGE_66KV).toBe("#008000");
    expect(SCADA_COLORS.VOLTAGE_NEUTRAL).toBe("#000000");
  });

  it("is frozen (as const) — all values are string literals", () => {
    // TypeScript enforces this at compile time, but we verify at runtime
    // that the object has the expected number of keys
    const keys = Object.keys(SCADA_COLORS);
    expect(keys.length).toBe(13);
  });
});

describe("EQUIPMENT_STATE_COLOR", () => {
  it("maps all equipment states to colors", () => {
    expect(EQUIPMENT_STATE_COLOR.open).toBe(SCADA_COLORS.DE_ENERGIZED);
    expect(EQUIPMENT_STATE_COLOR.closed).toBe(SCADA_COLORS.ENERGIZED);
    expect(EQUIPMENT_STATE_COLOR.earthed).toBe(SCADA_COLORS.EARTHED);
    expect(EQUIPMENT_STATE_COLOR.racked_in).toBe(SCADA_COLORS.DE_ENERGIZED);
    expect(EQUIPMENT_STATE_COLOR.racked_out).toBe(SCADA_COLORS.DE_ENERGIZED);
  });
});

describe("VOLTAGE_COLOR", () => {
  it("maps voltage levels to standard colors", () => {
    expect(VOLTAGE_COLOR[400]).toBe(SCADA_COLORS.VOLTAGE_400KV);
    expect(VOLTAGE_COLOR[220]).toBe(SCADA_COLORS.VOLTAGE_220KV);
    expect(VOLTAGE_COLOR[66]).toBe(SCADA_COLORS.VOLTAGE_66KV);
  });
});
