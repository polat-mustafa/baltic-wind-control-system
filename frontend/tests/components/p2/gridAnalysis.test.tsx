/**
 * Grid Analysis tab panels — render with realistic results, show the
 * verdicts the backend computed, and stay empty without data.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CableLoadingPanel from "../../../src/components/p2/CableLoadingPanel";
import ConverterComparisonPanel from "../../../src/components/p2/ConverterComparisonPanel";
import FRTPanel from "../../../src/components/p2/FRTPanel";
import GridConnectionDiagram from "../../../src/components/p2/GridConnectionDiagram";
import GridDashboard from "../../../src/components/p2/GridDashboard";
import GridKPIHeader from "../../../src/components/p2/GridKPIHeader";
import ShortCircuitPanel from "../../../src/components/p2/ShortCircuitPanel";
import STATCOMPanel from "../../../src/components/p2/STATCOMPanel";
import VoltageProfilePanel from "../../../src/components/p2/VoltageProfilePanel";
import { useGridStore, useNetwork } from "../../../src/store/gridStore";
import { gridState, statcomSizing } from "./gridFixtures";

vi.mock("../../../src/store/gridStore");
const { SB510_NETWORK } = await vi.importActual<typeof import("../../../src/store/gridStore")>("../../../src/store/gridStore");
vi.mock("react-plotly.js", () => ({ default: () => null }));

function withState(overrides: Record<string, unknown> = {}) {
  vi.mocked(useGridStore).mockReturnValue({ ...gridState, ...overrides } as unknown as ReturnType<typeof useGridStore>);
  vi.mocked(useNetwork).mockReturnValue(SB510_NETWORK);
}

beforeEach(() => {
  vi.clearAllMocks();
  withState();
});

describe("empty states", () => {
  it.each([
    ["GridKPIHeader", GridKPIHeader, { loadFlowResults: null }],
    ["VoltageProfilePanel", VoltageProfilePanel, { loadFlowResults: null }],
    ["CableLoadingPanel", CableLoadingPanel, { loadFlowResults: null }],
    ["ShortCircuitPanel", ShortCircuitPanel, { shortCircuit: null }],
    ["STATCOMPanel", STATCOMPanel, { statcomSizing: null }],
    ["FRTPanel", FRTPanel, { frtResult: null }],
    ["ConverterComparisonPanel", ConverterComparisonPanel, { converterComparison: null }],
    ["GridDashboard", GridDashboard, { loadFlowResults: null }],
  ] as const)("%s renders nothing without data", (_, Component, overrides) => {
    withState(overrides);
    const { container } = render(<Component />);
    expect(container.innerHTML).toBe("");
  });
});

describe("KPIs", () => {
  it("shows POC export, voltage band, breaker duty, Q range and FRT verdict", () => {
    render(<GridKPIHeader />);
    expect(screen.getByText("Delivered to PSE (full load)")).toBeTruthy();
    expect(screen.getByText("504")).toBeTruthy();
    expect(screen.getByText(/4 scenarios in 0.95–1.05 pu/)).toBeTruthy();
    expect(screen.getByText("86")).toBeTruthy(); // 21.42 / 25 kA
    expect(screen.getByText(/PSE needs \+204/)).toBeTruthy();
    expect(screen.getByText("PASS")).toBeTruthy();
  });

  it("ignores de-energised buses (vm = 0) in the voltage band", () => {
    render(<GridKPIHeader />);
    expect(screen.queryByText(/^0\.000/)).toBeNull();
  });
});

describe("power flow panels", () => {
  it("diagram shows POC power and the selected scenario", () => {
    render(<GridConnectionDiagram />);
    expect(screen.getByText("How 510 MW reach the PSE grid")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Full load 510 MW", selected: true })).toBeTruthy();
    expect(screen.getByText(/504 MW · -42 MVAR/)).toBeTruthy();
  });

  it("loading panel names the most loaded element", () => {
    render(<CableLoadingPanel />);
    expect(screen.getByText("Thermal loading of the power path")).toBeTruthy();
    expect(screen.getByText(/highest: String 1 head cable at 87 %/)).toBeTruthy();
  });

  it("voltage panel renders its title", () => {
    render(<VoltageProfilePanel />);
    expect(screen.getByText("Voltage along the connection")).toBeTruthy();
  });
});

describe("reactive power and faults", () => {
  it("reactive panel separates Ferranti from the uncompensated rise and shows the PSE range", () => {
    render(<STATCOMPanel />);
    expect(screen.getByText(/Ferranti rise along 76.5 km: 2.1 %/)).toBeTruthy();
    expect(screen.getByText(/uncompensated rise via transformers \+ grid: 14.9 %/)).toBeTruthy();
    expect(screen.getByText(/-179 … \+204 MVAR/)).toBeTruthy();
    expect(screen.getByText(/Requirement met/)).toBeTruthy();
  });

  it("reactive panel flags an unmet PSE range", () => {
    withState({ statcomSizing: { ...statcomSizing, pse_q_range_met: false } });
    render(<STATCOMPanel />);
    expect(screen.getByText(/Requirement not met/)).toBeTruthy();
  });

  it("breaker duty panel states adequacy", () => {
    render(<ShortCircuitPanel />);
    expect(screen.getByText(/Breaker duty — IEC 60909, c = 1.10/)).toBeTruthy();
    expect(screen.getByText(/All breakers adequate/)).toBeTruthy();
  });

  it("FRT panel lists the three PSE checks", () => {
    render(<FRTPanel />);
    expect(screen.getByText(/above the PSE profile: the farm must ride through/)).toBeTruthy();
    expect(screen.getByText(/ΔIq\/ΔU = 2.00/)).toBeTruthy();
    expect(screen.getByText(/in 0.46 s \(limit 5 s\)/)).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("PSE_400kV");
  });
});

describe("converter comparison", () => {
  it("shows SCR at POC and terminals, both outcomes and the summary", () => {
    render(<ConverterComparisonPanel />);
    expect(screen.getByText("19.6")).toBeTruthy();
    expect(screen.getByText("3.3")).toBeTruthy();
    expect(screen.getAllByText("✓ stable")).toHaveLength(2);
    expect(screen.getByText("391 MW")).toBeTruthy();
    expect(screen.getByText(/20° grid phase jump/)).toBeTruthy();
  });
});
