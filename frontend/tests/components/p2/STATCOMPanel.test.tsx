/**
 * Tests for the STATCOMPanel component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import STATCOMPanel from "../../../src/components/p2/STATCOMPanel";
import { useGridStore } from "../../../src/store/gridStore";

vi.mock("../../../src/store/gridStore");
vi.mock("react-plotly.js", () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("STATCOMPanel", () => {
  it("returns null when statcomSizing is null", () => {
    vi.mocked(useGridStore).mockReturnValue({
      statcomSizing: null,
    } as unknown as ReturnType<typeof useGridStore>);

    const { container } = render(<STATCOMPanel />);
    expect(container.innerHTML).toBe("");
  });

  it("renders title and compensation badge", () => {
    vi.mocked(useGridStore).mockReturnValue({
      statcomSizing: {
        cable_q_mvar: 85,
        reactor_q_mvar: 50,
        ferranti_rise_pu: 0.03,
        statcom_rating_mvar: 120,
        compensation_adequate: true,
        without_compensation_v_max_pu: 1.06,
        statcom_q_range_min_mvar: -120,
        statcom_q_range_max_mvar: 120,
      },
    } as unknown as ReturnType<typeof useGridStore>);

    render(<STATCOMPanel />);
    expect(screen.getByText(/STATCOM/)).toBeDefined();
    expect(screen.getByText("Compensation Adequate")).toBeDefined();
  });

  it("shows Ferranti rise metric", () => {
    vi.mocked(useGridStore).mockReturnValue({
      statcomSizing: {
        cable_q_mvar: 85,
        reactor_q_mvar: 50,
        ferranti_rise_pu: 0.03,
        statcom_rating_mvar: 120,
        compensation_adequate: true,
        without_compensation_v_max_pu: 1.06,
        statcom_q_range_min_mvar: -120,
        statcom_q_range_max_mvar: 120,
      },
    } as unknown as ReturnType<typeof useGridStore>);

    render(<STATCOMPanel />);
    expect(screen.getByText("Ferranti Rise")).toBeDefined();
    expect(screen.getByText("3.00%")).toBeDefined();
  });
});
