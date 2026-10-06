/**
 * GOOSESimPanel — scenario cards before a run, clearing-time budget after.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import GOOSESimPanel from "../../../src/components/p3/GOOSESimPanel";
import { useScadaStore } from "../../../src/store/scadaStore";
import type { FaultSimulationResult } from "../../../src/types/scada";

vi.mock("react-plotly.js", () => ({ default: () => <div data-testid="plot" /> }));

const ev = (event_type: string, timestamp_ms: number) => ({ event_type, timestamp_ms, description: event_type, ied_name: "" });

const result = (clearing: number): FaultSimulationResult => ({
  fault_type: "busbar_overcurrent",
  location: "220kV_busbar",
  fault_current_ka: 9.1,
  load_current_ka: 1.34,
  protection_function: "PDIF",
  description: "3-phase fault on the OSS 220 kV busbar",
  events: [ev("fault_occurs", 0), ev("protection_detects", 12), ev("goose_received", 14), ev("breaker_trip_initiated", 15), ev("breaker_open", 40), ev("arc_extinguished", clearing), ev("scada_alarm", 272)],
  goose_messages: [],
  compliance: { goose_latency_ms: 1.5, goose_max_allowed_ms: 3, goose_compliant: true, total_clearance_ms: clearing, clearance_max_allowed_ms: 100, clearance_compliant: clearing <= 100 },
  retransmission_schedule_ms: [],
});

beforeEach(() => {
  useScadaStore.setState({
    simulationResult: null,
    retransmissionResult: null,
    faultScenarios: [{ fault_type: "busbar_overcurrent", description: "Ik'' = 9.1 kA" }],
  });
});

describe("GOOSESimPanel", () => {
  it("offers the scenarios before a run", () => {
    render(<GOOSESimPanel />);
    expect(screen.getByText("87B busbar differential")).toBeDefined();
    expect(screen.getByRole("button", { name: /Inject fault/ })).toBeDefined();
  });

  it("shows fault current against load and the clearing time", () => {
    useScadaStore.setState({ simulationResult: result(50) });
    render(<GOOSESimPanel />);
    expect(screen.getByText("9.1 kA")).toBeDefined();
    expect(screen.getByText("6.8 × load current")).toBeDefined();
    expect(screen.getAllByText("50.0 ms").length).toBeGreaterThan(0);
  });

  it("flags a clearing time beyond the target", () => {
    useScadaStore.setState({ simulationResult: result(120) });
    render(<GOOSESimPanel />);
    expect(screen.getByText(/NOT MET/)).toBeDefined();
  });
});
