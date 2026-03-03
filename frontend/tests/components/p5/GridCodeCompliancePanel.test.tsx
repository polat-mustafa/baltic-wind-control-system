/**
 * Tests for the GridCodeCompliancePanel (EON/ION/FON pipeline).
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GridCodeCompliancePanel from "../../../src/components/p5/GridCodeCompliancePanel";
import { useCommissioningStore } from "../../../src/store/commissioningStore";

vi.mock("../../../src/store/commissioningStore");

// Mock XYFlow to avoid canvas rendering in tests
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="react-flow">{children}</div>
  ),
  Background: () => <div data-testid="rf-background" />,
  Controls: () => <div data-testid="rf-controls" />,
  MarkerType: { ArrowClosed: "arrowclosed" },
}));

beforeEach(() => {
  vi.mocked(useCommissioningStore).mockReturnValue({
    complianceCampaign: null,
    activeProgramme: { programme_id: "p-1" },
    createComplianceCampaign: vi.fn(),
    recordComplianceResult: vi.fn(),
    submitNotification: vi.fn(),
    approveNotification: vi.fn(),
  } as unknown as ReturnType<typeof useCommissioningStore>);
});

describe("GridCodeCompliancePanel", () => {
  it("renders the panel title", () => {
    render(<GridCodeCompliancePanel />);
    expect(screen.getByText(/Grid.*Code.*Compliance|EON.*ION.*FON/i)).toBeDefined();
  });

  it("shows create campaign button when no campaign exists", () => {
    render(<GridCodeCompliancePanel />);
    expect(screen.getByText(/Create.*Campaign|Start.*Compliance/i)).toBeDefined();
  });

  it("renders the three notification stages when campaign exists", () => {
    vi.mocked(useCommissioningStore).mockReturnValue({
      complianceCampaign: {
        campaign_id: "c-1",
        programme_id: "p-1",
        stages: {
          eon: { stage: "eon", status: "pending", tests: [], submitted_to: null, submitted_at: null, approved_at: null },
          ion: { stage: "ion", status: "pending", tests: [], submitted_to: null, submitted_at: null, approved_at: null },
          fon: { stage: "fon", status: "pending", tests: [], submitted_to: null, submitted_at: null, approved_at: null },
        },
        created_at: "2025-01-01T00:00:00Z",
        cod_achieved: false,
        cod_date: null,
      },
      activeProgramme: { programme_id: "p-1" },
      createComplianceCampaign: vi.fn(),
      recordComplianceResult: vi.fn(),
      submitNotification: vi.fn(),
      approveNotification: vi.fn(),
    } as unknown as ReturnType<typeof useCommissioningStore>);

    render(<GridCodeCompliancePanel />);
    expect(screen.getByText(/EON/)).toBeDefined();
    expect(screen.getByText(/ION/)).toBeDefined();
    expect(screen.getByText(/FON/)).toBeDefined();
  });
});
