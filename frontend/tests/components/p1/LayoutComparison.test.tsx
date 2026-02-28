/**
 * Tests for the LayoutComparison component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LayoutComparison from "../../../src/components/p1/LayoutComparison";
import { useWindResourceStore } from "../../../src/store/windResourceStore";

vi.mock("../../../src/store/windResourceStore");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LayoutComparison", () => {
  it("returns null when layoutComparison is null", () => {
    vi.mocked(useWindResourceStore).mockReturnValue({
      layoutComparison: null,
    } as unknown as ReturnType<typeof useWindResourceStore>);

    const { container } = render(<LayoutComparison />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when layouts array is empty", () => {
    vi.mocked(useWindResourceStore).mockReturnValue({
      layoutComparison: {
        layouts: [],
        best_layout: "",
        improvement_percent: 0,
      },
    } as unknown as ReturnType<typeof useWindResourceStore>);

    const { container } = render(<LayoutComparison />);
    expect(container.innerHTML).toBe("");
  });

  it("renders layout cards", () => {
    vi.mocked(useWindResourceStore).mockReturnValue({
      layoutComparison: {
        layouts: [
          {
            name: "regular",
            net_aep_gwh: 1850,
            wake_loss_percent: 8.5,
            capacity_factor: 0.42,
            revenue_meur: 133.2,
            p90_gwh: 1720,
          },
          {
            name: "staggered",
            net_aep_gwh: 1870,
            wake_loss_percent: 7.2,
            capacity_factor: 0.43,
            revenue_meur: 134.6,
            p90_gwh: 1735,
          },
        ],
        best_layout: "staggered",
        improvement_percent: 1.08,
      },
    } as unknown as ReturnType<typeof useWindResourceStore>);

    render(<LayoutComparison />);
    expect(screen.getByText("Layout Comparison")).toBeDefined();
    expect(screen.getByText("BEST")).toBeDefined();
  });

  it("shows improvement percentage", () => {
    vi.mocked(useWindResourceStore).mockReturnValue({
      layoutComparison: {
        layouts: [
          {
            name: "regular",
            net_aep_gwh: 1850,
            wake_loss_percent: 8.5,
            capacity_factor: 0.42,
            revenue_meur: 133.2,
            p90_gwh: 1720,
          },
        ],
        best_layout: "regular",
        improvement_percent: 1.08,
      },
    } as unknown as ReturnType<typeof useWindResourceStore>);

    render(<LayoutComparison />);
    expect(screen.getByText(/1.08%/)).toBeDefined();
  });
});
