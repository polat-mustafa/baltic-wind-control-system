/**
 * Tests for the AlarmListPanel component (ISA-18.2 alarm table).
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AlarmListPanel from "../../../src/components/p3/AlarmListPanel";
import { useScadaStore } from "../../../src/store/scadaStore";
import type { SCADAAlarm } from "../../../src/types/scada";

vi.mock("../../../src/store/scadaStore");

const noop = () => {};

function mockStore(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    alarms: [],
    alarmFilter: { priority: "ALL", state: "ALL", equipment: "" },
    setAlarmFilter: noop,
    acknowledgeAlarm: noop,
    acknowledgeAll: noop,
    clearAllResolved: noop,
    shelveAlarm: noop,
    unshelveAlarm: noop,
    ...overrides,
  };

  vi.mocked(useScadaStore).mockImplementation((selector: unknown) => {
    if (typeof selector === "function") {
      return (selector as (s: Record<string, unknown>) => unknown)(defaults);
    }
    return defaults;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AlarmListPanel", () => {
  it("shows empty message when no alarms", () => {
    mockStore();
    render(<AlarmListPanel />);
    expect(
      screen.getByText(/No alarms/),
    ).toBeDefined();
  });

  it("renders alarm table with priorities", () => {
    const alarms: SCADAAlarm[] = [
      {
        id: "ALM-0001",
        timestamp: Date.now(),
        priority: "CRITICAL",
        tag: "GOOSE.relay_trip",
        equipment: "OSS_PROT_IED01",
        description: "Relay tripped",
        value: "15.0 ms",
        setpoint: "N/A",
        state: "ACTIVE",
        durationSec: 5,
        acknowledgedBy: null,
        acknowledgedAt: null,
        shelved: false,
        faultType: "busbar_overcurrent",
        probableCause: "Busbar fault",
        recommendedAction: "Check protection",
      },
      {
        id: "ALM-0002",
        timestamp: Date.now(),
        priority: "LOW",
        tag: "GOOSE.goose_publish",
        equipment: "PROT_01",
        description: "GOOSE published",
        value: "20.0 ms",
        setpoint: "N/A",
        state: "ACTIVE",
        durationSec: 3,
        acknowledgedBy: null,
        acknowledgedAt: null,
        shelved: false,
        faultType: "busbar_overcurrent",
        probableCause: "Normal operation",
        recommendedAction: "No action",
      },
    ];

    mockStore({ alarms });
    render(<AlarmListPanel />);
    expect(screen.getByText("Alarm List")).toBeDefined();
    expect(screen.getByText("CRIT")).toBeDefined();
    expect(screen.getByText("LOW")).toBeDefined();
  });

  it("shows column headers", () => {
    const alarms: SCADAAlarm[] = [
      {
        id: "ALM-0001",
        timestamp: Date.now(),
        priority: "CRITICAL",
        tag: "GOOSE.relay_trip",
        equipment: "OSS_PROT_IED01",
        description: "Relay tripped",
        value: "15.0 ms",
        setpoint: "N/A",
        state: "ACTIVE",
        durationSec: 0,
        acknowledgedBy: null,
        acknowledgedAt: null,
        shelved: false,
        faultType: "busbar_overcurrent",
        probableCause: "Fault",
        recommendedAction: "Check",
      },
    ];

    mockStore({ alarms });
    render(<AlarmListPanel />);
    expect(screen.getByText("Pri")).toBeDefined();
    expect(screen.getByText("Time")).toBeDefined();
    expect(screen.getByText("Equipment")).toBeDefined();
    expect(screen.getByText("Description")).toBeDefined();
  });
});
