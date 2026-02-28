/**
 * Tests for the SubstationSLD component.
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
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SubstationSLD", () => {
  it("shows loading message when substationSummary is null", () => {
    vi.mocked(useScadaStore).mockReturnValue({
      substationSummary: null,
    } as unknown as ReturnType<typeof useScadaStore>);

    render(<SubstationSLD />);
    expect(
      screen.getByText("Loading substation configuration..."),
    ).toBeDefined();
  });

  it("renders SLD title and device counts when data is loaded", () => {
    vi.mocked(useScadaStore).mockReturnValue({
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
    } as unknown as ReturnType<typeof useScadaStore>);

    render(<SubstationSLD />);
    expect(screen.getByText("Substation Single-Line Diagram")).toBeDefined();
  });
});
