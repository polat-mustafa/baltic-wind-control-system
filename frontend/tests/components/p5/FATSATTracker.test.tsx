/**
 * Tests for the FATSATTracker component.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FATSATTracker from "../../../src/components/p5/FATSATTracker";
import { useCommissioningStore } from "../../../src/store/commissioningStore";
import type { FATCampaign } from "../../../src/types/commissioning";

vi.mock("../../../src/store/commissioningStore");

const MOCK_FAT: FATCampaign = {
  campaign_id: "fat-1",
  equipment_tag: "TX-OSS-01",
  status: "in_progress",
  specs: [
    {
      test_id: "FAT-001",
      name: "Turns Ratio",
      standard: "IEC 60076-1",
      description: "Verify transformer turns ratio",
      unit: "ratio",
      min_value: 3.28,
      max_value: 3.38,
    },
    {
      test_id: "FAT-002",
      name: "Winding Resistance",
      standard: "IEC 60076-1",
      description: "DC winding resistance",
      unit: "mΩ",
      min_value: 0.1,
      max_value: 0.5,
    },
  ],
  results: [
    {
      test_id: "FAT-001",
      measured_value: 3.33,
      verdict: "pass",
      recorded_by: "Jan",
      recorded_at: "2025-01-01T00:01:00Z",
      notes: "",
    },
  ],
  all_passed: false,
  created_at: "2025-01-01T00:00:00Z",
  approved_by: "",
  approved_at: null,
};

const mockCreateFAT = vi.fn();
const mockRecordFAT = vi.fn();
const mockApproveFAT = vi.fn();
const mockCreateSAT = vi.fn();
const mockRecordSAT = vi.fn();
const mockApproveSAT = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useCommissioningStore).mockReturnValue({
    fatCampaigns: [MOCK_FAT],
    satCampaign: null,
    activeProgramme: { pic_name: "Jan" },
    createFATCampaign: mockCreateFAT,
    recordFATResult: mockRecordFAT,
    approveFATCampaign: mockApproveFAT,
    createSATCampaign: mockCreateSAT,
    recordSATResult: mockRecordSAT,
    approveSATCampaign: mockApproveSAT,
    fetchSATCampaign: vi.fn(),
  } as unknown as ReturnType<typeof useCommissioningStore>);
});

describe("FATSATTracker", () => {
  it("renders FAT and SAT tabs", () => {
    render(<FATSATTracker />);
    expect(screen.getByText(/FAT — Factory Acceptance/)).toBeDefined();
    expect(screen.getByText(/SAT — Site Acceptance/)).toBeDefined();
  });

  it("shows FAT tab content by default", () => {
    render(<FATSATTracker />);
    expect(screen.getByText("TX-OSS-01")).toBeDefined();
  });

  it("renders test specs with standards", () => {
    render(<FATSATTracker />);
    expect(screen.getByText("Turns Ratio")).toBeDefined();
    const standardRefs = screen.getAllByText("IEC 60076-1");
    expect(standardRefs.length).toBeGreaterThanOrEqual(1);
  });

  it("shows pass verdict for recorded results", () => {
    render(<FATSATTracker />);
    expect(screen.getByText("pass")).toBeDefined();
  });

  it("shows Record button for pending tests", () => {
    render(<FATSATTracker />);
    // FAT-002 has no result, should show Record
    const recordButtons = screen.getAllByText("Record");
    expect(recordButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("switches to SAT tab", () => {
    render(<FATSATTracker />);
    fireEvent.click(screen.getByText(/SAT — Site Acceptance/));
    // No SAT campaign → shows create button
    expect(screen.getByText("Create SAT Campaign")).toBeDefined();
  });

  it("calls createSATCampaign on button click in SAT tab", () => {
    render(<FATSATTracker />);
    fireEvent.click(screen.getByText(/SAT — Site Acceptance/));
    fireEvent.click(screen.getByText("Create SAT Campaign"));
    expect(mockCreateSAT).toHaveBeenCalledWith(false);
  });
});
