/**
 * Tests for the AlarmTicker component.
 *
 * AlarmTicker reads from landingStore (turbineMap) and scadaStore (alarms).
 * Default state: all turbines "operating", no SCADA alarms => renders null.
 * Uses react-router-dom <Link>, so requires MemoryRouter wrapper.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import AlarmTicker from "../../../src/components/landing/AlarmTicker";

describe("AlarmTicker", () => {
  it("renders null when no faults and no SCADA alarms (default store state)", () => {
    const { container } = render(
      <MemoryRouter>
        <AlarmTicker />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns an empty container with no alarm text", () => {
    const { container } = render(
      <MemoryRouter>
        <AlarmTicker />
      </MemoryRouter>,
    );
    expect(container.innerHTML).toBe("");
    expect(screen.queryByText(/Active Faults/)).toBeNull();
    expect(screen.queryByText(/SCADA alarm/)).toBeNull();
  });
});
