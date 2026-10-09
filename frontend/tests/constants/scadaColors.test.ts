/**
 * Tests for SCADA color constants — ISA-101 compliance.
 *
 * The constants are hex copies of the Baltic Night CSS tokens (SVG, canvas and
 * Leaflet HTML strings cannot read CSS variables), so they must stay in sync
 * with the @theme block of index.css.
 */

import { describe, expect, it } from "vitest";
import {
  SCADA_COLORS,
  EQUIPMENT_STATE_COLOR,
  VOLTAGE_COLOR,
} from "../../src/constants/scadaColors";
import css from "../../src/index.css?raw";

const theme = css.slice(css.indexOf("@theme {"), css.indexOf("}", css.indexOf("@theme {")));
const token = (name: string) => theme.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1].toLowerCase();

describe("SCADA_COLORS", () => {
  it.each([
    ["ENERGIZED", "status-normal"],
    ["DE_ENERGIZED", "status-offline"],
    ["EARTHED", "status-comms-loss"],
    ["FAULT", "status-alarm"],
    ["WARNING", "status-warning"],
    ["ALARM_CRITICAL", "status-alarm"],
    ["ALARM_HIGH", "status-warning"],
    ["ALARM_MEDIUM", "status-info"],
    ["ALARM_LOW", "status-offline"],
    ["VOLTAGE_400KV", "voltage-400kv"],
    ["VOLTAGE_220KV", "voltage-220kv"],
    ["VOLTAGE_66KV", "voltage-66kv"],
    ["VOLTAGE_NEUTRAL", "border-secondary"],
  ] as const)("%s matches the --color-%s token", (key, name) => {
    expect(token(name)).toBeDefined();
    expect(SCADA_COLORS[key].toLowerCase()).toBe(token(name));
  });

  it("avoids pure RGB primaries (ISA-101: no #FF0000 / #00FF00)", () => {
    for (const c of Object.values(SCADA_COLORS)) expect(c.toUpperCase()).not.toMatch(/^#(FF0000|00FF00|0000FF)$/);
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
