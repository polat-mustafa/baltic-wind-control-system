/**
 * Tests for the EquipmentStateDiagram component (XYFlow SLD).
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EquipmentStateDiagram from "../../../src/components/p5/EquipmentStateDiagram";
import { useCommissioningStore } from "../../../src/store/commissioningStore";
import type { ProgrammeDetail } from "../../../src/types/commissioning";

vi.mock("../../../src/store/commissioningStore");

// Mock XYFlow to avoid canvas rendering in tests
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="react-flow">{children}</div>
  ),
  Background: () => <div data-testid="rf-background" />,
  Controls: () => <div data-testid="rf-controls" />,
}));

const MOCK_PROGRAMME: ProgrammeDetail = {
  programme_id: "p-1",
  title: "OSS First Energisation",
  pic_name: "Jan",
  status: "in_progress",
  current_step_index: 0,
  created_at: "2025-01-01T00:00:00Z",
  equipment_states: [
    { equipment_id: "CB-OSS-220-01", equipment_type: "circuit_breaker", voltage_kv: 220, location: "OSS", state: "open" },
    { equipment_id: "DS-OSS-220-01", equipment_type: "disconnector", voltage_kv: 220, location: "OSS", state: "closed" },
    { equipment_id: "ES-ON-220-01", equipment_type: "earth_switch", voltage_kv: 220, location: "onshore", state: "earthed" },
  ],
  steps: [],
};

beforeEach(() => {
  vi.mocked(useCommissioningStore).mockReturnValue({
    activeProgramme: MOCK_PROGRAMME,
    anomalies: [],
  } as unknown as ReturnType<typeof useCommissioningStore>);
});

describe("EquipmentStateDiagram", () => {
  it("renders the XYFlow diagram container", () => {
    render(<EquipmentStateDiagram />);
    expect(screen.getByTestId("react-flow")).toBeDefined();
  });

  it("renders the SLD title", () => {
    render(<EquipmentStateDiagram />);
    expect(screen.getByText(/Equipment.*Diagram|Single.*Line|SLD/i)).toBeDefined();
  });

  it("returns null when no active programme", () => {
    vi.mocked(useCommissioningStore).mockReturnValue({
      activeProgramme: null,
      anomalies: [],
    } as unknown as ReturnType<typeof useCommissioningStore>);

    const { container } = render(<EquipmentStateDiagram />);
    expect(container.innerHTML).toBe("");
  });
});
