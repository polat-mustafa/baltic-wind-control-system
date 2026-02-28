/**
 * Tests for the EventLogPanel component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EventLogPanel from "../../../src/components/p3/EventLogPanel";
import { useScadaStore } from "../../../src/store/scadaStore";

vi.mock("../../../src/store/scadaStore");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EventLogPanel", () => {
  it("shows empty message when no simulation results", () => {
    vi.mocked(useScadaStore).mockReturnValue({
      simulationResult: null,
    } as unknown as ReturnType<typeof useScadaStore>);

    render(<EventLogPanel />);
    expect(
      screen.getByText(/No events — run a fault simulation/),
    ).toBeDefined();
  });

  it("renders event log table with entries", () => {
    vi.mocked(useScadaStore).mockReturnValue({
      simulationResult: {
        events: [
          {
            event_type: "fault_inception",
            timestamp_ms: 0,
            description: "Fault inception at 66 kV busbar",
            ied_name: "",
          },
          {
            event_type: "relay_trip",
            timestamp_ms: 15,
            description: "Relay tripped",
            ied_name: "OSS_PROT_IED01",
          },
        ],
        goose_messages: [
          {
            gocb_ref: "OSS_PROT/GoCB01",
            dat_set: "DS01",
            go_id: "GO01",
            st_num: 1,
            sq_num: 0,
            all_data: { PTRC1_Tr_general: true },
            timestamp: "2025-01-01T00:00:00",
            app_id: "0001",
            mac_address: "01:0C:CD:01:00:00",
            vlan_id: 100,
          },
        ],
      },
    } as unknown as ReturnType<typeof useScadaStore>);

    render(<EventLogPanel />);
    expect(screen.getByText("Event Log / SOE")).toBeDefined();
    expect(screen.getByText("3 entries")).toBeDefined();
  });

  it("shows column headers", () => {
    vi.mocked(useScadaStore).mockReturnValue({
      simulationResult: {
        events: [
          {
            event_type: "fault_inception",
            timestamp_ms: 0,
            description: "Fault inception",
            ied_name: "",
          },
        ],
        goose_messages: [],
      },
    } as unknown as ReturnType<typeof useScadaStore>);

    render(<EventLogPanel />);
    expect(screen.getByText("T [ms]")).toBeDefined();
    expect(screen.getByText("Source")).toBeDefined();
    expect(screen.getByText("Type")).toBeDefined();
    expect(screen.getByText("Description")).toBeDefined();
  });
});
