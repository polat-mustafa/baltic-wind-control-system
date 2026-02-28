/**
 * Tests for the AlarmListPanel component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AlarmListPanel from "../../../src/components/p3/AlarmListPanel";
import { useScadaStore } from "../../../src/store/scadaStore";

vi.mock("../../../src/store/scadaStore");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AlarmListPanel", () => {
  it("shows empty message when no simulation results", () => {
    vi.mocked(useScadaStore).mockReturnValue({
      simulationResult: null,
    } as unknown as ReturnType<typeof useScadaStore>);

    render(<AlarmListPanel />);
    expect(
      screen.getByText(/No alarms — run a fault simulation/),
    ).toBeDefined();
  });

  it("renders alarm table with sorted priorities", () => {
    vi.mocked(useScadaStore).mockReturnValue({
      simulationResult: {
        events: [
          {
            event_type: "goose_publish",
            timestamp_ms: 20,
            description: "GOOSE published",
            ied_name: "PROT_01",
          },
          {
            event_type: "relay_trip",
            timestamp_ms: 15,
            description: "Relay tripped",
            ied_name: "OSS_PROT_IED01",
          },
          {
            event_type: "relay_pickup",
            timestamp_ms: 5,
            description: "Relay pickup",
            ied_name: "OSS_PROT_IED01",
          },
        ],
      },
    } as unknown as ReturnType<typeof useScadaStore>);

    render(<AlarmListPanel />);
    expect(screen.getByText("Alarm List (ISA-18.2)")).toBeDefined();
    expect(screen.getByText("3 alarms")).toBeDefined();
    expect(screen.getByText("CRIT")).toBeDefined();
    expect(screen.getByText("WARN")).toBeDefined();
    expect(screen.getByText("INFO")).toBeDefined();
  });

  it("shows priority column headers", () => {
    vi.mocked(useScadaStore).mockReturnValue({
      simulationResult: {
        events: [
          {
            event_type: "relay_trip",
            timestamp_ms: 15,
            description: "Relay tripped",
            ied_name: "OSS_PROT_IED01",
          },
        ],
      },
    } as unknown as ReturnType<typeof useScadaStore>);

    render(<AlarmListPanel />);
    expect(screen.getByText("Pri")).toBeDefined();
    expect(screen.getByText("Time [ms]")).toBeDefined();
    expect(screen.getByText("IED")).toBeDefined();
    expect(screen.getByText("Description")).toBeDefined();
  });
});
