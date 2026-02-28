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

describe("RBACPanel", () => {
  it("returns null when roles is empty", () => {
    vi.mocked(useScadaStore).mockReturnValue({
      roles: [],
      zones: [],
      selectedRoleLevel: 4,
    } as unknown as ReturnType<typeof useScadaStore>);

    const { container } = render(<RBACPanel />);
    expect(container.innerHTML).toBe("");
  });

  it("renders role matrix table", () => {
    vi.mocked(useScadaStore).mockReturnValue({
      roles: mockRoles,
      zones: [],
      selectedRoleLevel: 3,
    } as unknown as ReturnType<typeof useScadaStore>);

    render(<RBACPanel />);
    expect(screen.getByText("RBAC Role Matrix (IEC 62443)")).toBeDefined();
    expect(screen.getByText("Observer")).toBeDefined();
    expect(screen.getByText("Operator")).toBeDefined();
    expect(screen.getByText("Administrator")).toBeDefined();
  });

  it("shows MFA YES badge for roles requiring MFA", () => {
    vi.mocked(useScadaStore).mockReturnValue({
      roles: mockRoles,
      zones: [],
      selectedRoleLevel: 3,
    } as unknown as ReturnType<typeof useScadaStore>);

    render(<RBACPanel />);
    expect(screen.getByText("YES")).toBeDefined();
    expect(screen.getAllByText("No")).toHaveLength(2);
  });

  it("renders security zones when available", () => {
    vi.mocked(useScadaStore).mockReturnValue({
      roles: mockRoles,
      zones: mockZones,
      selectedRoleLevel: 3,
    } as unknown as ReturnType<typeof useScadaStore>);

    render(<RBACPanel />);
    expect(
      screen.getByText("IEC 62443-3-3 Security Zones"),
    ).toBeDefined();
    expect(screen.getByText("Zone_0_Enterprise")).toBeDefined();
    expect(screen.getByText("Zone_3_Protection")).toBeDefined();
  });

  it("shows ACCESS/DENIED based on role level", () => {
    vi.mocked(useScadaStore).mockReturnValue({
      roles: mockRoles,
      zones: mockZones,
      selectedRoleLevel: 3,
    } as unknown as ReturnType<typeof useScadaStore>);

    render(<RBACPanel />);
    expect(screen.getByText(/ACCESS/)).toBeDefined();
    expect(screen.getByText(/DENIED/)).toBeDefined();
  });
});
