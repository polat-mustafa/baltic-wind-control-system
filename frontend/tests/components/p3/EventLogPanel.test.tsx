/**
 * Tests for the EventLogPanel component (persistent SOE log).
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EventLogPanel from "../../../src/components/p3/EventLogPanel";
import { useScadaStore } from "../../../src/store/scadaStore";
import type { SOEEvent } from "../../../src/store/scadaStore";

vi.mock("../../../src/store/scadaStore");

const noop = () => {};

function mockStore(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    eventLog: [],
    simulationResult: null,
    clearEventLog: noop,
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

describe("EventLogPanel", () => {
  it("shows empty message when no events", () => {
    mockStore();
    render(<EventLogPanel />);
    expect(
      screen.getByText(/No events/),
    ).toBeDefined();
  });

  it("renders event log with entries from persistent store", () => {
    const eventLog: SOEEvent[] = [
      {
        id: "SOE-00001",
        timestamp: Date.now(),
        source: "System",
        type: "fault_inception",
        description: "Fault inception at 66 kV busbar",
        priority: "CRITICAL",
      },
      {
        id: "SOE-00002",
        timestamp: Date.now() + 15,
        source: "OSS_PROT_IED01",
        type: "relay_trip",
        description: "Relay tripped",
        priority: "CRITICAL",
      },
    ];

    mockStore({ eventLog });
    render(<EventLogPanel />);
    expect(screen.getByText("Event Log / SOE")).toBeDefined();
    expect(screen.getByText("2 entries")).toBeDefined();
  });

  it("shows column headers", () => {
    const eventLog: SOEEvent[] = [
      {
        id: "SOE-00001",
        timestamp: Date.now(),
        source: "System",
        type: "fault_inception",
        description: "Fault inception",
        priority: "INFO",
      },
    ];

    mockStore({ eventLog });
    render(<EventLogPanel />);
    expect(screen.getByText("Time")).toBeDefined();
    expect(screen.getByText("Source")).toBeDefined();
    expect(screen.getByText("Type")).toBeDefined();
    expect(screen.getByText("Description")).toBeDefined();
  });
});
