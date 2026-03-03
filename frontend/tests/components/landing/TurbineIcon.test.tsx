/**
 * Tests for the TurbineIcon component.
 */

import { render, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TurbineIcon from "../../../src/components/landing/TurbineIcon";

describe("TurbineIcon", () => {
  const defaultProps = {
    turbineId: "WTG-01",
    x: 100,
    y: 200,
    status: "operating" as const,
    powerOutputMW: 12,
    onMouseEnter: vi.fn(),
    onMouseLeave: vi.fn(),
    onClick: vi.fn(),
  };

  it("renders inside SVG", () => {
    const { container } = render(
      <svg>
        <TurbineIcon {...defaultProps} />
      </svg>,
    );
    const group = container.querySelector("g");
    expect(group).toBeDefined();
  });

  it("has correct aria-label", () => {
    const { container } = render(
      <svg>
        <TurbineIcon {...defaultProps} />
      </svg>,
    );
    const button = container.querySelector('[role="button"]');
    expect(button).toBeDefined();
    expect(button?.getAttribute("aria-label")).toBe(
      "Turbine at position 100,200",
    );
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    const { container } = render(
      <svg>
        <TurbineIcon {...defaultProps} onClick={onClick} />
      </svg>,
    );
    const group = container.querySelector('[role="button"]');
    if (group) fireEvent.click(group);
    expect(onClick).toHaveBeenCalled();
  });

  it("calls onMouseEnter on hover", () => {
    const onMouseEnter = vi.fn();
    const { container } = render(
      <svg>
        <TurbineIcon {...defaultProps} onMouseEnter={onMouseEnter} />
      </svg>,
    );
    const group = container.querySelector('[role="button"]');
    if (group) fireEvent.mouseEnter(group);
    expect(onMouseEnter).toHaveBeenCalledWith("WTG-01", expect.any(Object));
  });

  it("calls onMouseLeave on mouse out", () => {
    const onMouseLeave = vi.fn();
    const { container } = render(
      <svg>
        <TurbineIcon {...defaultProps} onMouseLeave={onMouseLeave} />
      </svg>,
    );
    const group = container.querySelector('[role="button"]');
    if (group) fireEvent.mouseLeave(group);
    expect(onMouseLeave).toHaveBeenCalled();
  });
});
