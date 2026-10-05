/**
 * PermitWorkflowPanel — states follow the backend state machine and the
 * transitions respect the acting role's permissions.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PermitWorkflowPanel from "../../../src/components/p3/PermitWorkflowPanel";
import { useScadaStore } from "../../../src/store/scadaStore";
import type { PermitDetail } from "../../../src/types/scada";

const permit = {
  ptw_number: "PTW-2026-001",
  status: "isolation_confirmed",
  work_description: "Replace CT wiring",
  equipment_id: "BAY-OSS-66-03",
  requested_by: "Engineer",
  valid_until: null,
  current_step_number: 4,
  next_allowed_transitions: [
    { target_status: "loto_applied", required_permission: "ptw_loto" },
    { target_status: "cancelled", required_permission: "ptw_close" },
  ],
  transition_log: [
    { id: "t1", from_status: "approved", to_status: "isolation_confirmed", performed_by: "Operator", user_level: 2, notes: "", created_at: "2026-10-05T08:00:00Z" },
  ],
} as unknown as PermitDetail;

beforeEach(() => {
  useScadaStore.setState({
    activePermit: null,
    permitList: { total: 1, permits: [{ id: "1", ptw_number: "PTW-2026-001", status: "isolation_confirmed", work_description: "Replace CT wiring", equipment_id: "BAY-OSS-66-03", requested_by: "Engineer", created_at: "" }] },
    selectedRoleLevel: 2,
    roles: [{ level: 2, name: "Operator", description: "", permissions: ["ptw_loto"], mfa_required: false, security_level: 2 }],
  });
});

describe("PermitWorkflowPanel", () => {
  it("lists the register and opens a permit on click", () => {
    const openPermit = vi.fn().mockResolvedValue(undefined);
    useScadaStore.setState({ openPermit });
    render(<PermitWorkflowPanel />);
    fireEvent.click(screen.getByText("PTW-2026-001"));
    expect(openPermit).toHaveBeenCalledWith("PTW-2026-001");
  });

  it("highlights the backend state and gates transitions by permission", () => {
    useScadaStore.setState({ activePermit: permit });
    render(<PermitWorkflowPanel />);
    expect(document.querySelector("[aria-current=step]")?.textContent).toBe("4");
    expect((screen.getByRole("button", { name: /LOTO applied/ }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: /Cancel permit/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Approved → Isolated")).toBeDefined();
  });
});
