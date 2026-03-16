/**
 * Tests for the SCADADashboard component.
 */

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SCADADashboard from "../../../src/components/p3/SCADADashboard";
import { useScadaStore } from "../../../src/store/scadaStore";

vi.mock("react-plotly.js", () => ({ default: () => null }));
vi.mock("../../../src/store/scadaStore");
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SCADADashboard", () => {
  it("returns null when substationSummary is null", () => {
    vi.mocked(useScadaStore).mockReturnValue({
      substationSummary: null,
    } as unknown as ReturnType<typeof useScadaStore>);

    const { container } = render(<SCADADashboard />);
    expect(container.innerHTML).toBe("");
  });

  it("renders all panels when data is loaded", () => {
    vi.mocked(useScadaStore).mockReturnValue({
      substationSummary: { total_devices: 42 },
    } as unknown as ReturnType<typeof useScadaStore>);

    const { container } = render(<SCADADashboard />);
    expect(container.innerHTML).not.toBe("");
  });
});
