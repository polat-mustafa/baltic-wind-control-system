import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SourceBadge } from "../../src/components/ui/SourceBadge";

describe("SourceBadge", () => {
  it("shows the quality and opens the source, licence and date on click", () => {
    render(<SourceBadge p={{ quality: "literature", source: "NREL review", license: "U.S. Government work", retrieved: "2026-10-08", note: "1 770 $/kW" }} />);
    const summary = screen.getByText("literature");
    fireEvent.click(summary);
    expect(summary.closest("details")!.open).toBe(true);
    expect(screen.getByText("NREL review")).toBeTruthy();
    expect(screen.getByText("1 770 $/kW")).toBeTruthy();
    expect(screen.getByText("U.S. Government work · read 2026-10-08")).toBeTruthy();
  });
});
