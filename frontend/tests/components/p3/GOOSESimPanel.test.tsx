/**
 * Tests for the GOOSESimPanel component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GOOSESimPanel from "../../../src/components/p3/GOOSESimPanel";
import { useScadaStore } from "../../../src/store/scadaStore";

vi.mock("../../../src/store/scadaStore");
vi.mock("react-plotly.js", () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GOOSESimPanel", () => {
  it("shows placeholder when simulationResult is null", () => {
    vi.mocked(useScadaStore).mockReturnValue({
      simulationResult: null,
      retransmissionResult: null,
    } as unknown as ReturnType<typeof useScadaStore>);

    render(<GOOSESimPanel />);
    expect(
      screen.getByText(
        "Run a GOOSE fault simulation to see the protection timeline",
      ),
    ).toBeDefined();
  });

  it("renders compliance badge as IEC COMPLIANT when passing", () => {
    vi.mocked(useScadaStore).mockReturnValue({
      simulationResult: {
        fault_type: "busbar_overcurrent",
        location: "66 kV Busbar Section 1",
        fault_current_pu: 8.5,
        events: [
          {
            event_type: "fault_inception",
            timestamp_ms: 0,
            description: "Fault inception",
            ied_name: "",
          },
          {
            event_type: "relay_trip",
            timestamp_ms: 15,
            description: "Relay trip",
            ied_name: "OSS_PROT_IED01",
          },
        ],
        goose_messages: [],
        compliance: {
          goose_latency_ms: 2.8,
          goose_max_allowed_ms: 4.0,
          goose_compliant: true,
          total_clearance_ms: 55.0,
          clearance_max_allowed_ms: 80.0,
          clearance_compliant: true,
        },
      },
      retransmissionResult: null,
    } as unknown as ReturnType<typeof useScadaStore>);

    render(<GOOSESimPanel />);
    expect(screen.getByText("IEC COMPLIANT")).toBeDefined();
    expect(screen.getByText(/busbar_overcurrent/)).toBeDefined();
  });

  it("renders NON-COMPLIANT badge when failing", () => {
    vi.mocked(useScadaStore).mockReturnValue({
      simulationResult: {
        fault_type: "busbar_overcurrent",
        location: "66 kV Busbar",
        fault_current_pu: 8.5,
        events: [],
        goose_messages: [],
        compliance: {
          goose_latency_ms: 6.0,
          goose_max_allowed_ms: 4.0,
          goose_compliant: false,
          total_clearance_ms: 55.0,
          clearance_max_allowed_ms: 80.0,
          clearance_compliant: true,
        },
      },
      retransmissionResult: null,
    } as unknown as ReturnType<typeof useScadaStore>);

    render(<GOOSESimPanel />);
    expect(screen.getByText("NON-COMPLIANT")).toBeDefined();
  });

  it("displays GOOSE latency and fault clearance values", () => {
    vi.mocked(useScadaStore).mockReturnValue({
      simulationResult: {
        fault_type: "busbar_overcurrent",
        location: "66 kV Busbar",
        fault_current_pu: 8.5,
        events: [],
        goose_messages: [],
        compliance: {
          goose_latency_ms: 2.8,
          goose_max_allowed_ms: 4.0,
          goose_compliant: true,
          total_clearance_ms: 55.0,
          clearance_max_allowed_ms: 80.0,
          clearance_compliant: true,
        },
      },
      retransmissionResult: null,
    } as unknown as ReturnType<typeof useScadaStore>);

    render(<GOOSESimPanel />);
    expect(screen.getByText("GOOSE Latency")).toBeDefined();
    expect(screen.getByText("Fault Clearance")).toBeDefined();
    expect(screen.getByText("Fault Current")).toBeDefined();
  });
});
