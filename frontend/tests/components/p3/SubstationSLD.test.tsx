/**
 * Tests for the SubstationSLD component (live SLD with breaker states).
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SubstationSLD from "../../../src/components/p3/SubstationSLD";
import { useScadaStore } from "../../../src/store/scadaStore";

vi.mock("../../../src/store/scadaStore");
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="reactflow">{children}</div>
  ),
  Background: () => null,
  Controls: () => null,
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom" },
  MarkerType: { ArrowClosed: "arrowclosed" },
}));

const noop = () => {};

function mockStore(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    substationSummary: null,
    breakerStates: {},
    faultHighlightNodeId: null,
    toggleBreaker: noop,
    measurements: [],
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

describe("SubstationSLD", () => {
  it("shows loading message when substationSummary is null", () => {
    mockStore();
    render(<SubstationSLD />);
    expect(
      screen.getByText("Loading substation configuration..."),
    ).toBeDefined();
  });

  it("renders SLD title and device counts when data is loaded", () => {
    mockStore({
      substationSummary: {
        total_devices: 42,
        total_logical_nodes: 186,
        devices: [
          {
            name: "OSS_PROT_IED01",
            equipment_type: "protection_ied",
            logical_devices: [{ logical_nodes: [{}, {}] }],
          },
          {
            name: "WTG_01",
            equipment_type: "wtg_controller",
            logical_devices: [{ logical_nodes: [{}] }],
          },
        ],
      },
      breakerStates: {
        "cb-400": "CLOSED",
        "cb-220": "CLOSED",
      },
      measurements: [
        { nodeId: "bb-400kv", voltageKV: 400, currentA: 420, powerMW: 290 },
      ],
    });

    render(<SubstationSLD />);
    expect(screen.getByText("Substation SLD")).toBeDefined();
  });
});
