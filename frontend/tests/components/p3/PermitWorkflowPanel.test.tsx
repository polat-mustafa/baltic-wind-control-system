/**
 * Tests for the PermitWorkflowPanel component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PermitWorkflowPanel from "../../../src/components/p3/PermitWorkflowPanel";
import { useScadaStore } from "../../../src/store/scadaStore";

vi.mock("../../../src/store/scadaStore");
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="reactflow">{children}</div>
  ),
  Background: () => null,
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom" },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PermitWorkflowPanel", () => {
  it("renders create permit form", () => {
    vi.mocked(useScadaStore).mockReturnValue({
      activePermit: null,
      permitList: null,
      selectedRoleLevel: 4,
      createPermit: vi.fn(),
      transitionPermit: vi.fn(),
      roles: [{ level: 4, name: "Control Engineer" }],
    } as unknown as ReturnType<typeof useScadaStore>);

    render(<PermitWorkflowPanel />);
    expect(screen.getByText("Create New Permit")).toBeDefined();
    expect(screen.getByText("PtW 9-State Lifecycle")).toBeDefined();
    expect(screen.getByText("Create Permit")).toBeDefined();
  });

  it("renders active permit details when present", () => {
    vi.mocked(useScadaStore).mockReturnValue({
      activePermit: {
        ptw_number: "PtW-2025-001",
        status: "issued",
        current_step_number: 4,
        equipment_id: "OSS_PROT_IED01",
        requested_by: "Control Engineer",
        next_allowed_transitions: [
          { target_status: "active", required_permission: "ptw_issue" },
        ],
        transition_log: [],
      },
      permitList: {
        total: 1,
        permits: [{ id: "1", ptw_number: "PtW-2025-001", status: "issued" }],
      },
      selectedRoleLevel: 4,
      createPermit: vi.fn(),
      transitionPermit: vi.fn(),
      roles: [{ level: 4, name: "Control Engineer" }],
    } as unknown as ReturnType<typeof useScadaStore>);

    render(<PermitWorkflowPanel />);
    // PtW number appears in both active permit header and recent permits list
    expect(screen.getAllByText("PtW-2025-001")).toHaveLength(2);
    expect(screen.getByText(/ISSUED/)).toBeDefined();
    expect(screen.getByText("Available Transitions")).toBeDefined();
  });

  it("renders audit trail when transition log exists", () => {
    vi.mocked(useScadaStore).mockReturnValue({
      activePermit: {
        ptw_number: "PtW-2025-001",
        status: "active",
        current_step_number: 5,
        equipment_id: "OSS_PROT_IED01",
        requested_by: "Control Engineer",
        next_allowed_transitions: [],
        transition_log: [
          {
            id: "t1",
            from_status: "requested",
            to_status: "risk_assessed",
            performed_by: "Safety Officer",
            user_level: 4,
            notes: "",
            created_at: "2025-01-01T10:00:00",
          },
        ],
      },
      permitList: null,
      selectedRoleLevel: 4,
      createPermit: vi.fn(),
      transitionPermit: vi.fn(),
      roles: [{ level: 4, name: "Control Engineer" }],
    } as unknown as ReturnType<typeof useScadaStore>);

    render(<PermitWorkflowPanel />);
    expect(screen.getByText(/Audit Trail/)).toBeDefined();
  });
});
