/**
 * Tests for the PiCDecisionPanel component.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PiCDecisionPanel from "../../../src/components/p5/PiCDecisionPanel";
import { useCommissioningStore } from "../../../src/store/commissioningStore";
import type { ProgrammeDetail } from "../../../src/types/commissioning";

vi.mock("../../../src/store/commissioningStore");

const BASE_PROGRAMME: ProgrammeDetail = {
  programme_id: "p-1",
  title: "OSS First Energisation",
  pic_name: "Jan Kowalski",
  status: "in_progress",
  current_step_index: 0,
  created_at: "2025-01-01T00:00:00Z",
  equipment_states: [],
  steps: [
    {
      step_id: "S-001",
      step_number: 1,
      phase: 1,
      step_type: "check",
      action: "Verify megger test",
      equipment_id: "",
      responsible: "PiC",
      pic_confirmation: true,
      verification: "",
      notes: "",
      status: "pending",
      executed_at: null,
      executed_by: "",
    },
  ],
};

const mockPicDecision = vi.fn();
const mockEmergencyStop = vi.fn();

function setupStore(overrides: Partial<ProgrammeDetail> = {}) {
  vi.mocked(useCommissioningStore).mockReturnValue({
    activeProgramme: { ...BASE_PROGRAMME, ...overrides },
    picDecision: mockPicDecision,
    emergencyStop: mockEmergencyStop,
  } as unknown as ReturnType<typeof useCommissioningStore>);
}

beforeEach(() => {
  vi.clearAllMocks();
  setupStore();
});

describe("PiCDecisionPanel", () => {
  it("displays the PiC name", () => {
    render(<PiCDecisionPanel />);
    expect(screen.getByText("Jan Kowalski")).toBeDefined();
  });

  it("shows programme status", () => {
    render(<PiCDecisionPanel />);
    expect(screen.getByText("in_progress")).toBeDefined();
  });

  it("disables GO/NO-GO when not at hold point", () => {
    render(<PiCDecisionPanel />);
    const goBtn = screen.getByText("GO");
    expect(goBtn.hasAttribute("disabled")).toBe(true);
  });

  it("enables GO/NO-GO when at hold point", () => {
    setupStore({ status: "hold" });
    render(<PiCDecisionPanel />);
    const goBtn = screen.getByText("GO");
    expect(goBtn.hasAttribute("disabled")).toBe(false);
  });

  it("calls picDecision with 'go' on GO click", () => {
    setupStore({ status: "hold" });
    render(<PiCDecisionPanel />);
    fireEvent.click(screen.getByText("GO"));
    expect(mockPicDecision).toHaveBeenCalledWith("go", "Jan Kowalski");
  });

  it("shows emergency stop button", () => {
    render(<PiCDecisionPanel />);
    expect(screen.getByText("EMERGENCY STOP")).toBeDefined();
  });

  it("shows confirmation form on emergency stop click", () => {
    render(<PiCDecisionPanel />);
    fireEvent.click(screen.getByText("EMERGENCY STOP"));
    expect(screen.getByText("CONFIRM STOP")).toBeDefined();
  });

  it("returns null when no active programme", () => {
    vi.mocked(useCommissioningStore).mockReturnValue({
      activeProgramme: null,
      picDecision: vi.fn(),
      emergencyStop: vi.fn(),
    } as unknown as ReturnType<typeof useCommissioningStore>);

    const { container } = render(<PiCDecisionPanel />);
    expect(container.innerHTML).toBe("");
  });

  it("shows terminal status for completed programme", () => {
    setupStore({ status: "completed" });
    render(<PiCDecisionPanel />);
    expect(screen.getByText("Programme COMPLETED")).toBeDefined();
  });

  it("shows terminal status for aborted programme", () => {
    setupStore({ status: "aborted" });
    render(<PiCDecisionPanel />);
    expect(screen.getByText("Programme ABORTED")).toBeDefined();
  });
});
