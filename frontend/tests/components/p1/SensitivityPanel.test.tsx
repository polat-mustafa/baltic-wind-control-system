/**
 * Tests for the SensitivityPanel component.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SensitivityPanel from "../../../src/components/p1/SensitivityPanel";
import { useWindResourceStore } from "../../../src/store/windResourceStore";

vi.mock("../../../src/store/windResourceStore");

const mockSetWeibullA = vi.fn();
const mockSetActiveLayout = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useWindResourceStore).mockReturnValue({
    weibullA: 10.5,
    weibullK: 2.2,
    turbulenceIntensity: 0.06,
    priceEurMwh: 72,
    activeLayout: "regular",
    setWeibullA: mockSetWeibullA,
    setWeibullK: vi.fn(),
    setTurbulenceIntensity: vi.fn(),
    setPriceEurMwh: vi.fn(),
    setActiveLayout: mockSetActiveLayout,
  } as unknown as ReturnType<typeof useWindResourceStore>);
});

describe("SensitivityPanel", () => {
  it("renders Parameters header", () => {
    render(<SensitivityPanel />);
    expect(screen.getByText("Parameters")).toBeDefined();
  });

  it("renders all sliders", () => {
    render(<SensitivityPanel />);
    expect(screen.getByText("Weibull A (scale)")).toBeDefined();
    expect(screen.getByText("Weibull k (shape)")).toBeDefined();
    expect(screen.getByText("Turbulence Intensity")).toBeDefined();
    expect(screen.getByText("Electricity Price")).toBeDefined();
  });

  it("renders layout buttons", () => {
    render(<SensitivityPanel />);
    expect(screen.getByText("Regular")).toBeDefined();
    expect(screen.getByText("Staggered")).toBeDefined();
  });

  it("calls setActiveLayout on button click", () => {
    render(<SensitivityPanel />);
    fireEvent.click(screen.getByText("Staggered"));
    expect(mockSetActiveLayout).toHaveBeenCalledWith("staggered");
  });

  it("displays current parameter values", () => {
    render(<SensitivityPanel />);
    expect(screen.getByText(/10.5/)).toBeDefined();
  });
});
