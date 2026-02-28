/**
 * Tests for the SCADAKPIHeader component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SCADAKPIHeader from "../../../src/components/p3/SCADAKPIHeader";
import { useScadaStore } from "../../../src/store/scadaStore";

vi.mock("../../../src/store/scadaStore");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SCADAKPIHeader", () => {
  it("returns null when substationSummary is null", () => {
    vi.mocked(useScadaStore).mockReturnValue({
      substationSummary: null,
      simulationResult: null,
      permitList: null,
    } as unknown as ReturnType<typeof useScadaStore>);

    const { container } = render(<SCADAKPIHeader />);
    expect(container.innerHTML).toBe("");
  });

  it("renders all 5 KPI cards when data is loaded", () => {
    vi.mocked(useScadaStore).mockReturnValue({
      substationSummary: {
        total_devices: 42,
        total_logical_nodes: 186,
        protection_ieds: 4,
        wtg_controllers: 34,
      },
      simulationResult: {
        compliance: {
          goose_compliant: true,
          clearance_compliant: true,
          goose_latency_ms: 2.8,
        },
        events: [
          { event_type: "relay_trip", timestamp_ms: 15 },
          { event_type: "breaker_open", timestamp_ms: 55 },
          { event_type: "goose_publish", timestamp_ms: 20 },
        ],
      },
      permitList: {
        total: 5,
        permits: [
          { status: "active" },
          { status: "issued" },
          { status: "closed" },
        ],
      },
    } as unknown as ReturnType<typeof useScadaStore>);

    render(<SCADAKPIHeader />);

    expect(screen.getByText("Total IEDs")).toBeDefined();
    expect(screen.getByText("42")).toBeDefined();
    expect(screen.getByText("Logical Nodes")).toBeDefined();
    expect(screen.getByText("186")).toBeDefined();
    expect(screen.getByText("Active Permits")).toBeDefined();
    expect(screen.getAllByText("2")).toHaveLength(2); // active permits count + protection events count
    expect(screen.getByText("GOOSE Compliance")).toBeDefined();
    expect(screen.getByText("PASS")).toBeDefined();
    expect(screen.getByText("Protection Events")).toBeDefined();
  });

  it("shows FAIL when compliance fails", () => {
    vi.mocked(useScadaStore).mockReturnValue({
      substationSummary: {
        total_devices: 42,
        total_logical_nodes: 186,
        protection_ieds: 4,
        wtg_controllers: 34,
      },
      simulationResult: {
        compliance: {
          goose_compliant: false,
          clearance_compliant: true,
          goose_latency_ms: 5.2,
        },
        events: [],
      },
      permitList: { total: 0, permits: [] },
    } as unknown as ReturnType<typeof useScadaStore>);

    render(<SCADAKPIHeader />);
    expect(screen.getByText("FAIL")).toBeDefined();
  });

  it("shows --- when no simulation has been run", () => {
    vi.mocked(useScadaStore).mockReturnValue({
      substationSummary: {
        total_devices: 42,
        total_logical_nodes: 186,
        protection_ieds: 4,
        wtg_controllers: 34,
      },
      simulationResult: null,
      permitList: null,
    } as unknown as ReturnType<typeof useScadaStore>);

    render(<SCADAKPIHeader />);
    expect(screen.getByText("---")).toBeDefined();
    expect(screen.getByText("Run simulation first")).toBeDefined();
  });

  it("shows device subtitle with prot + WTG counts", () => {
    vi.mocked(useScadaStore).mockReturnValue({
      substationSummary: {
        total_devices: 42,
        total_logical_nodes: 186,
        protection_ieds: 4,
        wtg_controllers: 34,
      },
      simulationResult: null,
      permitList: null,
    } as unknown as ReturnType<typeof useScadaStore>);

    render(<SCADAKPIHeader />);
    expect(screen.getByText("4 prot + 34 WTG")).toBeDefined();
  });
});
