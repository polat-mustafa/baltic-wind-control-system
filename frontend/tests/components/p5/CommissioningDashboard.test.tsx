/**
 * Tests for the CommissioningDashboard component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CommissioningDashboard from "../../../src/components/p5/CommissioningDashboard";
import { useCommissioningStore } from "../../../src/store/commissioningStore";
import type { ProgrammeDetail } from "../../../src/types/commissioning";

vi.mock("../../../src/store/commissioningStore");
vi.mock("../../../src/hooks/usePolling", () => ({
  usePolling: vi.fn(),
}));

// Mock all child components to isolate dashboard layout tests
vi.mock("../../../src/components/p5/EquipmentStateDiagram", () => ({
  default: () => <div data-testid="equipment-sld">EquipmentStateDiagram</div>,
}));
vi.mock("../../../src/components/p5/SwitchingProgrammeViewer", () => ({
  default: () => <div data-testid="switching-viewer">SwitchingProgrammeViewer</div>,
}));
vi.mock("../../../src/components/p5/PiCDecisionPanel", () => ({
  default: () => <div data-testid="pic-panel">PiCDecisionPanel</div>,
}));
vi.mock("../../../src/components/p5/AnomalyInjection", () => ({
  default: () => <div data-testid="anomaly-panel">AnomalyInjection</div>,
}));
vi.mock("../../../src/components/p5/LOTOTracker", () => ({
  default: () => <div data-testid="loto-tracker">LOTOTracker</div>,
}));
vi.mock("../../../src/components/p5/AuditTrail", () => ({
  default: () => <div data-testid="audit-trail">AuditTrail</div>,
}));
vi.mock("../../../src/components/p5/FATSATTracker", () => ({
  default: () => <div data-testid="fatsat-tracker">FATSATTracker</div>,
}));
vi.mock("../../../src/components/p5/GridCodeCompliancePanel", () => ({
  default: () => <div data-testid="grid-compliance">GridCodeCompliancePanel</div>,
}));
vi.mock("../../../src/components/p5/EmergencyResponsePanel", () => ({
  default: () => <div data-testid="emergency-panel">EmergencyResponsePanel</div>,
}));

const MOCK_PROGRAMME: ProgrammeDetail = {
  programme_id: "p-1",
  title: "OSS First Energisation",
  pic_name: "Jan Kowalski",
  status: "in_progress",
  current_step_index: 0,
  created_at: "2025-01-01T00:00:00Z",
  equipment_states: [],
  steps: [],
};

const mockStoreFns = {
  activeProgramme: MOCK_PROGRAMME,
  error: null,
  refreshActiveProgramme: vi.fn(),
  fetchLOTO: vi.fn(),
  fetchAuditTrail: vi.fn(),
  fetchFATCampaigns: vi.fn(),
  fetchSATCampaign: vi.fn(),
  fetchEmergencyProcedures: vi.fn(),
  fetchComplianceCampaign: vi.fn(),
  clearError: vi.fn(),
  clearActiveProgramme: vi.fn(),
};

beforeEach(() => {
  vi.mocked(useCommissioningStore).mockReturnValue(
    mockStoreFns as unknown as ReturnType<typeof useCommissioningStore>,
  );
});

describe("CommissioningDashboard", () => {
  it("renders the programme title", () => {
    render(<CommissioningDashboard />);
    expect(screen.getByText("OSS First Energisation")).toBeDefined();
  });

  it("renders the PiC name", () => {
    render(<CommissioningDashboard />);
    expect(screen.getByText(/Jan Kowalski/)).toBeDefined();
  });

  it("renders the back button", () => {
    render(<CommissioningDashboard />);
    expect(screen.getByText("Back to List")).toBeDefined();
  });

  it("renders all 9 child panels", () => {
    render(<CommissioningDashboard />);
    expect(screen.getByTestId("equipment-sld")).toBeDefined();
    expect(screen.getByTestId("switching-viewer")).toBeDefined();
    expect(screen.getByTestId("pic-panel")).toBeDefined();
    expect(screen.getByTestId("anomaly-panel")).toBeDefined();
    expect(screen.getByTestId("loto-tracker")).toBeDefined();
    expect(screen.getByTestId("audit-trail")).toBeDefined();
    expect(screen.getByTestId("fatsat-tracker")).toBeDefined();
    expect(screen.getByTestId("grid-compliance")).toBeDefined();
    expect(screen.getByTestId("emergency-panel")).toBeDefined();
  });

  it("returns null when no active programme", () => {
    vi.mocked(useCommissioningStore).mockReturnValue({
      ...mockStoreFns,
      activeProgramme: null,
    } as unknown as ReturnType<typeof useCommissioningStore>);

    const { container } = render(<CommissioningDashboard />);
    expect(container.innerHTML).toBe("");
  });

  it("shows error banner when error exists", () => {
    vi.mocked(useCommissioningStore).mockReturnValue({
      ...mockStoreFns,
      error: "Connection failed",
    } as unknown as ReturnType<typeof useCommissioningStore>);

    render(<CommissioningDashboard />);
    expect(screen.getByText("Connection failed")).toBeDefined();
  });
});
