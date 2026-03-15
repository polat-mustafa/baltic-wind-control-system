/**
 * Tests for the LayerControlPanel component.
 *
 * LayerControlPanel reads from layerStore (all layers default to true).
 * Collapsed state shows a "Layers" button; expanded state shows toggle labels.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LayerControlPanel from "../../../src/components/landing/LayerControlPanel";

describe("LayerControlPanel", () => {
  it("renders collapsed button with Layers label", () => {
    render(<LayerControlPanel />);
    expect(screen.getByText("Layers")).toBeDefined();
  });

  it("does not show layer labels when collapsed", () => {
    render(<LayerControlPanel />);
    expect(screen.queryByText("Wind Flow")).toBeNull();
    expect(screen.queryByText("Wake Cones")).toBeNull();
  });

  it("expands to show all layer toggle labels on click", () => {
    render(<LayerControlPanel />);
    fireEvent.click(screen.getByText("Layers"));

    expect(screen.getByText("Map Layers")).toBeDefined();
    expect(screen.getByText("Wind Flow")).toBeDefined();
    expect(screen.getByText("Wake Cones")).toBeDefined();
    expect(screen.getByText("Ocean Waves")).toBeDefined();
    expect(screen.getByText("Array Cables")).toBeDefined();
    expect(screen.getByText("Exclusion Zone")).toBeDefined();
    expect(screen.getByText("Foundations")).toBeDefined();
    expect(screen.getByText("Turbine Labels")).toBeDefined();
    expect(screen.getByText("Bathymetry")).toBeDefined();
    expect(screen.getByText("Day / Night")).toBeDefined();
  });

  it("collapses again on second click", () => {
    render(<LayerControlPanel />);
    const btn = screen.getByText("Layers");
    fireEvent.click(btn);
    expect(screen.getByText("Wind Flow")).toBeDefined();

    fireEvent.click(btn);
    expect(screen.queryByText("Wind Flow")).toBeNull();
  });
});
