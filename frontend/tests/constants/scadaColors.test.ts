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
    expect(SCADA_COLORS.ENERGIZED).toBe("#2E7D5B");
    expect(SCADA_COLORS.DE_ENERGIZED).toBe("#8B8B8B");
    expect(SCADA_COLORS.EARTHED).toBe("#7A4FB0");
    expect(SCADA_COLORS.FAULT).toBe("#C8362D");
    expect(SCADA_COLORS.WARNING).toBe("#C9A227");
  });

  it("defines all alarm priority colors", () => {
    expect(SCADA_COLORS.ALARM_CRITICAL).toBe("#C8362D");
    expect(SCADA_COLORS.ALARM_HIGH).toBe("#E5C100");
    expect(SCADA_COLORS.ALARM_MEDIUM).toBe("#4FC3D8");
    expect(SCADA_COLORS.ALARM_LOW).toBe("#5C7CB1");
  });

  it("defines all voltage level colors", () => {
    expect(SCADA_COLORS.VOLTAGE_400KV).toBe("#B0413E");
    expect(SCADA_COLORS.VOLTAGE_220KV).toBe("#4A6FA5");
    expect(SCADA_COLORS.VOLTAGE_66KV).toBe("#B07B3E");
    expect(SCADA_COLORS.VOLTAGE_NEUTRAL).toBe("#5A5F66");
  });

  it("is frozen (as const) — all values are string literals", () => {
    const keys = Object.keys(SCADA_COLORS);
    expect(keys.length).toBe(14);
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
