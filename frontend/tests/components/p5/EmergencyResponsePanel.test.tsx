/**
 * Tests for the EmergencyResponsePanel component.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EmergencyResponsePanel from "../../../src/components/p5/EmergencyResponsePanel";
import { useCommissioningStore } from "../../../src/store/commissioningStore";

vi.mock("../../../src/store/commissioningStore");

const MOCK_PROCEDURES = [
  {
    emergency_type: "arc_flash",
    severity: "critical",
    immediate_actions: ["De-energise area", "Administer first aid"],
    responsible: "PiC",
    reference_document: "BWA-ERP-001",
    automated_scada_actions: ["Trip all CBs"],
    communication_protocol: ["Call emergency services"],
  },
  {
    emergency_type: "sf6_leak",
    severity: "high",
    immediate_actions: ["Evacuate switchgear room", "Ventilate area"],
    responsible: "Safety Officer",
    reference_document: "BWA-ERP-002",
    automated_scada_actions: ["Alarm SF6 low"],
    communication_protocol: ["Notify OIM"],
  },
  {
    emergency_type: "comms_failure",
    severity: "medium",
    immediate_actions: ["Switch to backup comms"],
    responsible: "SCADA Engineer",
    reference_document: "BWA-ERP-005",
    automated_scada_actions: [],
    communication_protocol: ["Notify control room"],
  },
];

beforeEach(() => {
  vi.mocked(useCommissioningStore).mockReturnValue({
    emergencyProcedures: MOCK_PROCEDURES,
    emergencyLog: [],
    activeProgramme: { programme_id: "p-1" },
    triggerEmergency: vi.fn(),
    fetchEmergencyLog: vi.fn(),
  } as unknown as ReturnType<typeof useCommissioningStore>);
});

describe("EmergencyResponsePanel", () => {
  it("renders the panel title", () => {
    render(<EmergencyResponsePanel />);
    expect(screen.getByText(/Emergency.*Response/i)).toBeDefined();
  });

  it("displays emergency procedure cards", () => {
    render(<EmergencyResponsePanel />);
    expect(screen.getByText(/Arc.*Flash/i)).toBeDefined();
    expect(screen.getByText(/SF.*Leak|SF₆/i)).toBeDefined();
    expect(screen.getByText(/Comms.*Failure/i)).toBeDefined();
  });

  it("shows severity labels", () => {
    render(<EmergencyResponsePanel />);
    expect(screen.getAllByText(/critical/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/high/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows trigger button when procedure card is expanded", () => {
    render(<EmergencyResponsePanel />);
    // Click the first procedure card to expand it
    fireEvent.click(screen.getByText(/Arc.*Flash/i));
    expect(screen.getByText(/Trigger Emergency/i)).toBeDefined();
  });

  it("shows empty state when no procedures loaded", () => {
    vi.mocked(useCommissioningStore).mockReturnValue({
      emergencyProcedures: [],
      emergencyLog: [],
      activeProgramme: { programme_id: "p-1" },
      triggerEmergency: vi.fn(),
      fetchEmergencyLog: vi.fn(),
    } as unknown as ReturnType<typeof useCommissioningStore>);

    render(<EmergencyResponsePanel />);
    // Should still render the panel title
    expect(screen.getByText(/Emergency.*Response/i)).toBeDefined();
  });
});
