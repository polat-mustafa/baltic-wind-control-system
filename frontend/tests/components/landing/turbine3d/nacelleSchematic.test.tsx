import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NacelleSchematic } from "../../../../src/components/landing/turbine3d/schematic/NacelleSchematic";
import { useLandingStore } from "../../../../src/store/landingStore";

describe("NacelleSchematic", () => {
  it("draws the three engineering sheets with a title block", () => {
    render(<NacelleSchematic turbineId="WTG-09" />);
    expect(screen.getByText("BWA-WTG-E-001")).toBeDefined();
    fireEvent.click(screen.getByRole("tab", { name: /M-01/ }));
    expect(screen.getByText("BWA-WTG-M-001")).toBeDefined();
    fireEvent.click(screen.getByRole("tab", { name: /P-01/ }));
    expect(screen.getByText("BWA-WTG-P-001")).toBeDefined();
  });

  it("selects a part from its symbol and offers the 3D fly-to", () => {
    render(<NacelleSchematic turbineId="WTG-09" />);
    fireEvent.click(screen.getByRole("tab", { name: /M-01/ }));
    fireEvent.click(screen.getByTestId("sym-gearbox"));
    expect(useLandingStore.getState().selectedTurbinePart).toBe("gearbox");
    expect(screen.getByText("Open in 3D →")).toBeDefined();
  });
});
