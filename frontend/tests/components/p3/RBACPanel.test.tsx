/**
 * Tests for the RBACPanel component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RBACPanel from "../../../src/components/p3/RBACPanel";
import { useScadaStore } from "../../../src/store/scadaStore";

vi.mock("../../../src/store/scadaStore");

beforeEach(() => {
  vi.clearAllMocks();
});

const mockRoles = [
  {
    level: 1,
    name: "Observer",
    description: "Read-only access",
    permissions: ["view_scada"],
    mfa_required: false,
    security_level: 1,
  },
  {
    level: 3,
    name: "Operator",
    description: "Control operations",
    permissions: ["view_scada", "control_breaker"],
    mfa_required: false,
    security_level: 2,
  },
  {
    level: 5,
    name: "Administrator",
    description: "Full access",
    permissions: ["view_scada", "control_breaker", "admin"],
    mfa_required: true,
    security_level: 4,
  },
];

const mockZones = [
  {
    zone: "Zone_0_Enterprise",
    min_access_level: 1,
    description: "Enterprise network",
  },
  {
    zone: "Zone_3_Protection",
    min_access_level: 4,
    description: "Protection IEDs",
  },
];

function mockStore(state: Record<string, unknown>) {
  vi.mocked(useScadaStore).mockImplementation(((sel: (s: Record<string, unknown>) => unknown) => sel(state)) as never);
}

describe("RBACPanel", () => {
  it("returns null when roles is empty", () => {
    mockStore({
      roles: [],
      zones: [],
      selectedRoleLevel: 4,
    });

    const { container } = render(<RBACPanel />);
    expect(container.innerHTML).toBe("");
  });

  it("renders role matrix table", () => {
    mockStore({
      roles: mockRoles,
      zones: [],
      selectedRoleLevel: 3,
    });

    render(<RBACPanel />);
    expect(screen.getByText(/RBAC permission matrix/)).toBeDefined();
    expect(screen.getByText("Observer")).toBeDefined();
    expect(screen.getByText("Operator")).toBeDefined();
    expect(screen.getByText("Administrator")).toBeDefined();
  });

  it("shows MFA YES badge for roles requiring MFA", () => {
    mockStore({
      roles: mockRoles,
      zones: [],
      selectedRoleLevel: 3,
    });

    render(<RBACPanel />);
    expect(screen.getAllByText(/MFA YES/)).toHaveLength(1);
    expect(screen.getAllByText(/MFA no/)).toHaveLength(2);
  });

  it("renders security zones when available", () => {
    mockStore({
      roles: mockRoles,
      zones: mockZones,
      selectedRoleLevel: 3,
    });

    render(<RBACPanel />);
    expect(screen.getByText(/Access zones/)).toBeDefined();
    expect(screen.getByText("Zone_0_Enterprise")).toBeDefined();
    expect(screen.getByText("Zone_3_Protection")).toBeDefined();
  });

  it("shows ACCESS/DENIED based on role level", () => {
    mockStore({
      roles: mockRoles,
      zones: mockZones,
      selectedRoleLevel: 3,
    });

    render(<RBACPanel />);
    expect(screen.getByText("access")).toBeDefined();
    expect(screen.getByText("denied")).toBeDefined();
  });
});
