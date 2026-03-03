/**
 * Tests for SCADA color constants — ISA-101 compliance.
 *
 * Colors use ISA-101 muted tones (not pure RGB) for dark control room use.
 */

import { describe, expect, it } from "vitest";
import {
  SCADA_COLORS,
  EQUIPMENT_STATE_COLOR,
  VOLTAGE_COLOR,
} from "../../src/constants/scadaColors";

describe("SCADA_COLORS", () => {
  it("defines all required equipment state colors", () => {
    expect(SCADA_COLORS.ENERGIZED).toBe("#3ecf6e");
    expect(SCADA_COLORS.DE_ENERGIZED).toBe("#6b7280");
    expect(SCADA_COLORS.EARTHED).toBe("#22d3ee");
    expect(SCADA_COLORS.FAULT).toBe("#ef4444");
    expect(SCADA_COLORS.WARNING).toBe("#f5a623");
  });

  it("defines all alarm priority colors", () => {
    expect(SCADA_COLORS.ALARM_CRITICAL).toBe("#ef4444");
    expect(SCADA_COLORS.ALARM_HIGH).toBe("#f97316");
    expect(SCADA_COLORS.ALARM_MEDIUM).toBe("#eab308");
    expect(SCADA_COLORS.ALARM_LOW).toBe("#38bdf8");
  });

  it("defines all voltage level colors", () => {
    expect(SCADA_COLORS.VOLTAGE_400KV).toBe("#ef4444");
    expect(SCADA_COLORS.VOLTAGE_220KV).toBe("#3b82f6");
    expect(SCADA_COLORS.VOLTAGE_66KV).toBe("#f97316");
    expect(SCADA_COLORS.VOLTAGE_NEUTRAL).toBe("#6b7280");
  });

  it("is frozen (as const) — all values are string literals", () => {
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
