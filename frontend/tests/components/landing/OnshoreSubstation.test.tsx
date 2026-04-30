/**
 * Tests for the OnshoreSubstation component.
 */

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OnshoreSubstation from "../../../src/components/landing/OnshoreSubstation";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

describe("OnshoreSubstation", () => {
  it("renders inside SVG", () => {
    const { container } = render(
      <svg>
        <OnshoreSubstation />
      </svg>,
    );
    const group = container.querySelector('[role="button"]');
    expect(group).toBeDefined();
  });

  it("displays Onshore SS label", () => {
    const { container } = render(
      <svg>
        <OnshoreSubstation />
      </svg>,
    );
    const texts = container.querySelectorAll("text");
    const label = Array.from(texts).find(
      (t) => t.textContent === "Onshore SS",
    );
    expect(label).toBeDefined();
  });

  it("displays voltage label", () => {
    const { container } = render(
      <svg>
        <OnshoreSubstation />
      </svg>,
    );
    const texts = container.querySelectorAll("text");
    const label = Array.from(texts).find(
      (t) => t.textContent === "220/400 kV",
    );
    expect(label).toBeDefined();
  });

  it("displays PSE Grid label", () => {
    const { container } = render(
      <svg>
        <OnshoreSubstation />
      </svg>,
    );
    const texts = container.querySelectorAll("text");
    const label = Array.from(texts).find(
      (t) => t.textContent === "PSE Grid",
    );
    expect(label).toBeDefined();
  });

  it("has correct aria-label", () => {
    const { container } = render(
      <svg>
        <OnshoreSubstation />
      </svg>,
    );
    const group = container.querySelector('[role="button"]');
    expect(group?.getAttribute("aria-label")).toBe(
      "Onshore Substation — 220/400 kV, oil 50°C",
    );
  });
});
