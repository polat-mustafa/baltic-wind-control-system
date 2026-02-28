/**
 * Tests for the MapLegend component.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MapLegend from "../../../src/components/landing/MapLegend";

describe("MapLegend", () => {
  it("renders Status header", () => {
    render(<MapLegend />);
    expect(screen.getByText("Status")).toBeDefined();
  });

  it("renders all four status labels", () => {
    render(<MapLegend />);
    expect(screen.getByText("Operating")).toBeDefined();
    expect(screen.getByText("Curtailed")).toBeDefined();
    expect(screen.getByText("Fault")).toBeDefined();
    expect(screen.getByText("Offline")).toBeDefined();
  });

  it("renders four color indicators", () => {
    const { container } = render(<MapLegend />);
    const dots = container.querySelectorAll(".rounded-full");
    expect(dots).toHaveLength(4);
  });
});
