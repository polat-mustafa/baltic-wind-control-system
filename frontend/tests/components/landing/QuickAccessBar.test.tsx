/**
 * Tests for the QuickAccessBar component.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import QuickAccessBar from "../../../src/components/landing/QuickAccessBar";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

describe("QuickAccessBar", () => {
  it("renders three quick-access buttons", () => {
    render(<QuickAccessBar />);
    expect(screen.getByText("P3 · SCADA")).toBeDefined();
    expect(screen.getByText("P4 · Forecast")).toBeDefined();
    expect(screen.getByText("P5 · Commissioning")).toBeDefined();
  });

  it("shows descriptions", () => {
    render(<QuickAccessBar />);
    expect(screen.getByText("IEC 61850 automation")).toBeDefined();
    expect(screen.getByText("AI wind prediction")).toBeDefined();
    expect(screen.getByText("Switching programme")).toBeDefined();
  });

  it("navigates to /scada on P3 click", () => {
    render(<QuickAccessBar />);
    fireEvent.click(screen.getByText("P3 · SCADA"));
    expect(mockNavigate).toHaveBeenCalledWith("/scada");
  });

  it("navigates to /forecast on P4 click", () => {
    render(<QuickAccessBar />);
    fireEvent.click(screen.getByText("P4 · Forecast"));
    expect(mockNavigate).toHaveBeenCalledWith("/forecast");
  });

  it("navigates to /commissioning on P5 click", () => {
    render(<QuickAccessBar />);
    fireEvent.click(screen.getByText("P5 · Commissioning"));
    expect(mockNavigate).toHaveBeenCalledWith("/commissioning");
  });
});
