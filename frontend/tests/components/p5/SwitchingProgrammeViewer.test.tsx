/**
 * Tests for the SwitchingProgrammeViewer component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SwitchingProgrammeViewer from "../../../src/components/p5/SwitchingProgrammeViewer";
import { useCommissioningStore } from "../../../src/store/commissioningStore";
import type { ProgrammeDetail } from "../../../src/types/commissioning";

vi.mock("../../../src/store/commissioningStore");

const MOCK_PROGRAMME: ProgrammeDetail = {
  programme_id: "p-1",
  title: "OSS First Energisation",
  pic_name: "Jan",
  status: "in_progress",
  current_step_index: 1,
  created_at: "2025-01-01T00:00:00Z",
  equipment_states: [],
  steps: [
    {
      step_id: "S-001",
      step_number: 1,
      phase: 1,
      step_type: "check",
      action: "Verify megger test results",
      equipment_id: "",
      responsible: "PiC",
      pic_confirmation: true,
      verification: "Check test certificates",
      notes: "Safety critical",
      status: "completed",
      executed_at: "2025-01-01T00:01:00Z",
      executed_by: "Jan",
    },
    {
      step_id: "S-002",
      step_number: 2,
      phase: 1,
      step_type: "check",
      action: "Verify SF6 gas pressure",
      equipment_id: "CB-OSS-220-01",
      responsible: "Local",
      pic_confirmation: false,
      verification: "Read gauge",
      notes: "",
      status: "pending",
      executed_at: null,
      executed_by: "",
    },
    {
      step_id: "S-016",
      step_number: 16,
      phase: 2,
      step_type: "switching",
      action: "Open earth switch ES-ON-220-01",
      equipment_id: "ES-ON-220-01",
      responsible: "SCADA",
      pic_confirmation: true,
      verification: "SCADA indication",
      notes: "",
      status: "pending",
      executed_at: null,
      executed_by: "",
    },
  ],
};

beforeEach(() => {
  vi.mocked(useCommissioningStore).mockReturnValue({
    activeProgramme: MOCK_PROGRAMME,
    executeStep: vi.fn(),
  } as unknown as ReturnType<typeof useCommissioningStore>);
});

describe("SwitchingProgrammeViewer", () => {
  it("renders the programme header with progress", () => {
    render(<SwitchingProgrammeViewer />);
    expect(screen.getByText("Switching Programme")).toBeDefined();
    expect(screen.getByText(/1\/3 steps completed/)).toBeDefined();
  });

  it("renders phase headers", () => {
    render(<SwitchingProgrammeViewer />);
    expect(screen.getByText(/Pre-Energisation Checks/)).toBeDefined();
    expect(screen.getByText(/Energisation Sequence/)).toBeDefined();
  });

  it("renders step actions", () => {
    render(<SwitchingProgrammeViewer />);
    expect(screen.getByText("Verify megger test results")).toBeDefined();
    expect(screen.getByText("Verify SF6 gas pressure")).toBeDefined();
  });

  it("shows execute button only for current step", () => {
    render(<SwitchingProgrammeViewer />);
    const executeButtons = screen.getAllByText("Execute");
    // Only step S-002 (index 1 = current) should have execute
    expect(executeButtons.length).toBe(1);
  });

  it("returns null when no active programme", () => {
    vi.mocked(useCommissioningStore).mockReturnValue({
      activeProgramme: null,
      executeStep: vi.fn(),
    } as unknown as ReturnType<typeof useCommissioningStore>);

    const { container } = render(<SwitchingProgrammeViewer />);
    expect(container.innerHTML).toBe("");
  });
});
