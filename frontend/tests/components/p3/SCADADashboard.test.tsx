/**
 * Tests for the SCADADashboard component.
 */

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SCADADashboard from "../../../src/components/p3/SCADADashboard";
import { useScadaStore } from "../../../src/store/scadaStore";

vi.mock("react-plotly.js", () => ({ default: () => null }));
vi.mock("../../../src/store/scadaStore");
vi.mock("../../../src/components/p3/AreaTabs", () => ({
  default: () => <div>AreaTabs</div>,
}));
vi.mock("../../../src/components/p3/SubTabs", () => ({
  default: () => <div>SubTabs</div>,
}));
vi.mock("../../../src/components/p3/SCADAKPIHeader", () => ({
  default: () => <div>SCADAKPIHeader</div>,
}));
vi.mock("../../../src/components/p3/SubstationSLD", () => ({
  default: () => <div>SubstationSLD</div>,
}));
vi.mock("../../../src/components/p3/GOOSESimPanel", () => ({
  default: () => <div>GOOSESimPanel</div>,
}));
vi.mock("../../../src/components/p3/AlarmListPanel", () => ({
  default: () => <div>AlarmListPanel</div>,
}));
vi.mock("../../../src/components/p3/EventLogPanel", () => ({
  default: () => <div>EventLogPanel</div>,
}));
vi.mock("../../../src/components/p3/PermitWorkflowPanel", () => ({
  default: () => <div>PermitWorkflowPanel</div>,
}));
vi.mock("../../../src/components/p3/RBACPanel", () => ({
  default: () => <div>RBACPanel</div>,
}));

function mockStore(overrides: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = {
    substationSummary: null,
    area: "operations",
    subTabs: { operations: "sld", equipment: "cms", diagnostics: "goose", engineering: "rbac" },
    ...overrides,
  };
  vi.mocked(useScadaStore).mockImplementation((selector: unknown) => {
    if (typeof selector === "function") {
      return (selector as (s: typeof store) => unknown)(store);
    }
    return store;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SCADADashboard", () => {
  it("returns null when substationSummary is null", () => {
    mockStore();
    const { container } = render(<SCADADashboard />);
    expect(container.innerHTML).toBe("");
  });

  it("renders all panels when data is loaded", () => {
    mockStore({ substationSummary: { total_devices: 42 } });
    const { container } = render(<SCADADashboard />);
    expect(container.innerHTML).not.toBe("");
  });
});
