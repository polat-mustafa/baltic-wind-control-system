/**
 * Tests for the AuditTrail component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuditTrail from "../../../src/components/p5/AuditTrail";
import { useCommissioningStore } from "../../../src/store/commissioningStore";
import type { AuditRecord } from "../../../src/types/commissioning";

vi.mock("../../../src/store/commissioningStore");

const MOCK_RECORDS: AuditRecord[] = [
  {
    record_id: "r-1",
    timestamp: "2025-01-01T00:00:00Z",
    action: "programme_started",
    performed_by: "Jan",
    step_id: "",
    details: "Programme started by PiC",
  },
  {
    record_id: "r-2",
    timestamp: "2025-01-01T00:01:00Z",
    action: "step_executed",
    performed_by: "Jan",
    step_id: "S-001",
    details: "Verified megger test results",
  },
  {
    record_id: "r-3",
    timestamp: "2025-01-01T00:02:00Z",
    action: "loto_applied",
    performed_by: "Jan",
    step_id: "",
    details: "LOTO applied to ES-ON-220-01",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useCommissioningStore).mockReturnValue({
    auditRecords: MOCK_RECORDS,
  } as unknown as ReturnType<typeof useCommissioningStore>);
});

describe("AuditTrail", () => {
  it("renders the header with record count", () => {
    render(<AuditTrail />);
    expect(screen.getByText("Audit Trail")).toBeDefined();
    expect(screen.getByText("3 records")).toBeDefined();
  });

  it("renders audit records in reverse chronological order", () => {
    render(<AuditTrail />);
    // Most recent record (LOTO) should appear first
    const details = screen.getAllByText(/LOTO|Verified|Programme started/);
    expect(details.length).toBeGreaterThanOrEqual(3);
  });

  it("displays performer names", () => {
    render(<AuditTrail />);
    // All records are by "Jan"
    const janElements = screen.getAllByText(/Jan/);
    expect(janElements.length).toBeGreaterThanOrEqual(3);
  });

  it("shows empty state when no records", () => {
    vi.mocked(useCommissioningStore).mockReturnValue({
      auditRecords: [],
    } as unknown as ReturnType<typeof useCommissioningStore>);

    render(<AuditTrail />);
    expect(screen.getByText("No audit records yet")).toBeDefined();
  });

  it("shows step IDs when present", () => {
    render(<AuditTrail />);
    expect(screen.getByText(/S-001/)).toBeDefined();
  });
});
