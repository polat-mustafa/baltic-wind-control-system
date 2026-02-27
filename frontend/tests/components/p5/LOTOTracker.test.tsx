/**
 * Tests for the LOTOTracker component.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LOTOTracker from "../../../src/components/p5/LOTOTracker";
import { useCommissioningStore } from "../../../src/store/commissioningStore";
import type { LOTOSet } from "../../../src/types/commissioning";

vi.mock("../../../src/store/commissioningStore");

const MOCK_LOTO_SET: LOTOSet = {
  programme_id: "p-1",
  points: [
    {
      point_id: "LOTO-01",
      equipment_id: "ES-ON-220-01",
      status: "not_applied",
      locked_by: "",
      tag_number: "DT-001",
      applied_at: null,
      removed_at: null,
      removed_by: "",
    },
    {
      point_id: "LOTO-02",
      equipment_id: "ES-OSS-220-01",
      status: "applied",
      locked_by: "Jan",
      tag_number: "DT-002",
      applied_at: "2025-01-01T00:01:00Z",
      removed_at: null,
      removed_by: "",
    },
    {
      point_id: "LOTO-03",
      equipment_id: "ES-OSS-66-01",
      status: "removed",
      locked_by: "Jan",
      tag_number: "DT-003",
      applied_at: "2025-01-01T00:01:00Z",
      removed_at: "2025-01-01T00:05:00Z",
      removed_by: "Jan",
    },
  ],
  all_applied: false,
  all_removed: false,
};

const mockApplyLOTO = vi.fn();
const mockRemoveLOTO = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useCommissioningStore).mockReturnValue({
    lotoSet: MOCK_LOTO_SET,
    applyLOTO: mockApplyLOTO,
    removeLOTO: mockRemoveLOTO,
    activeProgramme: { pic_name: "Jan" },
  } as unknown as ReturnType<typeof useCommissioningStore>);
});

describe("LOTOTracker", () => {
  it("renders all LOTO points", () => {
    render(<LOTOTracker />);
    expect(screen.getByText("LOTO-01")).toBeDefined();
    expect(screen.getByText("LOTO-02")).toBeDefined();
    expect(screen.getByText("LOTO-03")).toBeDefined();
  });

  it("shows Apply Lock button for not_applied points", () => {
    render(<LOTOTracker />);
    expect(screen.getByText("Apply Lock")).toBeDefined();
  });

  it("shows Remove Lock button for applied points", () => {
    render(<LOTOTracker />);
    expect(screen.getByText("Remove Lock")).toBeDefined();
  });

  it("calls applyLOTO on Apply Lock click", () => {
    render(<LOTOTracker />);
    fireEvent.click(screen.getByText("Apply Lock"));
    expect(mockApplyLOTO).toHaveBeenCalledWith("LOTO-01", "Jan");
  });

  it("calls removeLOTO on Remove Lock click", () => {
    render(<LOTOTracker />);
    fireEvent.click(screen.getByText("Remove Lock"));
    expect(mockRemoveLOTO).toHaveBeenCalledWith("LOTO-02", "Jan");
  });

  it("shows tag numbers", () => {
    render(<LOTOTracker />);
    expect(screen.getByText("Tag: DT-001")).toBeDefined();
    expect(screen.getByText("Tag: DT-002")).toBeDefined();
  });

  it("shows empty state when no LOTO set", () => {
    vi.mocked(useCommissioningStore).mockReturnValue({
      lotoSet: null,
      applyLOTO: vi.fn(),
      removeLOTO: vi.fn(),
      activeProgramme: null,
    } as unknown as ReturnType<typeof useCommissioningStore>);

    render(<LOTOTracker />);
    expect(screen.getByText("No LOTO points available")).toBeDefined();
  });
});
